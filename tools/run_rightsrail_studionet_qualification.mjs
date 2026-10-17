import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ABI_SHA256, CHAIN_ID, CONTRACT_SHA256, DEPLOYER, NETWORK_ALIAS, RPC_URL, RUNNER } from "./studionet_candidate.mjs";
import { buildQualificationWriteSpec } from "./qualification_write_spec.mjs";
import { canonical } from "./qualification_runner_utils.mjs";
import { assertStudionetConfig, executionName, loadConfiguredAccount, NETWORK, pollFinal, readClient as createStudionetClient, requireGaslessFeeEstimate, simulateStudionetWrite, safeJson as jsonSafe } from "./genlayer_studionet.mjs";
import {
  assertAbiShape,



} from "./rightsrail_v24_gate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail_studionet.py");
const abiPath = join(root, "artifacts", "rightsrail-studionet.abi.json");
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-studionet-qualification.json");
const deploymentJournalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-studionet-deployment.json");
let address = null;
const schema = "RIGHTSRAIL_USAGE_V1";
const keys = ["asset_match", "purpose_within_scope", "prohibited_context_present", "transformation_within_scope", "attribution_satisfied", "endorsement_implied", "evidence_sufficient"];
const issuerName = "firewall-only";
const requesterName = "agentpact-requester";
const operatorName = "agentpact-reader";
const issuer = DEPLOYER.toLowerCase();
const requester = "0x61f10cc252ed98ce7596c73fc557cca4cc600c82";
let requesterCanonical;
const operator = "0x0291e33706b7cae6ad332a28f66e7f3e6f634d58";
const fee = 10n;
const expected = { total: 36, reads: 24, writes: 12 };
const evidence = {
  reference: { url: "https://rightsrail-evidence.vercel.app/reference.png", sha: "e0d804ab77a13f6f892b564f58656e72bf4daff123225b58cb637537b2aad0c8", bytes: 35344 },
  A: { request: "v241-request-case-a", evidence: "v241-evidence-case-a", url: "https://rightsrail-evidence.vercel.app/proposed-editorial.png", sha: "da782460a0de765d49ebcbe4f116cfab0c42b42d3aea99e4bfc3763e5b63f223", bytes: 52132, expected: "PERMITTED", purpose: "Commercial technology newsletter editorial use", channel: "newsletter", context: "Independent editorial article with no endorsement or recommendation.", attribution: "Image courtesy of Lumen Finch Studio" },
  B: { request: "v241-request-case-b", evidence: "v241-evidence-case-b", url: "https://rightsrail-evidence.vercel.app/proposed-betting.png", sha: "bf7799c32a4d8a46f5def7c06e39e1926c2e49df2461b35ea6111026699fef89", bytes: 48481, expected: "DENIED", purpose: "Commercial betting promotion", channel: "paid social advertisement", context: "Commercial gambling offer presented as a recommendation.", attribution: "Image courtesy of Lumen Finch Studio" },
  C: { request: "v241-request-case-c", evidence: "v241-evidence-case-c", url: "https://rightsrail-evidence.vercel.app/proposed-missing-context.png", sha: "a9f99ccd842e6ce2dd664d0aea21c94538a3eba40bf93040ab9fcb0158fe2584", bytes: 32221, expected: "INCONCLUSIVE", purpose: "Commercial technology newsletter editorial use", channel: "newsletter", context: "The surrounding context was unavailable during capture.", attribution: "" },
  D: { request: "v241-request-case-d", evidence: "v241-evidence-case-d", url: "https://rightsrail-evidence.vercel.app/unrelated.png", sha: "5d6cfa94971725d3d367a2c18d8cababd31668b0f3d33ed6d96712d222fb993d", bytes: 41410, expected: "NOT_APPLICABLE", purpose: "Commercial technology newsletter editorial use", channel: "newsletter", context: "Unrelated asset supplied with otherwise sufficient evidence.", attribution: "Image courtesy of Lumen Finch Studio" },
};

function assertCandidateBytes({sourceBytes, abiBytes}) {
  if (sha(sourceBytes).toUpperCase() !== CONTRACT_SHA256 || sha(abiBytes).toUpperCase() !== ABI_SHA256) throw new Error("CANDIDATE_HASH_MISMATCH");
}
function assertQualificationBound(journal) { if (journal.broadcast_count > 40) throw new Error("QUALIFICATION_WRITE_BOUND"); }
function createV24Journal() { return { schema: "RIGHTSRAIL_STUDIONET_QUALIFICATION_V1", version: "2.4.1", transactions: [], failures: [], broadcast_count: 0, qualification_writes: 0, cases: {} }; }
function errText(e) { return e instanceof Error ? e.name + ": " + e.message : String(e); }
function sha(v) { return createHash("sha256").update(v).digest("hex"); }
function textHash(v) { return sha(Buffer.from(v, "utf8")); }
function jsonHash(v) { return textHash(canonical(v)); }
function lower(v) { return String(v).toLowerCase(); }
function eq(a, b, label) { if (String(a) !== String(b)) throw new Error(label + ":" + a + ":" + b); }
function parse(v) { if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } } return v; }
function status(v) { return v?.statusName ?? v?.status ?? v?.consensusStatus ?? null; }
function execution(v) { return executionName(v); }
function journalWrite(j) { writeFileSync(journalPath, JSON.stringify(jsonSafe(j), null, 2) + "\n", "utf8"); }
function busy(e) { return /server busy|execution slots occupied|retry later/i.test(errText(e)); }

