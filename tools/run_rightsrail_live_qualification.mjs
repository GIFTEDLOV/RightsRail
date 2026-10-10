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
  OBSERVED_ATTEMPT_1_RECEIPT_COST,
  RPC_URL,
  RUNNER,
} from "./deployment_fee_policy.mjs";
import {
  buildQualificationWriteSpec,
  QUALIFICATION_POLICY_FEE_WEI,
} from "./qualification_write_spec.mjs";

const SDK_BASE = "C:/Users/DELL/CharterLock/frontend/node_modules/genlayer-js/dist/";
const { createAccount, createClient } = await import(pathToFileURL(join(SDK_BASE, "index.js")));
const { studioDevnet } = await import(pathToFileURL(join(SDK_BASE, "chains", "index.js")));

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail.py");
const abiPath = join(root, "artifacts", "rightsrail.abi.json");
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-live-qualification.json");
const contractAddress = "0x984b996079d2591976FcfFb62d0506DF02E0396A";
const expectedAccountName = "firewall-only";
const expectedPolicyId = "policy-lumen-finch-001";
const expectedRecipient = DEPLOYER;
const expectedSchema = "RIGHTSRAIL_USAGE_V1";
const expectedKeys = [
  "asset_match",
  "purpose_within_scope",
  "prohibited_context_present",
  "transformation_within_scope",
  "attribution_satisfied",
  "endorsement_implied",
  "evidence_sufficient",
];
const expectedMethods = {
  reads: 21,
  writes: 9,
  total: 30,
};
const expectedWrites = 22;
const legacyExecutionBudgetFloor = 76548000000000n;
const expectedReference = {
  source: "https://rightsrail-evidence.vercel.app/reference.svg",
  sha256: "0fac13cbd9597297d4de5f4b656a9dc97cf6b2d43a866347b5c14ef5de57d3ef",
  bytes: 1325,
  mime: "image/svg+xml",
};
const evidenceCases = {
  A: {
    requestId: "request-live-case-a",
    evidenceId: "evidence-live-case-a",
    proposed: "https://rightsrail-evidence.vercel.app/proposed-editorial.svg",
    proposedSha256: "4a6b49323fb5bc1e64a47129e73311ea3a6255300e77c76b94af19968d2d1627",
    proposedBytes: 1842,
    expected: "PERMITTED",
    purpose: "Technology newsletter editorial use",
    channel: "newsletter",
    context: "Independent editorial article; no endorsement",
    attribution: "Image courtesy of Lumen Finch Studio",
  },
  B: {
    requestId: "request-live-case-b",
    evidenceId: "evidence-live-case-b",
    proposed: "https://rightsrail-evidence.vercel.app/proposed-betting.svg",
    proposedSha256: "788338f4d84ac1a020b1774b6e06eea1bb259f5e119e1d9235159654a5c98517",
    proposedBytes: 1389,
    expected: "DENIED",
    purpose: "Commercial betting promotion",
    channel: "paid social advertisement",
    context: "Betting offer presented as a recommendation",
    attribution: "Image courtesy of Lumen Finch Studio",
  },
  C: {
    requestId: "request-live-case-c",
    evidenceId: "evidence-live-case-c",
    proposed: "https://rightsrail-evidence.vercel.app/proposed-missing-context.svg",
    proposedSha256: "f70930915e70d3b23be250e38f6d16fb68b006639e2967b2c3a0e701c38ace69",
    proposedBytes: 1180,
    expected: "INCONCLUSIVE",
    purpose: "Technology newsletter editorial use",
    channel: "newsletter",
    context: "Context page unavailable during capture",
    attribution: "",
  },
  D: {
    requestId: "request-live-case-d",
    evidenceId: "evidence-live-case-d",
    proposed: "https://rightsrail-evidence.vercel.app/unrelated.svg",
    proposedSha256: "2ccf22846ee7df949ed64a61f7775ecbaa0a8a2ee93dd4c5099e9a9117312d89",
    proposedBytes: 888,
    expected: "NOT_APPLICABLE",
    purpose: "Technology newsletter editorial use",
    channel: "newsletter",
    context: "Unrelated asset supplied",
    attribution: "Image courtesy of Lumen Finch Studio",
  },
};
const orderedWriteKeys = [
  "policy:create",
  "policy:freeze",
  "case-A:submit_usage_request",
  "case-A:commit_evidence",
  "case-A:authenticate_evidence",
  "case-A:adjudicate_usage",
  "case-A:settle_request",
  "case-B:submit_usage_request",
  "case-B:commit_evidence",
  "case-B:authenticate_evidence",
  "case-B:adjudicate_usage",
  "case-B:settle_request",
  "case-C:submit_usage_request",
  "case-C:commit_evidence",
  "case-C:authenticate_evidence",
  "case-C:adjudicate_usage",
  "case-C:settle_request",
  "case-D:submit_usage_request",
  "case-D:commit_evidence",
  "case-D:authenticate_evidence",
  "case-D:adjudicate_usage",
  "case-D:settle_request",
];

const licenseText = "Commercial editorial/web use; attribution required.";
const policySpec = {
  policy_id: expectedPolicyId,
  asset_sha256: expectedReference.sha256,
  asset_exact_bytes: expectedReference.bytes,
  asset_media_type: expectedReference.mime,
  asset_source: expectedReference.source,
  license_text_sha256: null,
  license_text_exact_bytes: Buffer.byteLength(licenseText, "utf8"),
  license_text: licenseText,
  allowed_purposes: ["commercial editorial", "technology newsletter", "web article"],
  prohibited_purposes: ["gambling promotion", "impersonation"],
  allowed_channels: ["article", "editorial web", "newsletter"],
  prohibited_contexts: ["betting advertisement", "impersonation", "synthetic endorsement"],
  transformation_rules: ["color changes allowed", "cropping allowed"],
  attribution_requirement: "Visible attribution required",
  endorsement_rule: "Synthetic endorsement prohibited",
  valid_from: 1767225600,
  valid_until: 0,
  required_fee_wei: 10,
  settlement_recipient: expectedRecipient,
};

function hashBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashText(value) {
  return hashBytes(Buffer.from(value, "utf8"));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value) {
  return hashText(canonical(value));
}

function safeJson(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(safeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeJson(item)]));
  }
  return value;
}

function parseContractValue(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

function statusName(receipt) {
  return receipt?.statusName ?? receipt?.status ?? receipt?.consensusStatus ?? null;
}

function executionName(receipt) {
  return receipt?.txExecutionResultName ?? receipt?.executionResultName ?? receipt?.execution_result ?? receipt?.result_name ?? null;
}

function describeError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try { return JSON.stringify(safeJson(error)); } catch { return String(error); }
}

function writeJournal(journal) {
  writeFileSync(journalPath, `${JSON.stringify(safeJson(journal), null, 2)}\n`, "utf8");
}

function requireEqual(actual, expected, label) {
  if (String(actual) !== String(expected)) throw new Error(`${label}:${String(actual)}:${String(expected)}`);
}

function assertAddress(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label}_INVALID`);
}

function normalizeAddress(value) {
  return String(value).toLowerCase();
}

function normalizeFeeInput(estimate) {
  if (!estimate || !estimate.distribution) throw new Error("FRESH_FEE_ESTIMATE_MISSING_DISTRIBUTION");
  const feeValue = BigInt(estimate.feeValue);
  const budget = BigInt(estimate.distribution.executionBudgetPerRound);
  if (feeValue <= 0n) throw new Error("FRESH_FEE_VALUE_NOT_POSITIVE");
  if (budget <= 0n) throw new Error("FRESH_EXECUTION_BUDGET_NOT_POSITIVE");
  if (!Array.isArray(estimate.distribution.rotations)) throw new Error("FRESH_FEE_DISTRIBUTION_ROTATIONS_MISSING");
  if (estimate.distribution.leaderTimeunitsAllocation === undefined || estimate.distribution.validatorTimeunitsAllocation === undefined) {
    throw new Error("FRESH_FEE_DISTRIBUTION_LEADER_VALIDATOR_MISSING");
  }
  return {
    feeValue,
    executionBudget: budget,
    distribution: estimate.distribution,
    messageAllocations: estimate.messageAllocations ?? [],
    normalized: safeJson(estimate),
  };
}

function immutablePolicySpec() {
  return {
    policy_id: policySpec.policy_id,
    asset_sha256: policySpec.asset_sha256,
    asset_exact_bytes: policySpec.asset_exact_bytes,
    asset_media_type: policySpec.asset_media_type,
    asset_source: policySpec.asset_source,
    license_text_sha256: policySpec.license_text_sha256,
    license_text_exact_bytes: policySpec.license_text_exact_bytes,
    license_text: policySpec.license_text,
    allowed_purposes: policySpec.allowed_purposes,
    prohibited_purposes: policySpec.prohibited_purposes,
    allowed_channels: policySpec.allowed_channels,
    prohibited_contexts: policySpec.prohibited_contexts,
    transformation_rules: policySpec.transformation_rules,
    attribution_requirement: policySpec.attribution_requirement,
    endorsement_rule: policySpec.endorsement_rule,
    valid_from: policySpec.valid_from,
    valid_until: policySpec.valid_until,
    required_fee_wei: policySpec.required_fee_wei,
    settlement_recipient: policySpec.settlement_recipient,
  };
}

function expectedAuthorityDigest(proposed, publicContextUrl = "") {
  return hashJson({ reference_source: expectedReference.source, proposed_source: proposed, public_context_url: publicContextUrl });
}

function requestDigest(caseData) {
  return hashJson({
    request_id: caseData.requestId,
    policy_id: expectedPolicyId,
    policy_version: 1,
    requester: DEPLOYER,
    purpose_description: caseData.purpose,
    channel: caseData.channel,
    context_description: caseData.context,
    proposed_asset_sha256: caseData.proposedSha256,
    proposed_asset_exact_bytes: caseData.proposedBytes,
    proposed_media_type: expectedReference.mime,
    public_evidence_url: "",
    attribution_text: caseData.attribution,
    required_fee: 10,
    escrowed_value: 10,
  });
}

async function loadAccount() {
  const configPath = join(process.env.USERPROFILE ?? "", ".genlayer", "genlayer-config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.activeAccount !== expectedAccountName) throw new Error(`ACTIVE_ACCOUNT_MISMATCH:${config.activeAccount}`);
  const packagePath = join(process.env.APPDATA ?? "", "npm", "node_modules", "genlayer", "package.json");
  if (!existsSync(packagePath)) throw new Error("GENLAYER_CLI_PACKAGE_NOT_FOUND");
  const keytar = createRequire(packagePath)("keytar");
  const privateKey = await keytar.getPassword("genlayer-cli", `account:${expectedAccountName}`);
  if (typeof privateKey !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("ACCOUNT_SECRET_UNAVAILABLE_OR_INVALID");
  const account = createAccount(privateKey);
  if (normalizeAddress(account.address) !== DEPLOYER) throw new Error("SIGNER_ADDRESS_MISMATCH");
  return account;
}

const READ_RETRY_DELAYS_MS = [0, 1000, 2000, 4000];

function isServerBusyError(error) {
  return /server busy|execution slots occupied|retry later/i.test(describeError(error));
}

async function withReadOnlyRetry(label, operation) {
  let lastError;
  for (let attempt = 0; attempt < READ_RETRY_DELAYS_MS.length; attempt += 1) {
    if (READ_RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]));
    }
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isServerBusyError(error) || attempt === READ_RETRY_DELAYS_MS.length - 1) throw error;
    }
  }
  throw new Error(`${label}:READ_RETRY_EXHAUSTED:${describeError(lastError)}`);
}

async function rpc(client, method, params) {
  return withReadOnlyRetry(method, () => client.request({ method, params }));
}

async function accountState(client, address) {
  const [latestRaw, pendingRaw, balanceRaw] = await Promise.all([
    rpc(client, "eth_getTransactionCount", [address, "latest"]),
    rpc(client, "eth_getTransactionCount", [address, "pending"]),
    rpc(client, "eth_getBalance", [address, "latest"]),
  ]);
  return { latest: Number(BigInt(latestRaw)), pending: Number(BigInt(pendingRaw)), balance: BigInt(balanceRaw) };
}

async function read(client, functionName, args = []) {
  return parseContractValue(await withReadOnlyRetry(`read:${functionName}`, () => client.readContract({ address: contractAddress, functionName, args })));
}

async function ids(client, functionName) {
  const value = await read(client, functionName, [0n, 64n]);
  if (!Array.isArray(value)) throw new Error(`IDS_NOT_ARRAY:${functionName}`);
  return value;
}

async function findRecord(client, idFunction, recordFunction, predicate) {
  for (const id of await ids(client, idFunction)) {
    const record = await read(client, recordFunction, [id]);
    if (predicate(record)) return record;
  }
  return null;
}

async function fetchAndVerifyEvidence() {
  const entries = [
    { role: "REFERENCE", url: expectedReference.source, bytes: expectedReference.bytes, sha256: expectedReference.sha256 },
    ...Object.entries(evidenceCases).map(([caseId, value]) => ({ role: `CASE_${caseId}`, url: value.proposed, bytes: value.proposedBytes, sha256: value.proposedSha256 })),
  ];
  const verified = [];
  for (const entry of entries) {
    const response = await fetch(entry.url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const actual = hashBytes(bytes);
    if (response.status !== 200) throw new Error(`EVIDENCE_HTTP_STATUS:${entry.role}:${response.status}`);
    if (bytes.length !== entry.bytes) throw new Error(`EVIDENCE_BYTE_MISMATCH:${entry.role}:${bytes.length}:${entry.bytes}`);
    if (actual !== entry.sha256) throw new Error(`EVIDENCE_HASH_MISMATCH:${entry.role}:${actual}:${entry.sha256}`);
    verified.push({ ...entry, http: response.status, contentType: response.headers.get("content-type"), actualBytes: bytes.length, actualSha256: actual });
  }
  return verified;
}

function assertInitialState(status, accounting, collections, recoveredPrefixLength = 0) {
  const allowRecoveredPrefix = recoveredPrefixLength > 0;
  const expectedPolicyCount = allowRecoveredPrefix ? 1 : 0;
  requireEqual(status?.policy_count, expectedPolicyCount, `INITIAL_STATE_policy_count`);
  for (const field of ["request_count", "evidence_count", "authentication_count", "adjudication_count", "permit_count", "settlement_count", "audit_count", "sequence"]) {
    requireEqual(status?.[field], allowRecoveredPrefix && (field === "audit_count" || field === "sequence") ? recoveredPrefixLength : 0, `INITIAL_STATE_${field}`);
  }
  for (const field of ["total_escrow_received", "total_escrowed", "total_payout_allocated", "total_refund_allocated", "total_withdrawal_emitted", "conservation_rhs"]) {
    requireEqual(accounting?.[field], 0, `INITIAL_ACCOUNTING_${field}`);
  }
  for (const [key, value] of Object.entries(collections)) {
    const expectedLength = allowRecoveredPrefix && key === "policies" ? 1 : 0;
    if (!Array.isArray(value) || value.length !== expectedLength) throw new Error(`INITIAL_COLLECTION_NOT_EMPTY:${key}`);
  }
}

async function assertContractPrecondition(client, sourceBytes, abiBytes, recoveredPrefixLength = 0) {
  if (studioDevnet.id !== CHAIN_ID || studioDevnet.rpcUrls.default.http[0] !== RPC_URL) throw new Error("NETWORK_PRECONDITION_FAILED");
  if (hashBytes(sourceBytes).toUpperCase() !== CONTRACT_SHA256) throw new Error("LOCAL_CONTRACT_HASH_MISMATCH");
  if (hashBytes(abiBytes).toUpperCase() !== ABI_SHA256) throw new Error("LOCAL_ABI_HASH_MISMATCH");
  if (!sourceBytes.toString("utf8").startsWith(`# { "Depends": "${RUNNER}" }\n\n`)) throw new Error("LOCAL_RUNNER_HEADER_MISMATCH");
  const schema = await client.getContractSchema(contractAddress);
  const methods = Object.keys(schema.methods ?? {}).sort();
  const reads = methods.filter((name) => schema.methods[name]?.readonly === true);
  const writes = methods.filter((name) => schema.methods[name]?.readonly !== true);
  if (methods.length !== expectedMethods.total || reads.length !== expectedMethods.reads || writes.length !== expectedMethods.writes) throw new Error("CANONICAL_METHOD_COUNTS_MISMATCH");
  const deployedCode = await client.getContractCode(contractAddress);
  if (hashText(deployedCode).toUpperCase() !== CONTRACT_SHA256) throw new Error("DEPLOYED_SOURCE_PARITY_FAILED");
  const info = await read(client, "contract_info");
  if (info?.owner_override !== false || info?.withdrawal_supported !== false || info?.settlement_model !== "ENTITLEMENT_ALLOCATION") throw new Error("CONTRACT_INFO_TRUST_MODEL_MISMATCH");
  if (await read(client, "get_semantic_schema") !== expectedSchema) throw new Error("SEMANTIC_SCHEMA_MISMATCH");
  if (JSON.stringify(await read(client, "get_semantic_keys")) !== JSON.stringify(expectedKeys)) throw new Error("SEMANTIC_KEYS_MISMATCH");
  const status = await read(client, "get_status");
  const accounting = await read(client, "get_accounting_status");
  const collections = {
    policies: await ids(client, "get_policy_ids"),
    requests: await ids(client, "get_request_ids"),
    evidence: await ids(client, "get_evidence_ids"),
    adjudications: await ids(client, "get_adjudication_ids"),
    permits: await ids(client, "get_permit_ids"),
    settlements: await ids(client, "get_settlement_ids"),
  };
  assertInitialState(status, accounting, collections, recoveredPrefixLength);
  return { schema, methods, reads, writes, info, status, accounting, collections };
}

