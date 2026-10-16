import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ABI_SHA256, CHAIN_ID, CONTRACT_SHA256, DEPLOYER, NETWORK_ALIAS, RPC_URL, RUNNER,
  assertPreSignDeploymentRequest,
} from "./deployment_fee_policy_v24.mjs";
import { assertAbiShape, assertCandidateBytes, inspectSchemaShape } from "./rightsrail_v24_gate.mjs";
import { assertStudionetConfig, loadConfiguredAccount, NETWORK, pollFinal, readClient, requireGaslessFeeEstimate, rpc, safeJson, statusName, executionName } from "./genlayer_studionet.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail_v24.py");
const abiPath = join(root, "artifacts", "rightsrail-v24.abi.json");
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-v24-studionet-deployment.json");
const accountName = "firewall-only";
const semanticKeys = ["asset_match", "purpose_within_scope", "prohibited_context_present", "transformation_within_scope", "attribution_satisfied", "endorsement_implied", "evidence_sufficient"];

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex").toUpperCase(); }
function hashText(value) { return hash(Buffer.from(value, "utf8")); }
function writeJournal(journal) { writeFileSync(journalPath, `${JSON.stringify(safeJson(journal), null, 2)}\n`, "utf8"); }
function parse(value) { if (typeof value === "string") { try { return JSON.parse(value); } catch { return value; } } return value; }
function addressOf(value) {
  const choices = [value?.data?.contract_address, value?.data?.contractAddress, value?.contract_address, value?.contractAddress, value?.txDataDecoded?.contractAddress];
  return choices.find((item) => typeof item === "string" && /^0x[\da-fA-F]{40}$/.test(item)) ?? null;
}
function assertZero(value, label) { for (const [key, item] of Object.entries(value ?? {})) if (String(item) !== "0") throw new Error(`${label}:${key}:${item}`); }
async function accountState(address) {
  const [latest, pending, balance] = await Promise.all([
    rpc("eth_getTransactionCount", [address, "latest"]), rpc("eth_getTransactionCount", [address, "pending"]), rpc("eth_getBalance", [address, "latest"]),
  ]);
  return { latest: Number(BigInt(latest)), pending: Number(BigInt(pending)), balance: BigInt(balance).toString() };
}
async function existingDeployerDeployments() {
  const txs = await rpc("sim_getTransactionsForAddress", [DEPLOYER]);
  if (!Array.isArray(txs)) throw new Error("DEPLOYER_HISTORY_UNAVAILABLE");
  return txs.filter((tx) => Number(tx?.type) === 1).map((tx) => ({
    hash: tx.hash,
    status: tx.status,
    address: tx.data?.contract_address ?? null,
    source_sha256: typeof tx.data?.contract_code === "string" ? hash(Buffer.from(tx.data.contract_code, "utf8")) : null,
  }));
}

