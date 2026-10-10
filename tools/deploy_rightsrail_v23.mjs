import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ABI_SHA256,
  CHAIN_ID,
  CONTRACT_SHA256,
  DEPLOYER,
  RPC_URL,
  RUNNER,
  assertPreSignDeploymentRequest,
  buildProvenStudioDevFees,
} from "./deployment_fee_policy_v23.mjs";

const genlayerSdkBase = "C:/Users/DELL/CharterLock/frontend/node_modules/genlayer-js/dist/";
const { createAccount, createClient, isSuccessful } = await import(pathToFileURL(join(genlayerSdkBase, "index.js")));
const { studioDevnet } = await import(pathToFileURL(join(genlayerSdkBase, "chains", "index.js")));

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail.py");
const abiPath = join(root, "artifacts", "rightsrail.abi.json");
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-v23-deployment.json");
const expectedAccountName = "firewall-only";
const expectedSemanticSchema = "RIGHTSRAIL_USAGE_V1";
const expectedSemanticKeys = [
  "asset_match",
  "purpose_within_scope",
  "prohibited_context_present",
  "transformation_within_scope",
  "attribution_satisfied",
  "endorsement_implied",
  "evidence_sufficient",
];
const expectedFeeValue = "100000000000010352";
const expectedExecutionBudget = "25000000000000000";

function safeJson(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(safeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeJson(item)]));
  }
  return value;
}