async function reconcile(client, hash, expectedNonce) {
  let receipt = null;
  let waitError = null;
  try {
    receipt = await client.waitForFinalization({ hash, fullTransaction: true });
  } catch (error) {
    waitError = error;
  }
  const startedAt = Date.now();
  const deadline = startedAt + 120000;
  let transaction = receipt;
  let poll = 0;
  while (true) {
    if (!statusName(transaction) || !executionName(transaction) || statusName(transaction) !== "FINALIZED") {
      transaction = await withReadOnlyRetry(`reconcile:${hash}`, () => client.getTransaction({ hash }));
    }
    if (transaction?.nonce !== undefined && Number(transaction.nonce) !== expectedNonce) throw new Error(`SUBMITTED_NONCE_MISMATCH:${transaction.nonce}:${expectedNonce}`);
    const status = statusName(transaction);
    const execution = executionName(transaction);
    if (status === "FINALIZED" && execution === "FINISHED_WITH_RETURN") return { receipt: transaction, status, execution, recoveredFromWaitError: Boolean(waitError), waitError: waitError ? describeError(waitError) : null };
    if (status === "FINALIZED" || status === "CANCELED" || (status && execution && execution !== "UNKNOWN" && execution !== "PENDING")) {
      throw new Error(`${waitError ? `${describeError(waitError)}; ` : ""}EXACT_HASH_TERMINAL_FAILURE:${status ?? "UNKNOWN"}:${execution ?? "UNKNOWN"}`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`${waitError ? `${describeError(waitError)}; ` : ""}EXACT_HASH_OPERATOR_TIMEOUT:${status ?? "UNKNOWN"}:${execution ?? "UNKNOWN"}`);
    }
    const delay = Math.min(10000, 1000 * (2 ** Math.min(poll, 3)));
    poll += 1;
    await new Promise((resolve) => setTimeout(resolve, delay));
    transaction = null;
  }
}

