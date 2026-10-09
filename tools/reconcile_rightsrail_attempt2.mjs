import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ABI_SHA256,
  CHAIN_ID,
  CONTRACT_SHA256,
  DEPLOYER,
  RPC_URL,
  RUNNER,
} from "./deployment_fee_policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdkBase = "C:/Users/DELL/CharterLock/frontend/node_modules/genlayer-js/dist/";
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-deployment-attempt-2.json");
const abiPath = join(root, "artifacts", "rightsrail.abi.json");
const expectedHash = "0x7166a52cc76262d251ab1279cd476028d9eb5e230357047381df7f888ee2fa70";
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

const { createClient } = await import(pathToFileURL(join(sdkBase, "index.js")));
const { studioDevnet } = await import(pathToFileURL(join(sdkBase, "chains", "index.js")));

function safeJson(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(safeJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safeJson(v)]));
  return value;
}

function writeJournal(value) {
  writeFileSync(journalPath, `${JSON.stringify(safeJson(value), null, 2)}\n`, "utf8");
}

function hashText(value) {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex").toUpperCase();
}

function parseValue(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

async function read(client, address, functionName, args = []) {
  return parseValue(await client.readContract({ address, functionName, args }));
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function executionName(tx) {
  return tx?.txExecutionResultName ?? tx?.executionResultName ?? tx?.execution_result ?? null;
}

function assertZeroAccounting(value) {
  for (const field of ["total_escrow_received", "total_escrowed", "total_payout_allocated", "total_refund_allocated", "total_withdrawal_emitted", "conservation_rhs"]) {
    if (String(value?.[field]) !== "0") throw new Error(`INITIAL_ACCOUNTING_NOT_ZERO:${field}`);
  }
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
if (journal.tx_hash !== expectedHash || journal.broadcast_count !== 1) throw new Error("ATTEMPT_2_HASH_OR_BROADCAST_GUARD_FAILED");
if (studioDevnet.id !== CHAIN_ID || studioDevnet.rpcUrls.default.http[0] !== RPC_URL) throw new Error("NETWORK_GUARD_FAILED");

const client = createClient({ chain: studioDevnet });
const tx = await client.getTransaction({ hash: expectedHash });
if (tx.statusName !== "FINALIZED") throw new Error(`TX_NOT_FINALIZED:${tx.statusName}`);
if (executionName(tx) !== "FINISHED_WITH_RETURN") throw new Error(`EXECUTION_NOT_SUCCESSFUL:${executionName(tx)}`);
if (tx.nonce !== 14) throw new Error(`DEPLOYMENT_NONCE_MISMATCH:${tx.nonce}`);
if (String(tx.from_address).toLowerCase() !== DEPLOYER) throw new Error("DEPLOYER_MISMATCH");

const address = tx.data?.contract_address;
if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("CANONICAL_ADDRESS_MISSING");
const schema = await client.getContractSchema(address);
const localAbi = JSON.parse(readFileSync(abiPath, "utf8"));
const deployedMethods = Object.keys(schema.methods ?? {}).sort();
const localMethods = Object.keys(localAbi.methods ?? {}).sort();
if (deployedMethods.length !== 30 || localMethods.length !== 30) throw new Error("PUBLIC_METHOD_COUNT_MISMATCH");
if (JSON.stringify(deployedMethods) !== JSON.stringify(localMethods)) throw new Error("ABI_METHOD_NAMES_MISMATCH");
const readMethods = deployedMethods.filter((name) => schema.methods[name]?.readonly === true);
const writeMethods = deployedMethods.filter((name) => schema.methods[name]?.readonly !== true);
if (readMethods.length !== 21 || writeMethods.length !== 9) throw new Error("PUBLIC_READ_WRITE_COUNT_MISMATCH");

const info = await read(client, address, "contract_info");
const status = await read(client, address, "get_status");
const accounting = await read(client, address, "get_accounting_status");
const semanticSchema = await read(client, address, "get_semantic_schema");
const semanticKeys = await read(client, address, "get_semantic_keys");
if (semanticSchema !== expectedSemanticSchema) throw new Error("SEMANTIC_SCHEMA_MISMATCH");
if (JSON.stringify(semanticKeys) !== JSON.stringify(expectedSemanticKeys)) throw new Error("SEMANTIC_KEYS_MISMATCH");
for (const field of ["policy_count", "request_count", "evidence_count", "authentication_count", "adjudication_count", "permit_count", "settlement_count", "audit_count", "sequence"]) {
  if (String(status?.[field]) !== "0") throw new Error(`INITIAL_STATE_NOT_EMPTY:${field}`);
}
assertZeroAccounting(accounting);
for (const [name, fn] of [
  ["policy", "get_policy_ids"],
  ["request", "get_request_ids"],
  ["evidence", "get_evidence_ids"],
  ["adjudication", "get_adjudication_ids"],
  ["permit", "get_permit_ids"],
  ["settlement", "get_settlement_ids"],
]) {
  if (!isEmpty(await read(client, address, fn, [0n, 64n]))) throw new Error(`INITIAL_${name.toUpperCase()}_IDS_NOT_EMPTY`);
}
if (info?.semantic_schema !== expectedSemanticSchema || info?.owner_override !== false || info?.withdrawal_supported !== false) throw new Error("CONTRACT_INFO_PARITY_FAILED");

const deployedCode = await client.getContractCode(address);
const deployedSourceSha = hashText(deployedCode);
if (deployedSourceSha !== CONTRACT_SHA256) throw new Error("DEPLOYED_SOURCE_PARITY_FAILED");
if (!String(deployedCode).startsWith(`# { "Depends": "${RUNNER}" }`)) throw new Error("DEPLOYED_RUNNER_PARITY_FAILED");

const [latestRaw, pendingRaw, balanceRaw] = await Promise.all([
  client.request({ method: "eth_getTransactionCount", params: [DEPLOYER, "latest"] }),
  client.request({ method: "eth_getTransactionCount", params: [DEPLOYER, "pending"] }),
  client.request({ method: "eth_getBalance", params: [DEPLOYER, "latest"] }),
]);
journal.status = tx.statusName;
journal.execution_status = executionName(tx);
journal.result_name = tx.result_name;
journal.contract_address = address;
journal.submitted_nonce = tx.nonce;
journal.source_parity = true;
journal.abi_parity = true;
journal.runner_parity = true;
journal.public_method_count = deployedMethods.length;
journal.public_read_methods = readMethods.length;
journal.public_write_methods = writeMethods.length;
journal.semantic_schema = semanticSchema;
journal.semantic_keys = semanticKeys;
journal.initial_state_verified = true;
journal.accounting_initial_state_verified = true;
journal.deployed_source_sha256 = deployedSourceSha;
journal.balance_after = BigInt(balanceRaw).toString();
journal.latest_nonce_after = Number(BigInt(latestRaw));
journal.pending_nonce_after = Number(BigInt(pendingRaw));
journal.fee_accounting_summary = {
  paid_fee_value: tx.data?.fee_accounting?.paid_fee_value,
  primary_fee_spent: tx.data?.fee_accounting?.primary_fee_spent,
  total_refunded: tx.data?.fee_accounting?.total_refunded,
  execution_budget_per_round: tx.data?.fee_accounting?.execution_fee_report?.chargeableExecution?.executionBudgetPerRound,
  execution_budget_overrun: tx.data?.fee_accounting?.execution_fee_report?.chargeableExecution?.executionBudgetOverrun,
  execution_budget_exceeded: tx.data?.fee_accounting?.execution_fee_report?.chargeableExecution?.executionBudgetExceeded,
  nondeterministic_output_bytes: tx.data?.fee_accounting?.execution_fee_report?.genvmBuckets?.nondeterministicOutputBytes,
};
journal.phase = "DEPLOYMENT_VERIFIED_STOP";
journal.deployment_verdict = "SUCCESSFUL_DEPLOYMENT_ONLY_NO_QUALIFICATION";
writeJournal(journal);

console.log(JSON.stringify({
  deployment_tx: expectedHash,
  tx_status: journal.status,
  execution_status: journal.execution_status,
  result_name: journal.result_name,
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