async function retry(label, fn) {
  let last;
  for (const wait of [0, 1000, 2000, 4000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try { return await fn(); } catch (e) { last = e; if (!busy(e)) throw e; }
  }
  throw new Error(label + ":READ_RETRY_EXHAUSTED:" + errText(last));
}
async function rpc(method, params) {
  return retry(method, async () => {
    const res = await fetch(RPC_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
    if (!res.ok) throw new Error("RPC_HTTP_" + res.status);
    const body = await res.json();
    if (body.error) throw new Error("RPC_" + body.error.code + ":" + body.error.message);
    return body.result;
  });
}
async function loadAccount(name) {
  const expectedAddress = name === issuerName ? issuer : name === requesterName ? requester : operator;
  return loadConfiguredAccount(name, expectedAddress);
}
async function state(client, addr) {
  const vals = await Promise.all([
    rpc("eth_getTransactionCount", [addr, "latest"]),
    rpc("eth_getTransactionCount", [addr, "pending"]),
    rpc("eth_getBalance", [addr, "latest"]),
  ]);
  return { latest: Number(BigInt(vals[0])), pending: Number(BigInt(vals[1])), balance: BigInt(vals[2]) };
}
async function read(client, method, args = []) {
  return parse(await retry("read:" + method, () => client.readContract({ address, functionName: method, args })));
}
async function ids(client, method) {
  const result = await read(client, method, [0n, 64n]);
  if (!Array.isArray(result)) throw new Error("IDS_NOT_ARRAY:" + method);
  return result;
}
async function find(client, idMethod, recordMethod, predicate) {
  for (const id of await ids(client, idMethod)) {
    const record = await read(client, recordMethod, [id]);
    if (predicate(record)) return record;
  }
  return null;
}
async function chainNow() {
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  if (!block?.timestamp) throw new Error("CHAIN_TIME_UNAVAILABLE");
  return Number(BigInt(block.timestamp));
}
async function verifyPublicEvidence() {
  const list = [{ role: "REFERENCE", url: evidence.reference.url, sha: evidence.reference.sha, bytes: evidence.reference.bytes }, ...Object.entries(evidence).filter(([k]) => k !== "reference").map(([k, v]) => ({ role: "CASE_" + k, url: v.url, sha: v.sha, bytes: v.bytes }))];
  const verified = [];
  for (const item of list) {
    const res = await fetch(item.url);
    const body = Buffer.from(await res.arrayBuffer());
    if (res.status !== 200 || !String(res.headers.get("content-type") ?? "").toLowerCase().startsWith("image/png") || body.length !== item.bytes || sha(body) !== item.sha || body.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("PUBLIC_EVIDENCE_MISMATCH:" + item.role);
    verified.push({ role: item.role, url: item.url, http: res.status, mime: res.headers.get("content-type"), bytes: body.length, sha256: sha(body) });
  }
  return verified;
}
function policyFor(now) {
  const license = "Commercial editorial/web use; cropping and color adjustment allowed; attribution required; gambling promotion, synthetic endorsement, and impersonation prohibited.";
  return {
    policy_id: "policy-v241-lumen-finch-001", asset_sha256: evidence.reference.sha, asset_exact_bytes: evidence.reference.bytes,
    asset_media_type: "image/png", asset_source: evidence.reference.url, license_text_sha256: textHash(license),
    license_text_exact_bytes: Buffer.byteLength(license, "utf8"), license_text: license,
    allowed_purposes: ["commercial editorial", "technology newsletter", "web article"],
    prohibited_purposes: ["gambling promotion", "impersonation"], allowed_channels: ["article", "editorial web", "newsletter"],
    prohibited_contexts: ["betting advertisement", "gambling promotion", "synthetic endorsement", "impersonation"],
    transformation_rules: ["color changes allowed", "cropping allowed"], attribution_requirement: "Visible attribution required",
    endorsement_rule: "Synthetic endorsement prohibited", valid_from: now - 3600, valid_until: now + 30 * 24 * 60 * 60,
    required_fee_wei: fee, settlement_recipient: issuer,
  };
}
function policyArgs(p) {
  return [p.policy_id, p.asset_sha256, BigInt(p.asset_exact_bytes), p.asset_media_type, p.asset_source, p.license_text_sha256, BigInt(p.license_text_exact_bytes), p.license_text, p.allowed_purposes, p.prohibited_purposes, p.allowed_channels, p.prohibited_contexts, p.transformation_rules, p.attribution_requirement, p.endorsement_rule, BigInt(p.valid_from), BigInt(p.valid_until), fee, p.settlement_recipient];
}
function authority(proposed) { return jsonHash({ reference_source: evidence.reference.url, proposed_source: proposed, public_context_url: "" }); }
function requestDigest(item) {
  return jsonHash({ policy_id: "policy-v241-lumen-finch-001", policy_version: 1, requester: requesterCanonical, purpose_description: item.purpose, channel: item.channel, context_description: item.context, proposed_asset_sha256: item.sha, proposed_asset_exact_bytes: item.bytes, proposed_media_type: "image/png", public_evidence_url: "", attribution_text: item.attribution, required_fee: 10, escrowed_value: 10 });
}
function requestArgs(item) { return [item.request, "policy-v241-lumen-finch-001", 1n, item.purpose, item.channel, item.context, item.sha, BigInt(item.bytes), "image/png", "", item.attribution]; }
function evidenceArgs(item) { return [item.evidence, item.request, evidence.reference.url, evidence.reference.sha, BigInt(evidence.reference.bytes), "image/png", item.url, item.sha, BigInt(item.bytes), "image/png", "", "", "", authority(item.url), item.attribution]; }

async function precondition(readClient, source, abi, resuming = false) {
  assertStudionetConfig();
  if (NETWORK.alias !== NETWORK_ALIAS || NETWORK.chainId !== CHAIN_ID || NETWORK.rpc !== RPC_URL) throw new Error("NETWORK_MISMATCH");
  if (sha(source).toUpperCase() !== CONTRACT_SHA256 || sha(abi).toUpperCase() !== ABI_SHA256) throw new Error("LOCAL_HASH_MISMATCH");
  const schemaResult = await readClient.getContractSchema(address);
  const methods = Object.keys(schemaResult.methods ?? {});
  const reads = methods.filter((n) => schemaResult.methods[n]?.readonly === true);
  const writes = methods.filter((n) => schemaResult.methods[n]?.readonly !== true);
  if (methods.length !== expected.total || reads.length !== expected.reads || writes.length !== expected.writes) throw new Error("METHOD_COUNTS_MISMATCH");
  if (sha(Buffer.from(await readClient.getContractCode(address), "utf8")).toUpperCase() !== CONTRACT_SHA256) throw new Error("DEPLOYED_SOURCE_MISMATCH");
  const info = await read(readClient, "contract_info");
  if (info.version !== "2.4.1" || info.owner_override !== false || info.withdrawal_supported !== true || info.settlement_model !== "ENTITLEMENT_ALLOCATION") throw new Error("CONTRACT_INFO_MISMATCH");
  if (await read(readClient, "get_semantic_schema") !== schema || JSON.stringify(await read(readClient, "get_semantic_keys")) !== JSON.stringify(keys)) throw new Error("SEMANTIC_SCHEMA_MISMATCH");
  const statusValue = await read(readClient, "get_status");
  const accounting = await read(readClient, "get_accounting_status");
  const collections = {};
  const idMethods = { policies: "get_policy_ids", requests: "get_request_ids", evidence: "get_evidence_ids", adjudications: "get_adjudication_ids", permits: "get_permit_ids", settlements: "get_settlement_ids", withdrawals: "get_withdrawal_ids" };
  for (const [name, method] of Object.entries(idMethods)) collections[name] = await ids(readClient, method);
  if (!resuming && Object.values(collections).some((v) => v.length !== 0)) throw new Error("CANONICAL_STATE_NOT_EMPTY");
  for (const v of Object.values(statusValue)) if (!resuming && Number(v) !== 0) throw new Error("CANONICAL_STATUS_NOT_EMPTY");
  for (const v of Object.values(accounting)) if (!resuming && Number(v) !== 0) throw new Error("CANONICAL_ACCOUNTING_NOT_EMPTY");
  return { info, status: statusValue, accounting, collections, methods, reads, writes };
}
async function reconcile(readClient, txHash, nonce, journal, record) {
  const tx = await pollFinal(readClient, txHash, { onPoll: (current) => {
    if (current?.nonce !== undefined && Number(current.nonce) !== nonce) throw new Error("NONCE_MISMATCH_AFTER_BROADCAST");
    record.latest_status = status(current);
    record.latest_execution_status = execution(current);
    record.receipt = jsonSafe(current);
    record.last_polled_at = new Date().toISOString();
    journalWrite(journal);
  }});
  if (tx?.nonce !== undefined && Number(tx.nonce) !== nonce) throw new Error("NONCE_MISMATCH_AFTER_BROADCAST");
  if (status(tx) !== "FINALIZED" || execution(tx) !== "FINISHED_WITH_RETURN") throw new Error("TERMINAL_FAILURE:" + status(tx) + ":" + execution(tx));
  return { tx, waitError: null };
}
function prepareConsensusRetry(journal, label) {
  const previous = journal.transactions.find((item) => item.label === label);
  if (!previous?.tx_hash || status(previous.receipt) !== "FINALIZED" || previous.receipt?.result_name !== "MAJORITY_DISAGREE") return;
  const priorRetries = journal.transactions.filter((item) => item.original_label === label).length;
  if (priorRetries >= 1) throw new Error("CONSENSUS_RETRY_EXHAUSTED:" + label);
  previous.original_label = label;
  previous.label = label + ":consensus-failed-1";
  previous.phase = "TERMINAL_CONSENSUS_FAILURE";
  previous.status = status(previous.receipt);
  previous.execution_status = execution(previous.receipt);
  previous.latest_execution_status = previous.execution_status;
  previous.failure = "Terminal MAJORITY_DISAGREE; no adjudication state was committed";
  journal.adjudication_retries = Number(journal.adjudication_retries ?? 0) + 1;
  journal.failures.push({
    label: previous.label,
    tx_hash: previous.tx_hash,
    failure_stage: "TERMINAL_CONSENSUS_FAILURE",
    consensus_result: previous.receipt.result_name,
    error: previous.failure,
  });
  journal.stop_reason = null;
  journal.phase = "QUALIFICATION_IN_PROGRESS";
  journalWrite(journal);
}
async function writeTx({ readClient, writeClient, signer, journal, label, method, args, value, nondeterministic, verify }) {
  const previous = journal.transactions.find((item) => item.label === label);
  if (previous?.phase === "COMPLETE") {
    return { txHash: previous.tx_hash, record: previous, readback: parse(previous.canonical_readback), before: {balance: BigInt(previous.balance_before)}, after: {balance: BigInt(previous.balance_after)} };
  }
  if (previous?.tx_hash) {
    const final = await reconcile(readClient, previous.tx_hash, previous.nonce, journal, previous);
    previous.receipt = jsonSafe(final.tx); previous.status = status(final.tx); previous.execution_status = execution(final.tx);
    previous.canonical_readback = jsonSafe(await verify()); previous.balance_after = (await state(readClient, signer.address)).balance.toString(); previous.phase = "COMPLETE"; journalWrite(journal);
    return { txHash: previous.tx_hash, record: previous, readback: parse(previous.canonical_readback), before: {balance: BigInt(previous.balance_before)}, after: {balance: BigInt(previous.balance_after)} };
  }
  if (previous) throw new Error("UNCERTAIN_PREVIOUS_WRITE:" + label);
  const before = await state(readClient, signer.address);
  if (before.latest !== before.pending) throw new Error("NONCE_NOT_RECONCILED:" + label);
  const spec = buildQualificationWriteSpec({ account: signer, address, functionName: method, args, kwargs: {}, value, frozenPolicyFee: fee });
  // Run the exact payable Case A object through consensus simulation before
  // the first write, so contract errors are caught before qualification starts.
  if (label === "case-A:submit_usage_request") {
    try {
      journal.case_a_simulation = await simulateStudionetWrite(spec, await chainNow());
      journalWrite(journal);
    } catch (e) {
      journal.failures.push({ label, failure_stage: "SIMULATION_EXECUTION_BEFORE_BROADCAST", error: errText(e) });
      journal.phase = "STOPPED_FIRST_FAILURE";
      journal.stop_reason = "SIMULATION_EXECUTION_FAILURE_BEFORE_BROADCAST";
      journalWrite(journal);
      throw new Error("SIMULATION_EXECUTION_FAILURE:" + label);
    }
  }
  if (before.balance < value) throw new Error("INSUFFICIENT_USER_VALUE_BALANCE:" + label);
  const record = { label, method, signer: signer.address, args: jsonSafe(args), value: value.toString(), nonce: before.latest, balance_before: before.balance.toString(), fee_model: journal.fee_model, fee_profile: jsonSafe(journal.fee_estimate), nondeterministic_consensus: nondeterministic, phase: "PREPARED", tx_hash: null };
  journal.transactions.push(record); journal.broadcast_count += 0; journalWrite(journal);
  let txHash;
  try { txHash = await writeClient.writeContract(spec); } catch (e) { record.phase = "SUBMISSION_STATE_UNCERTAIN"; record.failure = errText(e); journal.failures.push({ label, error: record.failure }); journal.phase = "STOPPED_FIRST_FAILURE"; journalWrite(journal); throw new Error("SUBMISSION_STATE_UNCERTAIN:" + label); }
  if (typeof txHash !== "string" || txHash.length < 8) throw new Error("INVALID_TX_HASH:" + label);
  record.tx_hash = txHash; record.phase = "SUBMITTED_HASH_PERSISTED"; record.broadcast_count = 1; journal.broadcast_count += 1; journal.qualification_writes = journal.broadcast_count; assertQualificationBound(journal); journalWrite(journal);
  let final;
  try { record.phase = "PENDING"; journalWrite(journal); final = await reconcile(readClient, txHash, before.latest, journal, record); } catch (e) { record.phase = "FINALIZATION_OR_EXECUTION_FAILURE"; record.failure = errText(e); journal.failures.push({ label, tx_hash: txHash, error: record.failure }); journal.phase = "STOPPED_FIRST_FAILURE"; journalWrite(journal); throw new Error("QUALIFICATION_STOPPED:" + label); }
  record.receipt = jsonSafe(final.tx); record.status = status(final.tx); record.execution_status = execution(final.tx); record.wait_error = final.waitError;
  record.consensus = receiptSummary(final.tx);
  record.gen_costs = receiptSummary(final.tx);
  record.canonical_readback = jsonSafe(await verify());
  const after = await state(readClient, signer.address); if (after.latest !== after.pending) throw new Error("NONCE_NOT_RECONCILED_AFTER:" + label);
  record.balance_after = after.balance.toString();
  record.gen_balance_delta_wei = (after.balance - before.balance).toString();
  record.phase = "COMPLETE"; journalWrite(journal);
  return { txHash, record, readback: parse(record.canonical_readback), before, after };
}
async function verifyPolicy(readClient, policy, target) {
  const value = await read(readClient, "get_policy", [policy.policy_id]);
  if (value.state !== target || value.policy_id !== policy.policy_id || Number(value.version) !== 1 || lower(value.issuer) !== issuer || lower(value.settlement_recipient) !== issuer || String(value.required_fee_wei) !== "10" || value.asset_sha256 !== evidence.reference.sha || Number(value.asset_exact_bytes) !== evidence.reference.bytes || value.asset_source !== evidence.reference.url || value.license_text_sha256 !== policy.license_text_sha256) throw new Error("POLICY_READBACK_MISMATCH");
  return value;
}
async function verifyRequest(readClient, item) {
  const value = await read(readClient, "get_request", [item.request]);
  if (value.request_id !== item.request || value.policy_id !== "policy-v241-lumen-finch-001" || lower(value.requester) !== requester || value.request_digest !== requestDigest(item) || String(value.escrowed_value) !== "10") throw new Error("REQUEST_READBACK_MISMATCH:" + item.request);
  return value;
}
async function verifyEvidence(readClient, item) {
  const value = await read(readClient, "get_evidence", [item.evidence]);
  if (value.evidence_id !== item.evidence || value.request_id !== item.request || value.reference_sha256 !== evidence.reference.sha || value.proposed_sha256 !== item.sha || Number(value.proposed_byte_length) !== item.bytes || value.proposed_source !== item.url || value.authority_digest !== authority(item.url)) throw new Error("EVIDENCE_READBACK_MISMATCH:" + item.evidence);
  return value;
}
async function verifyAuth(readClient, item) {
  const value = await verifyEvidence(readClient, item);
  if (!Array.isArray(value.authentication_attempts) || value.authentication_attempts.length !== 1 || value.authentication_attempts[0].status !== "AUTHENTICATED") throw new Error("AUTH_READBACK_MISMATCH:" + item.evidence);
  return value;
}
async function verifyAdjudication(readClient, item) {
  const value = await find(readClient, "get_adjudication_ids", "get_adjudication", (x) => x?.request_id === item.request);
  if (!value || value.policy_id !== "policy-v241-lumen-finch-001" || value.evidence_id !== item.evidence || Number(value.generation) !== 1 || !["PERMITTED", "DENIED", "INCONCLUSIVE", "NOT_APPLICABLE"].includes(value.result)) throw new Error("ADJUDICATION_READBACK_MISMATCH:" + item.request);
  if (!value.semantic_vector || Object.keys(value.semantic_vector).length !== 7 || keys.some((k) => typeof value.semantic_vector[k] !== "boolean")) throw new Error("SEMANTIC_VECTOR_INVALID:" + item.request);
  return value;
}
async function verifySettlement(readClient, item, adj) {
  const settlement = await find(readClient, "get_settlement_ids", "get_settlement", (x) => x?.request_id === item.request);
  if (!settlement) throw new Error("SETTLEMENT_MISSING:" + item.request);
  const requestValue = await read(readClient, "get_request", [item.request]);
  if (String(requestValue.escrowed_value) !== "0" || String(requestValue.escrow_consumed) !== "10" || requestValue.state !== "SETTLED") throw new Error("SETTLEMENT_ESCROW_MISMATCH:" + item.request);
  const permit = await find(readClient, "get_permit_ids", "get_permit", (x) => x?.request_id === item.request);
  if (adj.result === "PERMITTED") {
    if (settlement.settlement_type !== "PAYOUT_ALLOCATED" || lower(settlement.recipient) !== issuer || String(settlement.amount) !== "10" || !permit) throw new Error("PAYOUT_MISMATCH:" + item.request);
  } else if (settlement.settlement_type !== "REFUND_ALLOCATED" || lower(settlement.recipient) !== requester || String(settlement.amount) !== "10" || permit) throw new Error("REFUND_MISMATCH:" + item.request);
  return { settlement, permit, request: requestValue };
}
function messages(value, output = []) {
  if (!value || typeof value !== "object" || output.length > 20) return output;
  if (Array.isArray(value)) { for (const x of value) messages(x, output); return output; }
  for (const [k, v] of Object.entries(value)) { if (k.toLowerCase().includes("message")) output.push({ key: k, value: jsonSafe(v) }); if (v && typeof v === "object") messages(v, output); }
  return output;
}
function receiptSummary(receipt) {
  const fees = receipt?.fees ?? {};
  const accounting = receipt?.data?.fee_accounting ?? {};
  const consumed = fees.consumed ?? {};
  const report = accounting.execution_fee_report ?? {};
  return {
    fee_deposit: fees.deposit ?? receipt?.data?.fee_value ?? null,
    execution_consumed: consumed.executionConsumed ?? null,
    storage_fee_used: consumed.storageFeeUsed ?? null,
    message_fees_consumed: consumed.messageFeesConsumed ?? null,
    primary_fee_spent: accounting.primary_fee_spent ?? null,
    total_studio_metered_fee: report.totalStudioMeteredFee ?? null,
    total_refunded: accounting.total_refunded ?? null,
    genvm_execution: report.genvmBuckets?.totalExecution ?? null,
    genvm_message: report.genvmBuckets?.totalWithMessage === undefined ? null : report.genvmBuckets.totalWithMessage - (report.genvmBuckets.totalExecution ?? 0),
    consensus_rounds: receipt?.consensus_history?.consensus_results?.length ?? 0,
    final_consensus_result: receipt?.last_round?.result ?? receipt?.consensus_data?.last_round?.result ?? null,
    votes_committed: receipt?.last_round?.votes_committed ?? receipt?.consensus_data?.last_round?.votes_committed ?? null,
    votes_revealed: receipt?.last_round?.votes_revealed ?? receipt?.consensus_data?.last_round?.votes_revealed ?? null,
  };
}
async function withdraw({ readClient, writeClient, signer, journal, settlement, result, caseId }) {
  const payout = result === "PERMITTED";
  const method = payout ? "withdraw_claimable" : "withdraw_refund";
  const ledgerMethod = payout ? "get_claimable" : "get_refundable";
  const recipient = payout ? issuer : requester;
  if (lower(signer.address) !== recipient) throw new Error("WITHDRAW_ACTOR_MISMATCH:" + caseId);
  const entitlementBefore = BigInt(await read(readClient, ledgerMethod, [recipient]));
  if (entitlementBefore < 10n) throw new Error("ENTITLEMENT_BEFORE_INSUFFICIENT:" + caseId);
  const tx = await writeTx({
    readClient, writeClient, signer, journal, label: "case-" + caseId + ":" + method, method,
    args: [settlement.settlement_id], value: 0n, nondeterministic: false,
    verify: async () => {
      const settled = await read(readClient, "get_settlement", [settlement.settlement_id]);
      if (!settled.withdrawal_id) throw new Error("WITHDRAWAL_ID_MISSING:" + caseId);
      const record = await read(readClient, "get_withdrawal", [settled.withdrawal_id]);
      if (record.status !== "WITHDRAWAL_EMITTED") throw new Error("WITHDRAWAL_NOT_EMITTED:" + caseId);
      eq(await read(readClient, ledgerMethod, [recipient]), entitlementBefore - 10n, "ENTITLEMENT_AFTER:" + caseId);
      return { settlement: settled, withdrawal: record };
    },
  });
  const childHashes = tx.record.receipt?.triggered_transactions ?? [];
  const deliveryReceipts = [];
  for (const child of childHashes) {
    const hash = typeof child === "string" ? child : child?.hash;
    if (hash) deliveryReceipts.push(jsonSafe(await pollFinal(readClient, hash)));
  }
  let recipientAfter = tx.after;
  for (let attempt = 0; attempt < 30 && recipientAfter.balance - tx.before.balance !== 10n; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    recipientAfter = await state(readClient, signer.address);
  }
  const delta = recipientAfter.balance - tx.before.balance;
  const messageEvidence = messages(tx.record.receipt);
  return { tx_hash: tx.txHash, recipient, amount: "10", balance_before: tx.before.balance.toString(), balance_after: recipientAfter.balance.toString(), balance_delta: delta.toString(), withdrawal_status: tx.readback.withdrawal.status, delivery_confirmation: tx.readback.withdrawal.delivery_confirmation, message_evidence: messageEvidence, delivery_receipts: deliveryReceipts, external_delivery_confirmed: delta === 10n };
}

function receiptText(value) {
  if (typeof value === "string") {
    let decoded = "";
    try { decoded = Buffer.from(value, "base64").toString("utf8"); } catch {}
    return value + " " + decoded;
  }
  if (!value || typeof value !== "object") return "";
  return Object.values(value).map(receiptText).join(" ");
}

async function rejectedWithdrawal({ readClient, writeClient, signer, journal, label, method, settlementId, expectedError }) {
  journal.protection_tests ??= [];
  const existing = journal.protection_tests.find((item) => item.label === label);
  if (existing?.verified) return existing;
  const record = existing ?? { label, method, signer: signer.address, settlement_id: settlementId, expected_error: expectedError, tx_hash: null, phase: "PREPARED" };
  if (!existing) {
    record.before = await read(readClient, "get_accounting_status");
    record.settlement_before = await read(readClient, "get_settlement", [settlementId]);
    record.nonce = (await state(readClient, signer.address)).latest;
    journal.protection_tests.push(record); journalWrite(journal);
    record.phase = "BROADCASTING_ONCE"; journalWrite(journal);
    record.tx_hash = await writeClient.writeContract({ account: signer, address, functionName: method, args: [settlementId], value: 0n });
    journal.broadcast_count += 1; journal.qualification_writes = journal.broadcast_count; assertQualificationBound(journal);
    record.phase = "HASH_PERSISTED"; journalWrite(journal);
  }
  if (!record.tx_hash) throw new Error("UNCERTAIN_PROTECTION_WRITE:" + label);
  const tx = await pollFinal(readClient, record.tx_hash, { onPoll(current) { record.receipt = jsonSafe(current); journalWrite(journal); } });
  record.receipt = jsonSafe(tx); record.status = status(tx); record.execution_status = execution(tx);
  if (record.status !== "FINALIZED" || record.execution_status !== "FINISHED_WITH_ERROR" || !receiptText(tx).includes(expectedError)) throw new Error("EXPECTED_PROTECTION_REJECTION_NOT_PROVEN:" + label);
  record.after = await read(readClient, "get_accounting_status");
  record.settlement_after = await read(readClient, "get_settlement", [settlementId]);
  if (canonical(record.before) !== canonical(record.after) || canonical(record.settlement_before) !== canonical(record.settlement_after)) throw new Error("REJECTED_WITHDRAWAL_MUTATED_STATE:" + label);
  record.verified = true; record.phase = "EXPECTED_REJECTION_VERIFIED"; journalWrite(journal);
  return record;
}

async function fundRequesterOnce({ readOnlyClient, issuerClient, issuerAccount, journal }) {
  const current = await state(readOnlyClient, requester);
  const target = fee * 4n;
  let funding = journal.funding_transaction;
  if (!funding && current.balance >= target) {
    journal.requester_funding = { required_wei: target.toString(), balance_before_wei: current.balance.toString(), amount_sent_wei: "0", status: "ALREADY_FUNDED" };
    journalWrite(journal); return;
  }
  if (!funding) {
    const amount = target - current.balance;
    funding = { label: "funding:requester-four-case-escrow", method: "native_testnet_transfer", from: issuerAccount.address, to: requester, value: amount.toString(), balance_before_wei: current.balance.toString(), phase: "PREPARED", tx_hash: null };
    journal.funding_transaction = funding; journalWrite(journal);
    funding.phase = "BROADCASTING_ONCE"; journalWrite(journal);
    funding.tx_hash = await issuerClient.sendTransaction({ account: issuerAccount, to: requester, value: amount });
    funding.phase = "HASH_PERSISTED_POLLING_SAME_TRANSACTION"; journalWrite(journal);
  }
  if (!funding.tx_hash) throw new Error("UNCERTAIN_FUNDING_BROADCAST_NO_RETRY");
  if (funding.phase === "FINALIZED_AND_BALANCE_VERIFIED") return;
  // Stable Studio's synthetic eth receipt exists before balance credit. Wait
  // for its native consensus finality and then reconcile recipient readback.
  const transaction = await pollFinal(readOnlyClient, funding.tx_hash, { onPoll(tx) { funding.transaction = jsonSafe(tx); journalWrite(journal); } });
  if (status(transaction) !== "FINALIZED") throw new Error("FUNDING_NOT_FINALIZED");
  funding.receipt = await rpc("eth_getTransactionReceipt", [funding.tx_hash]);
  const expectedBalance = BigInt(funding.balance_before_wei) + BigInt(funding.value);
  let after;
  for (let attempt = 0; attempt < 20; attempt++) {
    after = await state(readOnlyClient, requester);
    if (after.balance === expectedBalance) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (after.balance !== expectedBalance || String(funding.receipt?.status) !== "0x1") throw new Error("REQUESTER_FUNDING_BALANCE_DELTA_MISMATCH_SAME_HASH");
  funding.phase = "FINALIZED_AND_BALANCE_VERIFIED";
  funding.balance_after_wei = after.balance.toString(); funding.balance_delta_wei = funding.value;
  journal.requester_funding = { required_wei: target.toString(), balance_before_wei: funding.balance_before_wei, amount_sent_wei: funding.value, balance_after_wei: after.balance.toString(), tx_hash: funding.tx_hash, status: "VERIFIED" };
  journalWrite(journal);
}

async function main() {
  assertStudionetConfig();
  if (NETWORK.alias !== NETWORK_ALIAS || NETWORK.chainId !== CHAIN_ID || NETWORK.rpc !== RPC_URL) throw new Error("V24_NETWORK_MISMATCH");
  if (!existsSync(deploymentJournalPath)) throw new Error("V24_DEPLOYMENT_JOURNAL_MISSING");
  const deployment = JSON.parse(readFileSync(deploymentJournalPath, "utf8"));
  if (deployment.network?.alias !== "studionet" || deployment.broadcast_count !== 1 || deployment.deployment_count !== 1 || deployment.status !== "FINALIZED" || deployment.execution_status !== "FINISHED_WITH_RETURN") throw new Error("V24_DEPLOYMENT_RECEIPT_NOT_VERIFIED");
  if (deployment.candidate?.source_sha256 !== CONTRACT_SHA256 || deployment.candidate?.abi_sha256 !== ABI_SHA256 || deployment.verification?.source_parity !== true || deployment.verification?.abi_schema_parity !== true) throw new Error("V24_DEPLOYMENT_PARITY_NOT_VERIFIED");
  address = deployment.contract_address;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("V24_DEPLOYED_ADDRESS_INVALID");
  let prior = null;
  if (existsSync(journalPath)) {
    prior = JSON.parse(readFileSync(journalPath, "utf8"));
    if ((prior.transactions ?? []).some((item) => item.phase === "SUBMISSION_STATE_UNCERTAIN" && !item.tx_hash)) throw new Error("UNCERTAIN_PRIOR_BROADCAST_REQUIRES_NONCE_RECONCILIATION");
    if (prior.candidate?.source_sha256 !== CONTRACT_SHA256 || prior.candidate?.abi_sha256 !== ABI_SHA256) throw new Error("V24_QUALIFICATION_JOURNAL_HASH_MISMATCH");
  }
  const source = readFileSync(sourcePath);
  const abi = readFileSync(abiPath);
  assertCandidateBytes({ sourceBytes: source, abiBytes: abi });
  assertAbiShape(abi);
  const issuerAccount = await loadAccount(issuerName);
  const requesterAccount = await loadAccount(requesterName);
  requesterCanonical = requesterAccount.address;
  const operatorAccount = await loadAccount(operatorName);
  if (lower(issuerAccount.address) !== issuer || lower(requesterAccount.address) !== requester || lower(operatorAccount.address) !== operator) throw new Error("ACTOR_ADDRESS_MISMATCH");
  const readClient = createStudionetClient();
  const issuerClient = createStudionetClient(issuerAccount);
  const requesterClient = createStudionetClient(requesterAccount);
  const operatorClient = createStudionetClient(operatorAccount);
  const journal = prior ?? createV24Journal("qualification");
  Object.assign(journal, {
    phase: "PRECONDITION_STARTED",
    deployment_count: 1,
    contract_address: address,
    contract_sha256: CONTRACT_SHA256,
    abi_sha256: ABI_SHA256,
    candidate: { source_sha256: CONTRACT_SHA256, abi_sha256: ABI_SHA256, schema_shape: expected },
    runner: RUNNER,
    write_limit: 40,
    fee_model: "UNVERIFIED_NO_QUOTE",
    fee_estimate_required: false,
    network: { alias: NETWORK.alias, rpc: NETWORK.rpc, chain_id: NETWORK.chainId, consensus_main: NETWORK.consensusMain, consensus_data: NETWORK.consensusData },
    prior_journal_phase: prior?.phase ?? null,
    deployment_tx_hash: deployment.transaction_id,
    consensus_results: journal.consensus_results ?? [],
    state_transitions: journal.state_transitions ?? [],
    settlement_results: journal.settlement_results ?? [],
    accounting_results: journal.accounting_results ?? [],
    gen_costs: journal.gen_costs ?? [],
  });
  journalWrite(journal);
  let canonical;
  let feeEstimate = null;
  try {
    feeEstimate = await requireGaslessFeeEstimate(readClient);
    journal.fee_model = "GASLESS_VERIFIED";
    journal.fee_estimate = { ...jsonSafe(feeEstimate), estimation_required: false };
    journalWrite(journal);
    canonical = await precondition(readClient, source, abi, journal.transactions.length > 0);
  } catch (error) {
    journal.phase = "STOPPED_PRECONDITION";
    journal.stop_reason = "READ_ONLY_PRECONDITION_FAILED_BEFORE_BROADCAST";
    journal.consensus_status = "NOT_REACHED";
    journal.state_transition_status = "NOT_REACHED";
    journal.settlement_status = "NOT_REACHED";
    journal.accounting_status = "NOT_REACHED";
    journal.gen_cost_status = "NO_QUALIFICATION_GEN_COST";
    journal.failures.push({ stage: "PRECONDITION", error: errText(error) });
    journalWrite(journal);
    throw error;
  }
  const publicEvidence = await verifyPublicEvidence();
  const now = await chainNow();
  const policy = journal.policy ?? policyFor(now);
  const accountStates = {
    issuer: await state(readClient, issuerAccount.address),
    requester: await state(readClient, requesterAccount.address),
    operator: await state(readClient, operatorAccount.address),
  };
  if (Object.values(accountStates).some((x) => x.latest !== x.pending)) throw new Error("ACCOUNT_NONCE_NOT_RECONCILED");
  if (process.argv.includes("--preflight")) {
    console.log(JSON.stringify(jsonSafe({ preflight: "PASS", network: { alias: NETWORK.alias, rpc: NETWORK.rpc, chain_id: NETWORK.chainId }, address, source_sha256: sha(source).toUpperCase(), abi_sha256: sha(abi).toUpperCase(), canonical, public_evidence: publicEvidence, chain_timestamp: now, policy, account_states: accountStates, fee_model: journal.fee_model, fee_estimate: feeEstimate, fee_estimate_required: false, requester_funding_required_wei: (accountStates.requester.balance < fee * 4n ? fee * 4n - accountStates.requester.balance : 0n).toString() }), null, 2));
    return;
  }
  journal.phase = "PRECONDITION_VERIFIED";
  Object.assign(journal, { semantic_schema: schema, semantic_keys: keys, actors: { issuer: issuerAccount.address, requester: requesterAccount.address, operator: operatorAccount.address }, chain_timestamp_start: now, policy, policy_digest: jsonHash(policy), public_evidence: publicEvidence, initial_state: canonical, write_limit: 40, qualification_writes: journal.qualification_writes ?? 0, broadcast_count: journal.broadcast_count ?? 0, transactions: journal.transactions, cases: journal.cases ?? {}, failures: journal.failures, result_shopping: false, adjudication_retries: 0, rebroadcasts: 0, fee_model: journal.fee_model, fee_estimate_required: false });
  journalWrite(journal);
  await fundRequesterOnce({ readOnlyClient: readClient, issuerClient, issuerAccount, journal });
  const create = await writeTx({ readClient, writeClient: issuerClient, signer: issuerAccount, journal, label: "policy:create", method: "create_policy", args: policyArgs(policy), value: 0n, nondeterministic: false, verify: () => verifyPolicy(readClient, policy, "DRAFT") });
  journal.policy_create_tx = create.txHash;
  journal.phase = "QUALIFICATION_IN_PROGRESS";
  journalWrite(journal);
  const freeze = await writeTx({ readClient, writeClient: issuerClient, signer: issuerAccount, journal, label: "policy:freeze", method: "freeze_policy", args: [policy.policy_id], value: 0n, nondeterministic: false, verify: () => verifyPolicy(readClient, policy, "FROZEN") });
  journal.policy_freeze_tx = freeze.txHash;
  journalWrite(journal);
  for (const caseId of ["A", "B", "C", "D"]) {
    const item = evidence[caseId];
    journal.cases[caseId] ??= { expected_result: item.expected };
    const req = await writeTx({ readClient, writeClient: requesterClient, signer: requesterAccount, journal, label: "case-" + caseId + ":submit_usage_request", method: "submit_usage_request", args: requestArgs(item), value: fee, nondeterministic: false, verify: () => verifyRequest(readClient, item) });
    journal.cases[caseId].request_tx = req.txHash;
    const ev = await writeTx({ readClient, writeClient: operatorClient, signer: operatorAccount, journal, label: "case-" + caseId + ":commit_evidence", method: "commit_evidence", args: evidenceArgs(item), value: 0n, nondeterministic: false, verify: () => verifyEvidence(readClient, item) });
    journal.cases[caseId].evidence_tx = ev.txHash;
    const au = await writeTx({ readClient, writeClient: operatorClient, signer: operatorAccount, journal, label: "case-" + caseId + ":authenticate_evidence", method: "authenticate_evidence", args: [item.evidence], value: 0n, nondeterministic: true, verify: () => verifyAuth(readClient, item) });
    journal.cases[caseId].authenticate_tx = au.txHash;
    const adjudicationLabel = "case-" + caseId + ":adjudicate_usage";
    prepareConsensusRetry(journal, adjudicationLabel);
    const ad = await writeTx({ readClient, writeClient: operatorClient, signer: operatorAccount, journal, label: adjudicationLabel, method: "adjudicate_usage", args: [item.request], value: 0n, nondeterministic: true, verify: () => verifyAdjudication(readClient, item) });
    const adj = ad.readback;
    journal.cases[caseId].adjudicate_tx = ad.txHash;
    journal.cases[caseId].adjudication_id = adj.adjudication_id;
    journal.cases[caseId].semantic_vector = adj.semantic_vector;
    journal.cases[caseId].result = adj.result;
    journal.cases[caseId].expected_result_match = adj.result === item.expected;
    const st = await writeTx({ readClient, writeClient: operatorClient, signer: operatorAccount, journal, label: "case-" + caseId + ":settle_request", method: "settle_request", args: [item.request], value: 0n, nondeterministic: false, verify: () => verifySettlement(readClient, item, adj) });
    const settlement = st.readback.settlement;
    journal.cases[caseId].settle_tx = st.txHash;
    journal.cases[caseId].settlement_id = settlement.settlement_id;
    journal.cases[caseId].entitlement = settlement.settlement_type;
    journal.cases[caseId].permit_id = st.readback.permit?.permit_id ?? null;
    journalWrite(journal);
    console.log(JSON.stringify({ case: caseId, result: adj.result, expected: item.expected, expected_match: journal.cases[caseId].expected_result_match, entitlement: settlement.settlement_type, permit_id: journal.cases[caseId].permit_id }));
  }
  journal.withdrawal_results ??= [];
  for (const [caseId, item] of Object.entries(journal.cases)) {
    const payout = item.entitlement === "PAYOUT_ALLOCATED";
    const method = payout ? "withdraw_claimable" : "withdraw_refund";
    const signer = payout ? issuerAccount : requesterAccount;
    const writeClient = payout ? issuerClient : requesterClient;
    if (!journal.withdrawal_results.some((entry) => entry.case_id === caseId)) {
      await rejectedWithdrawal({ readClient, writeClient: operatorClient, signer: operatorAccount, journal,
        label: "case-" + caseId + ":unauthorized-withdrawal", method, settlementId: item.settlement_id,
        expectedError: "only the frozen entitlement recipient may withdraw" });
      const settlement = await read(readClient, "get_settlement", [item.settlement_id]);
      const result = await withdraw({ readClient, writeClient, signer, journal, settlement, result: item.result, caseId });
      item.withdrawal = result;
      journal.withdrawal_results.push({ case_id: caseId, entitlement_type: item.entitlement, ...result });
      journalWrite(journal);
    }
    await rejectedWithdrawal({ readClient, writeClient, signer, journal,
      label: "case-" + caseId + ":duplicate-withdrawal", method, settlementId: item.settlement_id,
      expectedError: "settlement entitlement has already been consumed" });
  }
  const finalStatus = await read(readClient, "get_status");
  const accounting = await read(readClient, "get_accounting_status");
  const finalAuditEvents = await read(readClient, "get_audit_events", [0n, 64n]);
  if (!Array.isArray(finalAuditEvents) || finalAuditEvents.length !== Number(finalStatus.audit_count)) throw new Error("FINAL_AUDIT_EVENT_COUNT_MISMATCH");
  const collections = {};
  const idMethods = { policies: "get_policy_ids", requests: "get_request_ids", evidence: "get_evidence_ids", adjudications: "get_adjudication_ids", permits: "get_permit_ids", settlements: "get_settlement_ids", withdrawals: "get_withdrawal_ids" };
  for (const [name, method] of Object.entries(idMethods)) collections[name] = await ids(readClient, method);
  const permitted = Object.values(journal.cases).filter((x) => x.result === "PERMITTED").length;
  if (collections.policies.length !== 1 || collections.requests.length !== 4 || collections.evidence.length !== 4 || collections.adjudications.length !== 4 || collections.settlements.length !== 4 || collections.permits.length !== permitted) throw new Error("FINAL_COLLECTION_COUNTS_MISMATCH");
  eq(finalStatus.total_escrow_received, 40, "TOTAL_ESCROW_RECEIVED");
  eq(finalStatus.total_escrowed, 0, "LIVE_ESCROW");
  eq(accounting.conservation_rhs, 40, "CONSERVATION");
  eq(accounting.total_payout_allocated, permitted * 10, "PAYOUT_ALLOCATED");
  eq(accounting.total_refund_allocated, (4 - permitted) * 10, "REFUND_ALLOCATED");
  const payoutWithdrawals = journal.withdrawal_results.filter((item) => item.entitlement_type === "PAYOUT_ALLOCATED").length;
  const refundWithdrawals = journal.withdrawal_results.filter((item) => item.entitlement_type === "REFUND_ALLOCATED").length;
  const expectedResultsPass = Object.entries(journal.cases).every(([caseId, item]) => item.expected_result_match === true && item.result === evidence[caseId].expected);
  const deliveryPass = journal.withdrawal_results.length === 4 && journal.withdrawal_results.every((item) => item.external_delivery_confirmed === true);
  eq(accounting.total_claimable_outstanding, (permitted - payoutWithdrawals) * 10, "CLAIMABLE_OUTSTANDING");
  eq(accounting.total_refundable_outstanding, (4 - permitted - refundWithdrawals) * 10, "REFUNDABLE_OUTSTANDING");
  eq(accounting.total_withdrawal_emitted, (payoutWithdrawals + refundWithdrawals) * 10, "WITHDRAWAL_EMITTED");
  if (collections.withdrawals.length !== payoutWithdrawals + refundWithdrawals) throw new Error("FINAL_WITHDRAWAL_COUNT_MISMATCH");
  journal.final_status = jsonSafe(finalStatus);
  journal.final_accounting = jsonSafe(accounting);
  journal.final_collections = jsonSafe(collections);
  journal.final_audit_events = jsonSafe(finalAuditEvents);
  journal.expected_results_pass = expectedResultsPass;
  journal.delivery_verification_pass = deliveryPass;
  journal.transaction_ids = journal.transactions.map((item) => item.tx_hash).filter(Boolean);
  journal.funding_transaction_id = journal.funding_transaction?.tx_hash ?? null;
  journal.transaction_outcome_count = journal.transactions.filter((item) => item.status === "FINALIZED" && item.execution_status === "FINISHED_WITH_RETURN").length;
  journal.phase = expectedResultsPass && deliveryPass ? "QUALIFICATION_AND_DELIVERY_VERIFIED" : "QUALIFICATION_COMPLETED_WITH_REQUIRED_GATE_FAILURE";
  journal.live_qualification_verdict = expectedResultsPass && deliveryPass ? "SUCCESSFUL_CANONICAL_QUALIFICATION_WITH_DELIVERY_READBACK" : "NO_GO_EXPECTED_RESULT_OR_DELIVERY_GATE_UNVERIFIED";
  journalWrite(journal);
  console.log(JSON.stringify({ phase: journal.phase, expected_results_pass: expectedResultsPass, delivery_verification_pass: deliveryPass, status: finalStatus, accounting, collections, audit_events: finalAuditEvents.length, withdrawals: journal.withdrawal_results }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("RUNNER_STOPPED:" + errText(error).split("\n")[0]);
  if (error?.stack) console.error(error.stack);
  process.exitCode = 1;
}