async function runWrite({ client, account, journal, key, method, args, value, nondeterministic, verify }) {
  if (journal.broadcast_count >= expectedWrites) throw new Error("AUTHORIZED_WRITE_LIMIT_REACHED");
  const before = await accountState(client, account.address);
  if (before.latest !== before.pending) throw new Error(`NONCE_NOT_RECONCILED_BEFORE_WRITE:${key}:${before.latest}:${before.pending}`);
  const write = buildQualificationWriteSpec({
    account,
    address: contractAddress,
    functionName: method,
    args,
    kwargs: {},
    value: value ?? 0n,
    frozenPolicyFee: QUALIFICATION_POLICY_FEE_WEI,
  });
  const estimate = await withReadOnlyRetry(`fee-estimation:${key}`, () => client.estimateTransactionFeesForWrite(write));
  const fee = normalizeFeeInput(estimate);
  if (nondeterministic && fee.executionBudget <= legacyExecutionBudgetFloor) throw new Error(`LEGACY_EXECUTION_BUDGET_REJECTED:${key}:${fee.executionBudget}`);
  const userValue = write.value;
  if (before.balance < fee.feeValue + userValue) throw new Error(`INSUFFICIENT_BALANCE:${key}`);
  const record = {
    sequence: journal.transactions.length + 1,
    key,
    method,
    args: safeJson(args),
    kwargs: safeJson(write.kwargs),
    user_value: userValue.toString(),
    nonce: before.latest,
    balance_before: before.balance.toString(),
    fee_estimate: fee.normalized,
    execution_budget: fee.executionBudget.toString(),
    fee_value: fee.feeValue.toString(),
    distribution: safeJson(fee.distribution),
    phase: "PREPARED",
    tx_hash: null,
    broadcast_count: 0,
    receipt: null,
    canonical_readback: null,
  };
  journal.transactions.push(record);
  writeJournal(journal);
  let txHash;
  try {
    txHash = await client.writeContract({
      ...write,
      fees: { distribution: fee.distribution, messageAllocations: fee.messageAllocations, feeValue: fee.feeValue },
    });
  } catch (error) {
    record.phase = "SUBMISSION_STATE_UNCERTAIN";
    record.failure = describeError(error);
    journal.failures.push({ key, phase: record.phase, error: record.failure });
    journal.phase = "STOPPED_FIRST_FAILURE";
    writeJournal(journal);
    throw new Error(`SUBMISSION_STATE_UNCERTAIN:${key}`);
  }
  if (typeof txHash !== "string" || txHash.length < 8) {
    record.phase = "INVALID_TRANSACTION_HASH";
    journal.failures.push({ key, phase: record.phase, error: String(txHash) });
    journal.phase = "STOPPED_FIRST_FAILURE";
    writeJournal(journal);
    throw new Error(`INVALID_TRANSACTION_HASH:${key}`);
  }
  record.tx_hash = txHash;
  record.broadcast_count = 1;
  record.phase = "SUBMITTED_HASH_PERSISTED";
  journal.broadcast_count += 1;
  journal.qualification_writes = journal.broadcast_count;
  writeJournal(journal);
  let final;
  try {
    record.phase = "PENDING";
    writeJournal(journal);
    final = await reconcile(client, txHash, before.latest);
  } catch (error) {
    record.phase = "FINALIZATION_OR_EXECUTION_FAILURE";
    record.failure = describeError(error);
    journal.failures.push({ key, phase: record.phase, tx_hash: txHash, error: record.failure });
    journal.phase = "STOPPED_FIRST_FAILURE";
    try { record.receipt = safeJson(await client.getTransaction({ hash: txHash })); } catch { record.receipt = null; }
    writeJournal(journal);
    throw new Error(`QUALIFICATION_STOPPED:${key}:${record.failure}`);
  }
  record.receipt = safeJson(final.receipt);
  record.status = final.status;
  record.execution_status = final.execution;
  record.recovered_from_wait_error = final.recoveredFromWaitError;
  record.wait_error = final.waitError;
  const readback = await verify();
  record.canonical_readback = safeJson(readback);
  const after = await accountState(client, account.address);
  if (after.latest !== after.pending) throw new Error(`NONCE_NOT_RECONCILED_AFTER_WRITE:${key}:${after.latest}:${after.pending}`);
  record.balance_after = after.balance.toString();
  record.phase = "COMPLETE";
  writeJournal(journal);
  return { txHash, record, receipt: final.receipt, readback };
}