function writeJournal(journal) {
  writeFileSync(journalPath, `${JSON.stringify(safeJson(journal), null, 2)}\n`, "utf8");
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function hashText(text) {
  return hashBytes(Buffer.from(text, "utf8"));
}

function parseContractValue(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

function executionName(receipt) {
  return receipt?.txExecutionResultName ?? receipt?.executionResultName ?? receipt?.execution_result ?? null;
}

function statusName(receipt) {
  return receipt?.statusName ?? receipt?.status ?? null;
}

function extractContractAddress(value) {
  const candidates = [
    value?.data?.contract_address,
    value?.data?.contractAddress,
    value?.receipt?.data?.contract_address,
    value?.receipt?.data?.contractAddress,
    value?.txDataDecoded?.contractAddress,
    value?.receipt?.txDataDecoded?.contractAddress,
    value?.contract_address,
    value?.contractAddress,
    value?.receipt?.contract_address,
    value?.receipt?.contractAddress,
  ];
  return candidates.find((candidate) => typeof candidate === "string" && /^0x[0-9a-fA-F]{40}$/.test(candidate)) ?? null;
}

function assertCleanFrozenInputs(sourceBytes, abiBytes) {
  const sourceHash = hashBytes(sourceBytes);
  const abiHash = hashBytes(abiBytes);
  if (sourceHash !== CONTRACT_SHA256) throw new Error("PRE_BROADCAST_CONTRACT_HASH_MISMATCH");
  if (abiHash !== ABI_SHA256) throw new Error("PRE_BROADCAST_ABI_HASH_MISMATCH");
  return { sourceHash, abiHash };
}

async function rpc(client, method, params) {
  return client.request({ method, params });
}

async function accountState(client, address) {
  const [latestRaw, pendingRaw, balanceRaw] = await Promise.all([
    rpc(client, "eth_getTransactionCount", [address, "latest"]),
    rpc(client, "eth_getTransactionCount", [address, "pending"]),
    rpc(client, "eth_getBalance", [address, "latest"]),
  ]);
  return {
    latest: Number(BigInt(latestRaw)),
    pending: Number(BigInt(pendingRaw)),
    balance: BigInt(balanceRaw),
  };
}

async function loadExistingAccount() {
  const configPath = join(process.env.USERPROFILE ?? "", ".genlayer", "genlayer-config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.activeAccount !== expectedAccountName) throw new Error(`ACTIVE_ACCOUNT_MISMATCH:${config.activeAccount}`);
  const packagePath = join(process.env.APPDATA ?? "", "npm", "node_modules", "genlayer", "package.json");
  if (!existsSync(packagePath)) throw new Error("GENLAYER_CLI_PACKAGE_NOT_FOUND");
  const keytar = createRequire(packagePath)("keytar");
  const privateKey = await keytar.getPassword("genlayer-cli", `account:${expectedAccountName}`);
  if (typeof privateKey !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("EXISTING_ACCOUNT_SECRET_UNAVAILABLE_OR_INVALID");
  }
  const account = createAccount(privateKey);
  if (account.address.toLowerCase() !== DEPLOYER) throw new Error("EXISTING_ACCOUNT_ADDRESS_MISMATCH");
  return account;
}

async function readContract(client, address, functionName, args = []) {
  return parseContractValue(await client.readContract({ address, functionName, args }));
}

function collectionIsEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function assertZeroAccounting(accounting) {
  const fields = [
    "total_escrow_received",
    "total_escrowed",
    "total_payout_allocated",
    "total_refund_allocated",
    "total_withdrawal_emitted",
    "conservation_rhs",
  ];
  for (const field of fields) if (String(accounting?.[field]) !== "0") throw new Error(`INITIAL_ACCOUNTING_NOT_ZERO:${field}`);
}

async function main() {
  if (process.env.RIGHTSRAIL_DEPLOY_V23_APPROVED !== "YES") {
    throw new Error("EXPLICIT_V23_DEPLOYMENT_APPROVAL_ENV_REQUIRED");
  }
  if (studioDevnet.id !== CHAIN_ID || studioDevnet.rpcUrls.default.http[0] !== RPC_URL) throw new Error("NETWORK_GUARD_FAILED");
  if (existsSync(journalPath)) {
    const prior = JSON.parse(readFileSync(journalPath, "utf8"));
    if (prior.broadcast_count > 0 || prior.tx_hash) throw new Error("V23_DEPLOYMENT_ALREADY_SUBMITTED_NO_RETRY");
  }

  const sourceBytes = readFileSync(sourcePath);
  const abiBytes = readFileSync(abiPath);
  const hashes = assertCleanFrozenInputs(sourceBytes, abiBytes);
  const source = sourceBytes.toString("utf8");
  if (!source.startsWith(`# { "Depends": "${RUNNER}" }\n\n`)) throw new Error("RUNNER_HEADER_MISMATCH");

  const account = await loadExistingAccount();
  const client = createClient({ chain: studioDevnet, account });
  const before = await accountState(client, account.address);
  if (before.latest !== before.pending) throw new Error(`NONCE_MISMATCH:${before.latest}:${before.pending}`);
  const policy = await client.getCurrentFeePolicy();
  const rawEstimate = await client.estimateTransactionFees();
  const fees = buildProvenStudioDevFees(rawEstimate);
  if (fees.feeValue !== expectedFeeValue) throw new Error("FEE_VALUE_NOT_PROVEN_PROFILE");
  if (fees.distribution.executionBudgetPerRound !== expectedExecutionBudget) throw new Error("EXECUTION_BUDGET_NOT_PROVEN_PROFILE");
  if (fees.distribution.leaderTimeunitsAllocation !== "100" || fees.distribution.validatorTimeunitsAllocation !== "200") throw new Error("FEE_ALLOCATION_MISMATCH");
  if (JSON.stringify(fees.distribution.rotations) !== JSON.stringify(["3"])) throw new Error("ROTATIONS_MISMATCH");
  if (before.balance < BigInt(fees.feeValue)) throw new Error("INSUFFICIENT_DEPLOYMENT_BALANCE");

  const request = {
    chainId: CHAIN_ID,
    rpc: RPC_URL,
    sender: account.address,
    nonce: before.latest,
    latestNonce: before.latest,
    pendingNonce: before.pending,
    sourceSha256: hashes.sourceHash,
    abiSha256: hashes.abiHash,
    runner: RUNNER,
    userValue: "0",
    constructorArgs: [],
    constructorKwargs: {},
    observedReceiptCost: fees.observedReceiptCost,
    fees,
  };
  assertPreSignDeploymentRequest(request);

  const journal = {
    attempt: "DEPLOYMENT_ATTEMPT_V23",
    historical_attempt_1_tx: "0x6d1f81af7fe4872be8eeceb29a2331a082e6a822a6b912a99d2155b9a76d664e",
    network: "studio-dev",
    chain_id: CHAIN_ID,
    rpc: RPC_URL,
    account_name: expectedAccountName,
    deployer: DEPLOYER,
    source_sha256: hashes.sourceHash,
    abi_sha256: hashes.abiHash,
    source_bytes: sourceBytes.length,
    runner: RUNNER,
    constructor_args: [],
    constructor_kwargs: {},
    user_value: "0",
    fee_value: fees.feeValue,
    fee_distribution: fees.distribution,
    fee_policy: safeJson(policy),
    raw_fee_estimate: safeJson(rawEstimate),
    balance_before: before.balance.toString(),
    latest_nonce_before: before.latest,
    pending_nonce_before: before.pending,
    deployment_request: {
      ...request,
      sdk_call: "client.deployContract({ account, code, args: [], kwargs: {}, fees })",
    },
    phase: "PREPARED",
    broadcast_count: 0,
    tx_hash: null,
    status: null,
    execution_status: null,
    contract_address: null,
    qualification_writes: 0,
    unexpected_writes: 0,
    created_at: new Date().toISOString(),
  };
  writeJournal(journal);

  // This is the sole authorized deployment call. No retry branch exists.
  journal.phase = "SIGNING_AND_BROADCASTING";
  journal.broadcast_count = 1;
  journal.broadcast_started_at = new Date().toISOString();
  writeJournal(journal);
  let txHash;
  try {
    txHash = await client.deployContract({
      account,
      code: source,
      args: [],
      kwargs: {},
      fees: {
        distribution: fees.distribution,
        feeValue: fees.feeValue,
      },
    });
  } catch (error) {
    journal.phase = "SUBMISSION_STATE_UNCERTAIN";
    journal.error = { name: error?.name ?? "Error", message: error?.message ?? String(error) };
    writeJournal(journal);
    throw new Error("V23_SUBMISSION_STATE_UNCERTAIN_NO_RETRY");
  }
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    journal.phase = "HASH_NOT_OBSERVED";
    writeJournal(journal);
    throw new Error("V23_HASH_NOT_OBSERVED_NO_RETRY");
  }
  journal.tx_hash = txHash;
  journal.phase = "SUBMITTED_HASH_PERSISTED";
  journal.submitted_at = new Date().toISOString();
  writeJournal(journal);

  const submitted = await client.getTransaction({ hash: txHash });
  const submittedNonce = submitted?.nonce === undefined ? null : Number(submitted.nonce);
  journal.submitted_nonce = submittedNonce;
  if (submittedNonce !== before.latest) {
    journal.phase = "NONCE_RECONCILIATION_FAILED";
    writeJournal(journal);
    throw new Error(`SUBMITTED_NONCE_MISMATCH:${submittedNonce}:${before.latest}`);
  }

  journal.phase = "PENDING";
  writeJournal(journal);
  const finalReceipt = await client.waitForFinalization({ hash: txHash, fullTransaction: true });
  journal.receipt = safeJson(finalReceipt);
  journal.status = statusName(finalReceipt);
  journal.execution_status = executionName(finalReceipt);
  journal.phase = "FINALIZED_EXECUTION_CHECKED";
  writeJournal(journal);
  if (!isSuccessful(finalReceipt) || journal.execution_status !== "FINISHED_WITH_RETURN") {
    throw new Error(`DEPLOYMENT_EXECUTION_FAILED:${journal.execution_status ?? "UNKNOWN"}`);
  }

  let address = extractContractAddress(finalReceipt);
  if (!address) {
    const authoritative = await client.getTransaction({ hash: txHash });
    journal.authoritative_transaction = safeJson(authoritative);
    address = extractContractAddress(authoritative);
  }
  if (!address) throw new Error("CANONICAL_CONTRACT_ADDRESS_NOT_FOUND");
  journal.contract_address = address;

  const schema = await client.getContractSchema(address);
  const localAbi = JSON.parse(abiBytes.toString("utf8"));
  const deployedMethods = Object.keys(schema?.methods ?? {}).sort();
  const localMethods = Object.keys(localAbi?.methods ?? {}).sort();
  if (deployedMethods.length !== 35 || localMethods.length !== 35) throw new Error("PUBLIC_METHOD_COUNT_MISMATCH");
  if (JSON.stringify(deployedMethods) !== JSON.stringify(localMethods)) throw new Error("ABI_METHOD_NAMES_MISMATCH");
  const reads = deployedMethods.filter((name) => schema.methods[name]?.readonly === true);
  const writes = deployedMethods.filter((name) => schema.methods[name]?.readonly !== true);
  if (reads.length !== 23 || writes.length !== 12) throw new Error("PUBLIC_READ_WRITE_COUNT_MISMATCH");

  const info = await readContract(client, address, "contract_info");
  const status = await readContract(client, address, "get_status");
  const accounting = await readContract(client, address, "get_accounting_status");
  const semanticSchema = await readContract(client, address, "get_semantic_schema");
  const semanticKeys = await readContract(client, address, "get_semantic_keys");
  if (semanticSchema !== expectedSemanticSchema) throw new Error("SEMANTIC_SCHEMA_MISMATCH");
  if (JSON.stringify(semanticKeys) !== JSON.stringify(expectedSemanticKeys)) throw new Error("SEMANTIC_KEYS_MISMATCH");
  for (const field of ["policy_count", "request_count", "evidence_count", "authentication_count", "adjudication_count", "permit_count", "settlement_count", "audit_count", "sequence"]) {
    if (String(status?.[field]) !== "0") throw new Error(`INITIAL_STATE_NOT_EMPTY:${field}`);
  }
  assertZeroAccounting(accounting);
  if (!collectionIsEmpty(await readContract(client, address, "get_policy_ids", [0, 100]))) throw new Error("INITIAL_POLICY_IDS_NOT_EMPTY");
  if (!collectionIsEmpty(await readContract(client, address, "get_request_ids", [0, 100]))) throw new Error("INITIAL_REQUEST_IDS_NOT_EMPTY");
  if (!collectionIsEmpty(await readContract(client, address, "get_evidence_ids", [0, 100]))) throw new Error("INITIAL_EVIDENCE_IDS_NOT_EMPTY");
  if (!collectionIsEmpty(await readContract(client, address, "get_adjudication_ids", [0, 100]))) throw new Error("INITIAL_ADJUDICATION_IDS_NOT_EMPTY");
  if (!collectionIsEmpty(await readContract(client, address, "get_permit_ids", [0, 100]))) throw new Error("INITIAL_PERMIT_IDS_NOT_EMPTY");
  if (!collectionIsEmpty(await readContract(client, address, "get_settlement_ids", [0, 100]))) throw new Error("INITIAL_SETTLEMENT_IDS_NOT_EMPTY");
  if (!collectionIsEmpty(await readContract(client, address, "get_withdrawal_ids", [0, 100]))) throw new Error("INITIAL_WITHDRAWAL_IDS_NOT_EMPTY");
  if (info?.semantic_schema !== expectedSemanticSchema || info?.version !== "2.3.0" || info?.owner_override !== false || info?.withdrawal_supported !== true) throw new Error("CONTRACT_INFO_PARITY_FAILED");

  const deployedCode = await client.getContractCode(address);
  const deployedSourceSha = hashText(deployedCode);
  if (deployedSourceSha !== CONTRACT_SHA256) throw new Error("DEPLOYED_SOURCE_PARITY_FAILED");
  const after = await accountState(client, account.address);
  journal.source_parity = true;
  journal.abi_parity = true;
  journal.runner_parity = source.startsWith(`# { "Depends": "${RUNNER}" }`);
  journal.public_method_count = deployedMethods.length;
  journal.public_read_methods = reads.length;
  journal.public_write_methods = writes.length;
  journal.semantic_schema = semanticSchema;
  journal.semantic_keys = semanticKeys;
  journal.initial_state_verified = true;
  journal.accounting_initial_state_verified = true;
  journal.deployed_source_sha256 = deployedSourceSha;
  journal.balance_after = after.balance.toString();
  journal.latest_nonce_after = after.latest;
  journal.pending_nonce_after = after.pending;
  journal.phase = "DEPLOYMENT_VERIFIED_STOP";
  journal.deployment_verdict = "SUCCESSFUL_DEPLOYMENT_ONLY_NO_QUALIFICATION";
  writeJournal(journal);

  console.log(JSON.stringify({
    deployment_tx: txHash,
    broadcast_count: journal.broadcast_count,
    tx_status: journal.status,
    execution_status: journal.execution_status,
    contract_address: address,
    source_parity: journal.source_parity,
    abi_parity: journal.abi_parity,
    runner_parity: journal.runner_parity,
    public_method_count: journal.public_method_count,
    public_read_methods: journal.public_read_methods,
    public_write_methods: journal.public_write_methods,
    semantic_schema: journal.semantic_schema,
    semantic_keys: journal.semantic_keys,
    initial_state_verified: journal.initial_state_verified,
    accounting_initial_state_verified: journal.accounting_initial_state_verified,
    balance_after: journal.balance_after,
    latest_nonce_after: journal.latest_nonce_after,
    pending_nonce_after: journal.pending_nonce_after,
    qualification_writes: 0,
    unexpected_writes: 0,
    stop_reason: "POST_DEPLOYMENT_VERIFICATION_COMPLETE",
  }, null, 2));
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