async function main() {
  assertStudionetConfig();
  if (NETWORK_ALIAS !== "studionet" || CHAIN_ID !== 61999 || RPC_URL !== "https://studio.genlayer.com/api") throw new Error("BUILTIN_NETWORK_GUARD_FAILED");
  const sourceBytes = readFileSync(sourcePath);
  const abiBytes = readFileSync(abiPath);
  const hashes = assertCandidateBytes({ sourceBytes, abiBytes });
  const shape = assertAbiShape(abiBytes);
  const source = sourceBytes.toString("utf8");
  if (!source.startsWith(`# { "Depends": "${RUNNER}" }\n\n`)) throw new Error("RUNNER_HEADER_MISMATCH");
  if (existsSync(journalPath)) {
    const prior = JSON.parse(readFileSync(journalPath, "utf8"));
    if (Number(prior.broadcast_count ?? 0) > 0 || prior.transaction_id || prior.tx_hash) throw new Error("STUDIONET_DEPLOYMENT_ALREADY_SUBMITTED_NO_RETRY");
  }

  const account = await loadConfiguredAccount(accountName, DEPLOYER);
  const client = readClient(account);
  const feeEstimate = await requireGaslessFeeEstimate(client);
  const before = await accountState(account.address);
  if (before.latest !== before.pending) throw new Error(`NONCE_MISMATCH:${before.latest}:${before.pending}`);
  const [gasPrice, chainId, txHistory, schema] = await Promise.all([
    rpc("eth_gasPrice", []), rpc("eth_chainId", []), existingDeployerDeployments(), client.getContractSchemaForCode(source),
  ]);
  if (Number(BigInt(chainId)) !== CHAIN_ID) throw new Error("RPC_CHAIN_ID_MISMATCH");
  const chainShape = inspectSchemaShape(schema);
  if (JSON.stringify(chainShape) !== JSON.stringify(shape)) throw new Error("LOCAL_GENERATED_SCHEMA_MISMATCH");
  const schemaNames = Object.keys(schema?.methods ?? {}).sort();
  const abiNames = Object.keys(JSON.parse(abiBytes.toString("utf8"))?.methods ?? {}).sort();
  if (JSON.stringify(schemaNames) !== JSON.stringify(abiNames)) throw new Error("GENERATED_ABI_METHOD_PARITY_MISMATCH");
  if (txHistory.some((tx) => tx.source_sha256 === CONTRACT_SHA256)) throw new Error("EXACT_CANDIDATE_ALREADY_DEPLOYED_BY_CONFIGURED_SIGNER");

  const journal = {
    schema: "RIGHTSRAIL_V24_STUDIONET_DEPLOYMENT_JOURNAL_V1",
    network: { alias: NETWORK.alias, rpc: NETWORK.rpc, chain_id: NETWORK.chainId, consensus_main: NETWORK.consensusMain, consensus_data: NETWORK.consensusData, built_in_configuration: true, custom_rpc_override_used: false },
    candidate: { source: "contracts/rightsrail_v24.py", source_sha256: hashes.sourceHash, abi: "artifacts/rightsrail-v24.abi.json", abi_sha256: hashes.abiHash, schema_shape: { methods: shape.total, reads: shape.reads, writes: shape.writes }, runner: RUNNER },
    signer: { account_name: accountName, address: account.address },
    preflight: { rpc_chain_id: Number(BigInt(chainId)), eth_gas_price_wei: BigInt(gasPrice).toString(), fee_estimate: { source: "installed GenLayerJS estimateTransactionFees", status: "GASLESS_CONFIRMED", quote: safeJson(feeEstimate) }, nonce_latest: before.latest, nonce_pending: before.pending, balance_wei: before.balance, existing_deployer_deployments: txHistory, exact_candidate_in_deployer_history: false, source_schema_parity: true, broadcast_count: 0 },
    phase: "PREPARED_READ_ONLY_PREFLIGHT_PASS",
    transaction_id: null,
    contract_address: null,
    status: null,
    execution_status: null,
    receipt: null,
    created_at: new Date().toISOString(),
  };
  assertPreSignDeploymentRequest({ networkAlias: NETWORK.alias, chainId: NETWORK.chainId, rpc: NETWORK.rpc, sender: account.address, runner: RUNNER, userValue: "0", nonce: before.latest, latestNonce: before.latest, pendingNonce: before.pending, sourceSha256: hashes.sourceHash, abiSha256: hashes.abiHash, constructorArgs: [], constructorKwargs: {}, feeEstimate });
  writeJournal(journal);

  journal.phase = "BROADCASTING_ONCE";
  journal.broadcast_count = 1;
  journal.broadcast_started_at = new Date().toISOString();
  writeJournal(journal);
  let txHash;
  try {
    txHash = await client.deployContract({ account, code: source, args: [], kwargs: {} });
  } catch (error) {
    journal.phase = "SUBMISSION_STATE_UNCERTAIN_NO_RETRY";
    journal.submission_error = String(error?.message ?? error);
    writeJournal(journal);
    throw new Error("DEPLOYMENT_SUBMISSION_UNCERTAIN_DO_NOT_REBROADCAST");
  }
  if (typeof txHash !== "string" || !/^0x[\da-fA-F]{64}$/.test(txHash)) throw new Error("DEPLOYMENT_HASH_MISSING_NO_RETRY");
  journal.transaction_id = txHash;
  journal.phase = "HASH_PERSISTED_POLLING_SAME_TRANSACTION";
  journal.submitted_at = new Date().toISOString();
  writeJournal(journal);

  const final = await pollFinal(client, txHash, { onPoll: (tx) => {
    journal.latest_status = statusName(tx);
    journal.latest_execution_status = executionName(tx);
    journal.last_polled_at = new Date().toISOString();
    journal.receipt = safeJson(tx);
    writeJournal(journal);
  }});
  journal.receipt = safeJson(final);
  journal.status = statusName(final);
  journal.execution_status = executionName(final);
  if (journal.status !== "FINALIZED" || journal.execution_status !== "FINISHED_WITH_RETURN") {
    journal.phase = "FINALIZED_EXECUTION_FAILED";
    writeJournal(journal);
    throw new Error(`DEPLOYMENT_TERMINAL_FAILURE:${journal.status}:${journal.execution_status}`);
  }
  let address = addressOf(final);
  if (!address) address = addressOf(await client.getTransaction({ hash: txHash }));
  if (!address) throw new Error("DEPLOYED_ADDRESS_NOT_IN_FINAL_RECEIPT");
  journal.contract_address = address;
  journal.phase = "VERIFYING_DEPLOYED_CANDIDATE";
  writeJournal(journal);

  const deployedSchema = await client.getContractSchema(address);
  const deployedShape = inspectSchemaShape(deployedSchema);
  if (JSON.stringify(deployedShape) !== JSON.stringify(shape)) throw new Error("DEPLOYED_SCHEMA_SHAPE_MISMATCH");
  if (JSON.stringify(Object.keys(deployedSchema.methods ?? {}).sort()) !== JSON.stringify(abiNames)) throw new Error("DEPLOYED_SCHEMA_METHOD_MISMATCH");
  const deployedCode = await client.getContractCode(address);
  if (hashText(deployedCode) !== CONTRACT_SHA256) throw new Error("DEPLOYED_SOURCE_HASH_MISMATCH");
  const read = async (name, args = []) => parse(await client.readContract({ address, functionName: name, args }));
  const [info, state, accounting, semanticSchema, keys] = await Promise.all([
    read("contract_info"), read("get_status"), read("get_accounting_status"), read("get_semantic_schema"), read("get_semantic_keys"),
  ]);
  if (semanticSchema !== "RIGHTSRAIL_USAGE_V1" || JSON.stringify(keys) !== JSON.stringify(semanticKeys)) throw new Error("DEPLOYED_SEMANTIC_SCHEMA_MISMATCH");
  assertZero(state, "INITIAL_STATUS_NOT_ZERO");
  assertZero(accounting, "INITIAL_ACCOUNTING_NOT_ZERO");
  for (const method of ["get_policy_ids", "get_request_ids", "get_evidence_ids", "get_adjudication_ids", "get_permit_ids", "get_settlement_ids", "get_withdrawal_ids", "get_audit_events"]) {
    const args = method === "get_audit_events" ? [0n, 100n] : [0n, 100n];
    const list = await read(method, args);
    if (!Array.isArray(list) || list.length) throw new Error(`INITIAL_COLLECTION_NOT_EMPTY:${method}`);
  }
  if (info?.owner_override !== false || info?.withdrawal_supported !== true || info?.semantic_schema !== "RIGHTSRAIL_USAGE_V1") throw new Error("DEPLOYED_CONTRACT_INFO_MISMATCH");
  const after = await accountState(account.address);
  journal.verification = { source_sha256: hashText(deployedCode), source_parity: true, abi_schema_parity: true, schema_shape: deployedShape, semantic_schema: semanticSchema, semantic_keys: keys, contract_info: safeJson(info), initial_status: safeJson(state), initial_accounting: safeJson(accounting), empty_collections_verified: true, balance_after_wei: after.balance, nonce_after: after.latest };
  journal.phase = "DEPLOYMENT_VERIFIED";
  journal.deployment_count = 1;
  journal.deployment_verdict = "SUCCESSFUL_STUDIONET_V24_DEPLOYMENT_VERIFIED";
  writeJournal(journal);
  console.log(JSON.stringify({ phase: journal.phase, network: journal.network, transaction_id: txHash, status: journal.status, execution_status: journal.execution_status, contract_address: address, source_sha256: hashes.sourceHash, abi_sha256: hashes.abiHash, schema_shape: deployedShape, initial_state_verified: true }, null, 2));
}

main().catch((error) => { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; });