async function verifyPolicy(client, expectedState) {
  const policy = await read(client, "get_policy", [expectedPolicyId]);
  if (!policy || normalizeAddress(policy.issuer) !== DEPLOYER) throw new Error("POLICY_ISSUER_MISMATCH");
  if (policy.state !== expectedState) throw new Error(`POLICY_STATE_MISMATCH:${policy.state}:${expectedState}`);
  if (policy.policy_id !== expectedPolicyId || Number(policy.version) !== 1) throw new Error("POLICY_ID_VERSION_MISMATCH");
  if (normalizeAddress(policy.settlement_recipient) !== expectedRecipient) throw new Error("POLICY_RECIPIENT_MISMATCH");
  if (String(policy.required_fee_wei) !== "10") throw new Error("POLICY_FEE_MISMATCH");
  if (policy.asset_sha256 !== expectedReference.sha256 || Number(policy.asset_exact_bytes) !== expectedReference.bytes || policy.asset_source !== expectedReference.source) throw new Error("POLICY_ASSET_BINDING_MISMATCH");
  if (policy.license_text_sha256 !== policySpec.license_text_sha256 || policy.license_text !== licenseText) throw new Error("POLICY_LICENSE_BINDING_MISMATCH");
  return policy;
}

async function verifyRequest(client, caseData) {
  const request = await read(client, "get_request", [caseData.requestId]);
  if (request.request_id !== caseData.requestId || request.policy_id !== expectedPolicyId || Number(request.policy_version) !== 1) throw new Error(`REQUEST_BINDING_MISMATCH:${caseData.requestId}`);
  if (normalizeAddress(request.requester) !== DEPLOYER || request.proposed_asset_sha256 !== caseData.proposedSha256 || Number(request.proposed_asset_exact_bytes) !== caseData.proposedBytes) throw new Error(`REQUEST_ASSET_OR_REQUESTER_MISMATCH:${caseData.requestId}`);
  if (request.request_digest !== requestDigest(caseData)) throw new Error(`REQUEST_DIGEST_MISMATCH:${caseData.requestId}`);
  return request;
}

async function verifyEvidence(client, caseData) {
  const evidence = await read(client, "get_evidence", [caseData.evidenceId]);
  if (evidence.evidence_id !== caseData.evidenceId || evidence.request_id !== caseData.requestId || evidence.policy_id !== expectedPolicyId) throw new Error(`EVIDENCE_BINDING_MISMATCH:${caseData.evidenceId}`);
  if (evidence.reference_sha256 !== expectedReference.sha256 || Number(evidence.reference_byte_length) !== expectedReference.bytes || evidence.reference_source !== expectedReference.source) throw new Error(`EVIDENCE_REFERENCE_MISMATCH:${caseData.evidenceId}`);
  if (evidence.proposed_sha256 !== caseData.proposedSha256 || Number(evidence.proposed_byte_length) !== caseData.proposedBytes || evidence.proposed_source !== caseData.proposed) throw new Error(`EVIDENCE_PROPOSED_MISMATCH:${caseData.evidenceId}`);
  if (evidence.authority_digest !== expectedAuthorityDigest(caseData.proposed)) throw new Error(`EVIDENCE_AUTHORITY_DIGEST_MISMATCH:${caseData.evidenceId}`);
  return evidence;
}

async function verifyAuth(client, caseData, expectedAuthCount) {
  const evidence = await verifyEvidence(client, caseData);
  const attempts = evidence.authentication_attempts;
  if (!Array.isArray(attempts) || attempts.length !== 1) throw new Error(`AUTH_ATTEMPT_COUNT_MISMATCH:${caseData.evidenceId}`);
  if (attempts[0].status !== "AUTHENTICATED") throw new Error(`AUTHENTICATION_NOT_SUCCESSFUL:${caseData.evidenceId}:${attempts[0].status}`);
  const status = await read(client, "get_status");
  requireEqual(status.authentication_count, expectedAuthCount, `AUTHENTICATION_COUNT:${caseData.evidenceId}`);
  return { evidence, authentication: attempts[0], status };
}

async function verifyAdjudication(client, caseData, expectedAdjudicationCount) {
  const adjudication = await findRecord(client, "get_adjudication_ids", "get_adjudication", (record) => record?.request_id === caseData.requestId);
  if (!adjudication) throw new Error(`ADJUDICATION_NOT_FOUND:${caseData.requestId}`);
  if (adjudication.policy_id !== expectedPolicyId || adjudication.evidence_id !== caseData.evidenceId || Number(adjudication.policy_version) !== 1 || Number(adjudication.generation) !== 1 || adjudication.semantic_schema !== expectedSchema) throw new Error(`ADJUDICATION_BINDING_MISMATCH:${caseData.requestId}`);
  if (!adjudication.semantic_vector || Object.keys(adjudication.semantic_vector).length !== 7 || expectedKeys.some((key) => typeof adjudication.semantic_vector[key] !== "boolean")) throw new Error(`ADJUDICATION_VECTOR_INVALID:${caseData.requestId}`);
  if (!["PERMITTED", "DENIED", "INCONCLUSIVE", "NOT_APPLICABLE"].includes(adjudication.result)) throw new Error(`ADJUDICATION_RESULT_INVALID:${caseData.requestId}`);
  const status = await read(client, "get_status");
  requireEqual(status.adjudication_count, expectedAdjudicationCount, `ADJUDICATION_COUNT:${caseData.requestId}`);
  return { adjudication, status };
}

async function verifySettlement(client, caseData, adjudication) {
  const settlement = await findRecord(client, "get_settlement_ids", "get_settlement", (record) => record?.request_id === caseData.requestId);
  if (!settlement) throw new Error(`SETTLEMENT_NOT_FOUND:${caseData.requestId}`);
  const request = await read(client, "get_request", [caseData.requestId]);
  if (request.state !== "SETTLED" || String(request.escrowed_value) !== "0" || String(request.escrow_consumed) !== "10") throw new Error(`SETTLEMENT_REQUEST_STATE_INVALID:${caseData.requestId}`);
  const permit = await findRecord(client, "get_permit_ids", "get_permit", (record) => record?.request_id === caseData.requestId);
  if (adjudication.result === "PERMITTED") {
    if (settlement.settlement_type !== "PAYOUT_ALLOCATED" || settlement.recipient.toLowerCase() !== expectedRecipient || String(settlement.amount) !== "10" || !permit) throw new Error(`PAYOUT_ENTITLEMENT_INVALID:${caseData.requestId}`);
  } else {
    if (settlement.settlement_type !== "REFUND_ALLOCATED" || settlement.recipient.toLowerCase() !== DEPLOYER || String(settlement.amount) !== "10" || permit) throw new Error(`REFUND_ENTITLEMENT_INVALID:${caseData.requestId}`);
  }
  return { request, settlement, permit };
}

function caseRequestArgs(caseData) {
  return [caseData.requestId, expectedPolicyId, 1n, caseData.purpose, caseData.channel, caseData.context, caseData.proposedSha256, BigInt(caseData.proposedBytes), expectedReference.mime, "", caseData.attribution];
}

function caseEvidenceArgs(caseData) {
  return [caseData.evidenceId, caseData.requestId, expectedReference.source, expectedReference.sha256, BigInt(expectedReference.bytes), expectedReference.mime, caseData.proposed, caseData.proposedSha256, BigInt(caseData.proposedBytes), expectedReference.mime, "", "", "", expectedAuthorityDigest(caseData.proposed), caseData.attribution];
}

async function main() {
  if (studioDevnet.id !== CHAIN_ID || studioDevnet.rpcUrls.default.http[0] !== RPC_URL) throw new Error("NETWORK_GUARD_FAILED");
  let prior = null;
  let resumedAfterExactHashReconciliation = false;
  let recoveredPrefixLength = 0;
  if (existsSync(journalPath)) {
    prior = JSON.parse(readFileSync(journalPath, "utf8"));
    if (Number(prior.broadcast_count ?? 0) !== 0) {
      recoveredPrefixLength = Number(prior.broadcast_count);
      if (prior.phase !== "STOPPED_FIRST_FAILURE" || recoveredPrefixLength < 1 || recoveredPrefixLength >= expectedWrites || prior.transactions?.length !== recoveredPrefixLength) {
        throw new Error("QUALIFICATION_ALREADY_STARTED_NO_RETRY");
      }
      for (let index = 0; index < recoveredPrefixLength; index += 1) {
        if (prior.transactions[index]?.key !== orderedWriteKeys[index]) throw new Error("QUALIFICATION_PREFIX_ORDER_MISMATCH");
      }
      resumedAfterExactHashReconciliation = true;
    }
  }
  policySpec.license_text_sha256 = hashText(licenseText);
  const sourceBytes = readFileSync(sourcePath);
  const abiBytes = readFileSync(abiPath);
  const account = await loadAccount();
  const client = createClient({ chain: studioDevnet, account });
  if (process.argv.includes("--case-a-preflight")) {
    const preflight = await assertContractPrecondition(client, sourceBytes, abiBytes, 2);
    const publicEvidence = await fetchAndVerifyEvidence();
    const policy = await verifyPolicy(client, "FROZEN");
    const caseData = evidenceCases.A;
    const write = buildQualificationWriteSpec({
      account,
      address: contractAddress,
      functionName: "submit_usage_request",
      args: caseRequestArgs(caseData),
      kwargs: {},
      value: QUALIFICATION_POLICY_FEE_WEI,
      frozenPolicyFee: BigInt(policy.required_fee_wei),
    });
    const estimate = await withReadOnlyRetry("fee-estimation:case-A:preflight", () => client.estimateTransactionFeesForWrite(write));
    const fee = normalizeFeeInput(estimate);
    console.log(JSON.stringify(safeJson({
      case_a_preflight: "PASS",
      canonical_precondition: preflight,
      evidence: publicEvidence.find((item) => item.role === "CASE_A"),
      policy: { policy_id: policy.policy_id, state: policy.state, version: policy.version, required_fee_wei: policy.required_fee_wei },
      write_spec: write,
      estimate: fee.normalized,
      user_value: write.value,
      fee_value: fee.feeValue,
      distribution: fee.distribution,
    }), null, 2));
    return;
  }
  const preflight = await assertContractPrecondition(client, sourceBytes, abiBytes, recoveredPrefixLength);
  const publicEvidence = await fetchAndVerifyEvidence();
  const before = await accountState(client, account.address);
  if (before.latest !== before.pending) throw new Error(`NONCE_NOT_RECONCILED_BEFORE_NEXT_WRITE:${before.latest}:${before.pending}`);
  const frozenPolicyDigest = hashJson(immutablePolicySpec());
  let journal;
  if (resumedAfterExactHashReconciliation) {
    journal = prior;
    if (normalizeAddress(journal.signer) !== DEPLOYER || normalizeAddress(journal.settlement_recipient) !== expectedRecipient) throw new Error("RECOVERY_SIGNER_OR_RECIPIENT_MISMATCH");
    for (const record of journal.transactions) {
      const transaction = await client.getTransaction({ hash: record.tx_hash });
      if (statusName(transaction) !== "FINALIZED" || executionName(transaction) !== "FINISHED_WITH_RETURN") throw new Error(`EXACT_HASH_RECOVERY_NOT_SUCCESSFUL:${record.key}`);
      record.receipt = safeJson(transaction);
      record.status = statusName(transaction);
      record.execution_status = executionName(transaction);
      record.phase = "COMPLETE";
      record.reconciled_after_wait_timeout = true;
    }
    const policyState = recoveredPrefixLength >= 2 ? "FROZEN" : "DRAFT";
    const policy = await verifyPolicy(client, policyState);
    journal.transactions[0].canonical_readback = safeJson(recoveredPrefixLength >= 1 ? policy : null);
    if (recoveredPrefixLength >= 2) journal.transactions[1].canonical_readback = safeJson(policy);
    journal.policy_create_tx = journal.transactions[0].tx_hash;
    if (recoveredPrefixLength >= 2) journal.policy_freeze_tx = journal.transactions[1].tx_hash;
    journal.policy_id = expectedPolicyId;
    journal.recovery = {
      mode: "EXACT_HASH_READ_ONLY_RECONCILIATION",
      original_wait_outcome: "SDK_TIMEOUT_WITH_STALE_STATUS",
      recovered_prefix_length: recoveredPrefixLength,
      authoritative_status: "FINALIZED",
      authoritative_execution: "FINISHED_WITH_RETURN",
      next_write_nonce: before.latest,
    };
    journal.public_evidence = publicEvidence;
    journal.pre_resume_readback = safeJson(preflight);
    journal.resume_nonce_before_next_write = before.latest;
    journal.resume_balance_before_next_write = before.balance.toString();
    journal.phase = "RESUMED_AFTER_EXACT_HASH_RECONCILIATION";
    writeJournal(journal);
  } else {
    journal = {
      schema_version: 1,
      phase: "PRECONDITION_VERIFIED",
      network: "studio-dev",
      chain_id: CHAIN_ID,
      rpc: RPC_URL,
      contract_address: contractAddress,
      signer: account.address,
      settlement_recipient: expectedRecipient,
      contract_sha256: CONTRACT_SHA256,
      abi_sha256: ABI_SHA256,
      runner: RUNNER,
      semantic_schema: expectedSchema,
      semantic_keys: expectedKeys,
      policy: { ...policySpec, policy_digest: frozenPolicyDigest },
      public_evidence: publicEvidence,
      initial_state: safeJson(preflight),
      nonce_start: before.latest,
      balance_start: before.balance.toString(),
      nonce_end: null,
      balance_end: null,
      expected_writes: expectedWrites,
      qualification_writes: 0,
      unexpected_writes: 0,
      broadcast_count: 0,
      transactions: [],
      cases: {},
      failures: [],
      result_shopping: false,
      adjudication_retries: 0,
      rebroadcasts: 0,
    };
    writeJournal(journal);
  }

  const policyArgs = [
    policySpec.policy_id,
    policySpec.asset_sha256,
    BigInt(policySpec.asset_exact_bytes),
    policySpec.asset_media_type,
    policySpec.asset_source,
    policySpec.license_text_sha256,
    BigInt(policySpec.license_text_exact_bytes),
    policySpec.license_text,
    policySpec.allowed_purposes,
    policySpec.prohibited_purposes,
    policySpec.allowed_channels,
    policySpec.prohibited_contexts,
    policySpec.transformation_rules,
    policySpec.attribution_requirement,
    policySpec.endorsement_rule,
    BigInt(policySpec.valid_from),
    BigInt(policySpec.valid_until),
    BigInt(policySpec.required_fee_wei),
    policySpec.settlement_recipient,
  ];
  if (recoveredPrefixLength < 1) {
    const policyCreate = await runWrite({ client, account, journal, key: "policy:create", method: "create_policy", args: policyArgs, verify: () => verifyPolicy(client, "DRAFT") });
    journal.policy_create_tx = policyCreate.txHash;
    journal.policy_id = expectedPolicyId;
    writeJournal(journal);
  }
  if (recoveredPrefixLength < 2) {
    const policyFreeze = await runWrite({ client, account, journal, key: "policy:freeze", method: "freeze_policy", args: [expectedPolicyId], verify: () => verifyPolicy(client, "FROZEN") });
    journal.policy_freeze_tx = policyFreeze.txHash;
  }
  journal.policy_state = "FROZEN";
  journal.policy_version = 1;
  writeJournal(journal);

  let authCount = 0;
  let adjudicationCount = 0;
  for (const caseId of ["A", "B", "C", "D"]) {
    const caseData = evidenceCases[caseId];
    const caseJournal = { expected_result: caseData.expected, request_id: caseData.requestId, evidence_id: caseData.evidenceId, transactions: [] };
    journal.cases[caseId] = caseJournal;
    writeJournal(journal);
    const request = await runWrite({ client, account, journal, key: `case-${caseId}:submit_usage_request`, method: "submit_usage_request", args: caseRequestArgs(caseData), value: 10n, verify: () => verifyRequest(client, caseData) });
    caseJournal.submit_tx = request.txHash;
    const evidence = await runWrite({ client, account, journal, key: `case-${caseId}:commit_evidence`, method: "commit_evidence", args: caseEvidenceArgs(caseData), verify: () => verifyEvidence(client, caseData) });
    caseJournal.commit_tx = evidence.txHash;
    authCount += 1;
    const auth = await runWrite({ client, account, journal, key: `case-${caseId}:authenticate_evidence`, method: "authenticate_evidence", args: [caseData.evidenceId], nondeterministic: true, verify: () => verifyAuth(client, caseData, authCount) });
    caseJournal.authenticate_tx = auth.txHash;
    adjudicationCount += 1;
    const adjudication = await runWrite({ client, account, journal, key: `case-${caseId}:adjudicate_usage`, method: "adjudicate_usage", args: [caseData.requestId], nondeterministic: true, verify: () => verifyAdjudication(client, caseData, adjudicationCount) });
    caseJournal.adjudicate_tx = adjudication.txHash;
    const adjudicationReadback = adjudication.readback.adjudication;
    caseJournal.adjudication_id = adjudicationReadback.adjudication_id;
    caseJournal.semantic_vector = adjudicationReadback.semantic_vector;
    caseJournal.result = adjudicationReadback.result;
    const settlement = await runWrite({ client, account, journal, key: `case-${caseId}:settle_request`, method: "settle_request", args: [caseData.requestId], verify: () => verifySettlement(client, caseData, adjudicationReadback) });
    caseJournal.settle_tx = settlement.txHash;
    caseJournal.settlement_id = settlement.readback.settlement.settlement_id;
    caseJournal.entitlement = settlement.readback.settlement.settlement_type;
    caseJournal.permit_id = settlement.readback.permit?.permit_id ?? null;
    caseJournal.canonical = true;
    writeJournal(journal);
  }

  const finalStatus = await read(client, "get_status");
  const finalAccounting = await read(client, "get_accounting_status");
  const finalPolicy = await read(client, "get_policy", [expectedPolicyId]);
  const finalCollections = {
    policies: await ids(client, "get_policy_ids"),
    requests: await ids(client, "get_request_ids"),
    evidence: await ids(client, "get_evidence_ids"),
    adjudications: await ids(client, "get_adjudication_ids"),
    permits: await ids(client, "get_permit_ids"),
    settlements: await ids(client, "get_settlement_ids"),
  };
  const actualPermitted = Object.values(journal.cases).filter((item) => item.result === "PERMITTED").length;
  if (finalPolicy.state !== "FROZEN" || finalCollections.policies.length !== 1 || finalCollections.requests.length !== 4 || finalCollections.evidence.length !== 4 || finalCollections.adjudications.length !== 4 || finalCollections.settlements.length !== 4 || finalCollections.permits.length !== actualPermitted) throw new Error("FINAL_COUNTS_OR_POLICY_ASSERTION_FAILED");
  requireEqual(finalStatus.policy_count, 1, "FINAL_POLICY_COUNT");
  requireEqual(finalStatus.request_count, 4, "FINAL_REQUEST_COUNT");
  requireEqual(finalStatus.evidence_count, 4, "FINAL_EVIDENCE_COUNT");
  requireEqual(finalStatus.authentication_count, 4, "FINAL_AUTHENTICATION_COUNT");
  requireEqual(finalStatus.adjudication_count, 4, "FINAL_ADJUDICATION_COUNT");
  requireEqual(finalStatus.settlement_count, 4, "FINAL_SETTLEMENT_COUNT");
  requireEqual(finalStatus.total_escrow_received, 40, "FINAL_ESCROW_RECEIVED");
  requireEqual(finalStatus.total_escrowed, 0, "FINAL_ESCROW_REMAINING");
  requireEqual(finalAccounting.conservation_rhs, 40, "FINAL_ACCOUNTING_CONSERVATION_RHS");
  requireEqual(finalAccounting.total_payout_allocated, actualPermitted * 10, "FINAL_PAYOUT_TOTAL");
  requireEqual(finalAccounting.total_refund_allocated, (4 - actualPermitted) * 10, "FINAL_REFUND_TOTAL");
  requireEqual(finalAccounting.total_withdrawal_emitted, 0, "FINAL_WITHDRAWAL_TOTAL");
  const after = await accountState(client, account.address);
  if (after.latest !== after.pending) throw new Error(`FINAL_NONCE_NOT_RECONCILED:${after.latest}:${after.pending}`);
  journal.phase = "QUALIFICATION_VERIFIED_STOP";
  journal.final_status = safeJson(finalStatus);
  journal.final_accounting = safeJson(finalAccounting);
  journal.final_collections = safeJson(finalCollections);
  journal.final_policy = safeJson(finalPolicy);
  journal.nonce_end = after.latest;
  journal.balance_end = after.balance.toString();
  journal.permit_count = actualPermitted;
  journal.live_qualification_verdict = "SUCCESSFUL_CANONICAL_QUALIFICATION";
  journal.stop_reason = "POST_QUALIFICATION_READ_ONLY_AUDIT_COMPLETE";
  writeJournal(journal);
  console.log(JSON.stringify(safeJson({
    contract_address: contractAddress,
    signer: account.address,
    settlement_recipient: expectedRecipient,
    nonce_start: journal.nonce_start,
    nonce_end: journal.nonce_end,
    balance_start: journal.balance_start,
    balance_end: journal.balance_end,
    policy_id: expectedPolicyId,
    policy_create_tx: journal.policy_create_tx,
    policy_freeze_tx: journal.policy_freeze_tx,
    policy_state: finalPolicy.state,
    policy_version: finalPolicy.version,
    policy_digest: frozenPolicyDigest,
    cases: journal.cases,
    final_policy_count: finalCollections.policies.length,
    final_request_count: finalCollections.requests.length,
    final_evidence_count: finalCollections.evidence.length,
    final_adjudication_count: finalCollections.adjudications.length,
    final_permit_count: finalCollections.permits.length,
    final_settlement_count: finalCollections.settlements.length,
    total_escrow_received: finalAccounting.total_escrow_received,
    total_payout_allocated: finalAccounting.total_payout_allocated,
    total_refund_allocated: finalAccounting.total_refund_allocated,
    live_escrow_remaining: finalAccounting.total_escrowed,
    accounting_conservation: finalAccounting.conservation_rhs,
    qualification_writes: journal.qualification_writes,
    expected_writes: expectedWrites,
    unexpected_writes: journal.unexpected_writes,
    failures: journal.failures,
    result_shopping: journal.result_shopping,
    adjudication_retries: journal.adjudication_retries,
    rebroadcasts: journal.rebroadcasts,
    live_qualification_verdict: journal.live_qualification_verdict,
    stop_reason: journal.stop_reason,
  }), null, 2));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ error: describeError(error), qualification_writes: existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, "utf8")).qualification_writes ?? 0 : 0, stop_reason: "QUALIFICATION_STOPPED_NO_RETRY" }, null, 2));
  process.exitCode = 1;
}
