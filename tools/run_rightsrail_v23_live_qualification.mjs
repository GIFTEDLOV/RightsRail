import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ABI_SHA256, CHAIN_ID, CONTRACT_SHA256, DEPLOYER, RPC_URL, RUNNER } from "./deployment_fee_policy_v23.mjs";
import { buildQualificationWriteSpec } from "./qualification_write_spec.mjs";
import { canonical, jsonSafe } from "./qualification_runner_utils.mjs";

const SDK = "C:/Users/DELL/CharterLock/frontend/node_modules/genlayer-js/dist/";
const { createAccount, createClient } = await import(pathToFileURL(join(SDK, "index.js")));
const { studioDevnet } = await import(pathToFileURL(join(SDK, "chains", "index.js")));
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail.py");
const abiPath = join(root, "artifacts", "rightsrail.abi.json");
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-v23-live-qualification.json");
const address = "0xfB3335350b0e02ceFb384753990E9B377B4BCB1F";
const schema = "RIGHTSRAIL_USAGE_V1";
const keys = ["asset_match", "purpose_within_scope", "prohibited_context_present", "transformation_within_scope", "attribution_satisfied", "endorsement_implied", "evidence_sufficient"];
const issuerName = "firewall-only";
const requesterName = "agentpact-requester";
const operatorName = "agentpact-reader";
const issuer = DEPLOYER.toLowerCase();
const requester = "0x61f10cc252ed98ce7596c73fc557cca4cc600c82";
const operator = "0x0291e33706b7cae6ad332a28f66e7f3e6f634d58";
const fee = 10n;
const legacyFloor = 76548000000000n;
const expected = { total: 35, reads: 23, writes: 12 };
const evidence = {
  reference: { url: "https://rightsrail-evidence.vercel.app/reference.png", sha: "e0d804ab77a13f6f892b564f58656e72bf4daff123225b58cb637537b2aad0c8", bytes: 35344 },
  A: { request: "v23-request-case-a", evidence: "v23-evidence-case-a", url: "https://rightsrail-evidence.vercel.app/proposed-editorial.png", sha: "da782460a0de765d49ebcbe4f116cfab0c42b42d3aea99e4bfc3763e5b63f223", bytes: 52132, expected: "PERMITTED", purpose: "Commercial technology newsletter editorial use", channel: "newsletter", context: "Independent editorial article with no endorsement or recommendation.", attribution: "Image courtesy of Lumen Finch Studio" },
  B: { request: "v23-request-case-b", evidence: "v23-evidence-case-b", url: "https://rightsrail-evidence.vercel.app/proposed-betting.png", sha: "bf7799c32a4d8a46f5def7c06e39e1926c2e49df2461b35ea6111026699fef89", bytes: 48481, expected: "DENIED", purpose: "Commercial betting promotion", channel: "paid social advertisement", context: "Commercial gambling offer presented as a recommendation.", attribution: "Image courtesy of Lumen Finch Studio" },
  C: { request: "v23-request-case-c", evidence: "v23-evidence-case-c", url: "https://rightsrail-evidence.vercel.app/proposed-missing-context.png", sha: "a9f99ccd842e6ce2dd664d0aea21c94538a3eba40bf93040ab9fcb0158fe2584", bytes: 32221, expected: "INCONCLUSIVE", purpose: "Commercial technology newsletter editorial use", channel: "newsletter", context: "The surrounding context was unavailable during capture.", attribution: "" },
  D: { request: "v23-request-case-d", evidence: "v23-evidence-case-d", url: "https://rightsrail-evidence.vercel.app/unrelated.png", sha: "5d6cfa94971725d3d367a2c18d8cababd31668b0f3d33ed6d96712d222fb993d", bytes: 41410, expected: "NOT_APPLICABLE", purpose: "Commercial technology newsletter editorial use", channel: "newsletter", context: "Unrelated asset supplied with otherwise sufficient evidence.", attribution: "Image courtesy of Lumen Finch Studio" },
};

function errText(e) { return e instanceof Error ? e.name + ": " + e.message : String(e); }
function sha(v) { return createHash("sha256").update(v).digest("hex"); }
function textHash(v) { return sha(Buffer.from(v, "utf8")); }
function jsonHash(v) { return textHash(canonical(v)); }
function lower(v) { return String(v).toLowerCase(); }
function eq(a, b, label) { if (String(a) !== String(b)) throw new Error(label + ":" + a + ":" + b); }
function parse(v) { if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } } return v; }
function status(v) { return v?.statusName ?? v?.status ?? v?.consensusStatus ?? null; }
function execution(v) { return v?.txExecutionResultName ?? v?.executionResultName ?? v?.execution_result ?? v?.result_name ?? null; }
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
  const pkg = join(process.env.APPDATA ?? "", "npm", "node_modules", "genlayer", "package.json");
  const keytar = createRequire(pkg)("keytar");
  const secret = await keytar.getPassword("genlayer-cli", "account:" + name);
  if (typeof secret !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new Error("ACCOUNT_SECRET_UNAVAILABLE:" + name);
  return createAccount(secret);
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
function feeInput(v) {
  if (!v?.distribution) throw new Error("FEE_DISTRIBUTION_MISSING");
  const feeValue = BigInt(v.feeValue);
  const budget = BigInt(v.distribution.executionBudgetPerRound);
  if (feeValue <= 0n || budget <= 0n) throw new Error("FEE_NOT_POSITIVE");
  if (!Array.isArray(v.distribution.rotations)) throw new Error("FEE_ROTATIONS_MISSING");
  return { feeValue, budget, distribution: v.distribution, messageAllocations: v.messageAllocations ?? [], normalized: jsonSafe(v) };
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
    policy_id: "policy-v23-lumen-finch-001", asset_sha256: evidence.reference.sha, asset_exact_bytes: evidence.reference.bytes,
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
  return jsonHash({ policy_id: "policy-v23-lumen-finch-001", policy_version: 1, requester, purpose_description: item.purpose, channel: item.channel, context_description: item.context, proposed_asset_sha256: item.sha, proposed_asset_exact_bytes: item.bytes, proposed_media_type: "image/png", public_evidence_url: "", attribution_text: item.attribution, required_fee: 10, escrowed_value: 10 });
}
function requestArgs(item) { return [item.request, "policy-v23-lumen-finch-001", 1n, item.purpose, item.channel, item.context, item.sha, BigInt(item.bytes), "image/png", "", item.attribution]; }
function evidenceArgs(item) { return [item.evidence, item.request, evidence.reference.url, evidence.reference.sha, BigInt(evidence.reference.bytes), "image/png", item.url, item.sha, BigInt(item.bytes), "image/png", "", "", "", authority(item.url), item.attribution]; }

async function precondition(readClient, source, abi) {
  if (studioDevnet.id !== CHAIN_ID || studioDevnet.rpcUrls.default.http[0] !== RPC_URL) throw new Error("NETWORK_MISMATCH");
  if (sha(source).toUpperCase() !== CONTRACT_SHA256 || sha(abi).toUpperCase() !== ABI_SHA256) throw new Error("LOCAL_HASH_MISMATCH");
  const schemaResult = await readClient.getContractSchema(address);
  const methods = Object.keys(schemaResult.methods ?? {});
  const reads = methods.filter((n) => schemaResult.methods[n]?.readonly === true);
  const writes = methods.filter((n) => schemaResult.methods[n]?.readonly !== true);
  if (methods.length !== expected.total || reads.length !== expected.reads || writes.length !== expected.writes) throw new Error("METHOD_COUNTS_MISMATCH");
  if (sha(Buffer.from(await readClient.getContractCode(address), "utf8")).toUpperCase() !== CONTRACT_SHA256) throw new Error("DEPLOYED_SOURCE_MISMATCH");
  const info = await read(readClient, "contract_info");
  if (info.version !== "2.3.0" || info.owner_override !== false || info.withdrawal_supported !== true || info.settlement_model !== "ENTITLEMENT_ALLOCATION") throw new Error("CONTRACT_INFO_MISMATCH");
  if (await read(readClient, "get_semantic_schema") !== schema || JSON.stringify(await read(readClient, "get_semantic_keys")) !== JSON.stringify(keys)) throw new Error("SEMANTIC_SCHEMA_MISMATCH");
  const statusValue = await read(readClient, "get_status");
  const accounting = await read(readClient, "get_accounting_status");
  const collections = {};
  const idMethods = { policies: "get_policy_ids", requests: "get_request_ids", evidence: "get_evidence_ids", adjudications: "get_adjudication_ids", permits: "get_permit_ids", settlements: "get_settlement_ids", withdrawals: "get_withdrawal_ids" };
  for (const [name, method] of Object.entries(idMethods)) collections[name] = await ids(readClient, method);
  if (Object.values(collections).some((v) => v.length !== 0)) throw new Error("CANONICAL_STATE_NOT_EMPTY");
  for (const v of Object.values(statusValue)) if (Number(v) !== 0) throw new Error("CANONICAL_STATUS_NOT_EMPTY");
  for (const v of Object.values(accounting)) if (Number(v) !== 0) throw new Error("CANONICAL_ACCOUNTING_NOT_EMPTY");
  return { info, status: statusValue, accounting, collections, methods, reads, writes };
}
async function reconcile(readClient, writeClient, txHash, nonce) {
  let tx = null;
  let waitError = null;
  try { tx = await writeClient.waitForFinalization({ hash: txHash, fullTransaction: true }); } catch (e) { waitError = errText(e); }
  const deadline = Date.now() + 180000;
  let poll = 0;
  while (true) {
    if (!tx || status(tx) !== "FINALIZED" || !execution(tx)) tx = await retry("reconcile", () => readClient.getTransaction({ hash: txHash }));
    if (tx?.nonce !== undefined && Number(tx.nonce) !== nonce) throw new Error("NONCE_MISMATCH_AFTER_BROADCAST");
    if (status(tx) === "FINALIZED" && execution(tx) === "FINISHED_WITH_RETURN") return { tx, waitError };
    if (status(tx) === "FINALIZED" || status(tx) === "CANCELED" || (status(tx) && execution(tx) && execution(tx) !== "UNKNOWN" && execution(tx) !== "PENDING")) throw new Error("TERMINAL_FAILURE:" + status(tx) + ":" + execution(tx));
    if (Date.now() >= deadline) throw new Error("RECONCILIATION_TIMEOUT:" + status(tx) + ":" + execution(tx));
    await new Promise((r) => setTimeout(r, Math.min(10000, 1000 * (2 ** Math.min(poll, 3)))));
    poll += 1;
    tx = null;
  }
}
async function writeTx({ readClient, writeClient, signer, journal, label, method, args, value, nondeterministic, verify }) {
  const before = await state(readClient, signer.address);
  if (before.latest !== before.pending) throw new Error("NONCE_NOT_RECONCILED:" + label);
  const spec = buildQualificationWriteSpec({ account: signer, address, functionName: method, args, kwargs: {}, value, frozenPolicyFee: fee });
  // Run the exact payable Case A object through the supported Studio simulation
  // before fee estimation. This makes a contract-execution blocker explicit
  // and prevents a later operator from treating a fee-estimator error as a
  // missing-value problem or bypassing the precondition before broadcast.
  if (label === "case-A:submit_usage_request") {
    try {
      await retry("simulate:" + label, () => writeClient.simulateWriteContract({ ...spec, includeReceipt: true }));
    } catch (e) {
      journal.failures.push({ label, failure_stage: "SIMULATION_EXECUTION_BEFORE_BROADCAST", error: errText(e) });
      journal.phase = "STOPPED_FIRST_FAILURE";
      journal.stop_reason = "SIMULATION_EXECUTION_FAILURE_BEFORE_FEE_ESTIMATION";
      journalWrite(journal);
      throw new Error("SIMULATION_EXECUTION_FAILURE:" + label);
    }
  }
  let estimated;
  try {
    estimated = await retry("estimate:" + label, () => writeClient.estimateTransactionFeesForWrite(spec));
  } catch (e) {
    journal.failures.push({ label, failure_stage: "FEE_ESTIMATION_BEFORE_BROADCAST", error: errText(e) });
    journal.phase = "STOPPED_FIRST_FAILURE";
    journal.stop_reason = "FEE_ESTIMATION_FAILURE_BEFORE_BROADCAST";
    journalWrite(journal);
    throw new Error("FEE_ESTIMATION_FAILURE:" + label);
  }
  const profile = feeInput(estimated);
  if (nondeterministic && profile.budget <= legacyFloor) throw new Error("LEGACY_BUDGET_REJECTED:" + label);
  if (before.balance < profile.feeValue + value) throw new Error("INSUFFICIENT_BALANCE:" + label);
  const record = { label, method, signer: signer.address, args: jsonSafe(args), value: value.toString(), nonce: before.latest, balance_before: before.balance.toString(), fee_value: profile.feeValue.toString(), execution_budget: profile.budget.toString(), distribution: jsonSafe(profile.distribution), phase: "PREPARED", tx_hash: null };
  journal.transactions.push(record); journal.broadcast_count += 0; journalWrite(journal);
  let txHash;
  try { txHash = await writeClient.writeContract({ ...spec, fees: { distribution: profile.distribution, messageAllocations: profile.messageAllocations, feeValue: profile.feeValue } }); } catch (e) { record.phase = "SUBMISSION_STATE_UNCERTAIN"; record.failure = errText(e); journal.failures.push({ label, error: record.failure }); journal.phase = "STOPPED_FIRST_FAILURE"; journalWrite(journal); throw new Error("SUBMISSION_STATE_UNCERTAIN:" + label); }
  if (typeof txHash !== "string" || txHash.length < 8) throw new Error("INVALID_TX_HASH:" + label);
  record.tx_hash = txHash; record.phase = "SUBMITTED_HASH_PERSISTED"; record.broadcast_count = 1; journal.broadcast_count += 1; journal.qualification_writes = journal.broadcast_count; journalWrite(journal);
  let final;
  try { record.phase = "PENDING"; journalWrite(journal); final = await reconcile(readClient, writeClient, txHash, before.latest); } catch (e) { record.phase = "FINALIZATION_OR_EXECUTION_FAILURE"; record.failure = errText(e); journal.failures.push({ label, tx_hash: txHash, error: record.failure }); journal.phase = "STOPPED_FIRST_FAILURE"; journalWrite(journal); throw new Error("QUALIFICATION_STOPPED:" + label); }
  record.receipt = jsonSafe(final.tx); record.status = status(final.tx); record.execution_status = execution(final.tx); record.wait_error = final.waitError;
  record.canonical_readback = jsonSafe(await verify());
  const after = await state(readClient, signer.address); if (after.latest !== after.pending) throw new Error("NONCE_NOT_RECONCILED_AFTER:" + label);
  record.balance_after = after.balance.toString(); record.phase = "COMPLETE"; journalWrite(journal);
  return { txHash, record, readback: parse(record.canonical_readback), before, after };
}
async function verifyPolicy(readClient, policy, target) {
  const value = await read(readClient, "get_policy", [policy.policy_id]);
  if (value.state !== target || value.policy_id !== policy.policy_id || Number(value.version) !== 1 || lower(value.issuer) !== issuer || lower(value.settlement_recipient) !== issuer || String(value.required_fee_wei) !== "10" || value.asset_sha256 !== evidence.reference.sha || Number(value.asset_exact_bytes) !== evidence.reference.bytes || value.asset_source !== evidence.reference.url || value.license_text_sha256 !== policy.license_text_sha256) throw new Error("POLICY_READBACK_MISMATCH");
  return value;
}
async function verifyRequest(readClient, item) {
  const value = await read(readClient, "get_request", [item.request]);
  if (value.request_id !== item.request || value.policy_id !== "policy-v23-lumen-finch-001" || lower(value.requester) !== requester || value.request_digest !== requestDigest(item) || String(value.escrowed_value) !== "10") throw new Error("REQUEST_READBACK_MISMATCH:" + item.request);
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
  if (!value || value.policy_id !== "policy-v23-lumen-finch-001" || value.evidence_id !== item.evidence || Number(value.generation) !== 1 || !["PERMITTED", "DENIED", "INCONCLUSIVE", "NOT_APPLICABLE"].includes(value.result)) throw new Error("ADJUDICATION_READBACK_MISMATCH:" + item.request);
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
async function withdraw({ readClient, writeClient, signer, journal, settlement, result, caseId }) {
  const payout = result === "PERMITTED";
  const method = payout ? "withdraw_claimable" : "withdraw_refund";
  const ledgerMethod = payout ? "get_claimable" : "get_refundable";
  const recipient = payout ? issuer : requester;
  if (lower(signer.address) !== recipient) throw new Error("WITHDRAW_ACTOR_MISMATCH:" + caseId);
  eq(await read(readClient, ledgerMethod, [recipient]), 10, "ENTITLEMENT_BEFORE:" + caseId);
  const tx = await writeTx({
    readClient, writeClient, signer, journal, label: "case-" + caseId + ":" + method, method,
    args: [settlement.settlement_id], value: 0n, nondeterministic: false,
    verify: async () => {
      const settled = await read(readClient, "get_settlement", [settlement.settlement_id]);
      if (!settled.withdrawal_id) throw new Error("WITHDRAWAL_ID_MISSING:" + caseId);
      const record = await read(readClient, "get_withdrawal", [settled.withdrawal_id]);
      if (record.status !== "WITHDRAWAL_EMITTED") throw new Error("WITHDRAWAL_NOT_EMITTED:" + caseId);
      eq(await read(readClient, ledgerMethod, [recipient]), 0, "ENTITLEMENT_AFTER:" + caseId);
      return { settlement: settled, withdrawal: record };
    },
  });
  return { tx_hash: tx.txHash, recipient, amount: "10", balance_before: tx.before.balance.toString(), balance_after: tx.after.balance.toString(), balance_delta: (tx.after.balance - tx.before.balance).toString(), delivery_confirmation: tx.readback.withdrawal.delivery_confirmation, message_evidence: messages(tx.record.receipt) };
}

async function main() {
  if (existsSync(journalPath)) throw new Error("LIVE_V23_JOURNAL_EXISTS_NO_RETRY");
  const source = readFileSync(sourcePath);
  const abi = readFileSync(abiPath);
  const issuerAccount = await loadAccount(issuerName);
  const requesterAccount = await loadAccount(requesterName);
  const operatorAccount = await loadAccount(operatorName);
  if (lower(issuerAccount.address) !== issuer || lower(requesterAccount.address) !== requester || lower(operatorAccount.address) !== operator) throw new Error("ACTOR_ADDRESS_MISMATCH");
  const readClient = createClient({ chain: studioDevnet });
  const issuerClient = createClient({ chain: studioDevnet, account: issuerAccount });
  const requesterClient = createClient({ chain: studioDevnet, account: requesterAccount });
  const operatorClient = createClient({ chain: studioDevnet, account: operatorAccount });
  const canonical = await precondition(readClient, source, abi);
  const publicEvidence = await verifyPublicEvidence();
  const now = await chainNow();
  const policy = policyFor(now);
  const accountStates = {
    issuer: await state(readClient, issuerAccount.address),
    requester: await state(readClient, requesterAccount.address),
    operator: await state(readClient, operatorAccount.address),
  };
  if (Object.values(accountStates).some((x) => x.latest !== x.pending)) throw new Error("ACCOUNT_NONCE_NOT_RECONCILED");
  const createSpec = buildQualificationWriteSpec({ account: issuerAccount, address, functionName: "create_policy", args: policyArgs(policy), kwargs: {}, value: 0n, frozenPolicyFee: fee });
  const createEstimate = feeInput(await issuerClient.estimateTransactionFeesForWrite(createSpec));
  if (process.argv.includes("--preflight")) {
    console.log(JSON.stringify(jsonSafe({ preflight: "PASS", address, chain_id: CHAIN_ID, source_sha256: sha(source).toUpperCase(), abi_sha256: sha(abi).toUpperCase(), canonical, public_evidence: publicEvidence, chain_timestamp: now, policy, account_states: accountStates, create_policy_fee_estimate: createEstimate.normalized }), null, 2));
    return;
  }
  const journal = { schema_version: 2, phase: "PRECONDITION_VERIFIED", network: "studio-dev", chain_id: CHAIN_ID, rpc: RPC_URL, contract_address: address, contract_sha256: CONTRACT_SHA256, abi_sha256: ABI_SHA256, runner: RUNNER, semantic_schema: schema, semantic_keys: keys, actors: { issuer: issuerAccount.address, requester: requesterAccount.address, operator: operatorAccount.address }, chain_timestamp_start: now, policy, policy_digest: jsonHash(policy), public_evidence: publicEvidence, initial_state: canonical, write_limit: 26, broadcast_count: 0, qualification_writes: 0, transactions: [], cases: {}, failures: [], result_shopping: false, adjudication_retries: 0, rebroadcasts: 0 };
  journalWrite(journal);
  const create = await writeTx({ readClient, writeClient: issuerClient, signer: issuerAccount, journal, label: "policy:create", method: "create_policy", args: policyArgs(policy), value: 0n, nondeterministic: false, verify: () => verifyPolicy(readClient, policy, "DRAFT") });
  journal.policy_create_tx = create.txHash;
  journal.phase = "QUALIFICATION_IN_PROGRESS";
  journalWrite(journal);
  const freeze = await writeTx({ readClient, writeClient: issuerClient, signer: issuerAccount, journal, label: "policy:freeze", method: "freeze_policy", args: [policy.policy_id], value: 0n, nondeterministic: false, verify: () => verifyPolicy(readClient, policy, "FROZEN") });
  journal.policy_freeze_tx = freeze.txHash;
  journalWrite(journal);
  for (const caseId of ["A", "B", "C", "D"]) {
    const item = evidence[caseId];
    journal.cases[caseId] = { expected_result: item.expected };
    const req = await writeTx({ readClient, writeClient: requesterClient, signer: requesterAccount, journal, label: "case-" + caseId + ":submit_usage_request", method: "submit_usage_request", args: requestArgs(item), value: fee, nondeterministic: false, verify: () => verifyRequest(readClient, item) });
    journal.cases[caseId].request_tx = req.txHash;
    const ev = await writeTx({ readClient, writeClient: operatorClient, signer: operatorAccount, journal, label: "case-" + caseId + ":commit_evidence", method: "commit_evidence", args: evidenceArgs(item), value: 0n, nondeterministic: false, verify: () => verifyEvidence(readClient, item) });
    journal.cases[caseId].evidence_tx = ev.txHash;
    const au = await writeTx({ readClient, writeClient: operatorClient, signer: operatorAccount, journal, label: "case-" + caseId + ":authenticate_evidence", method: "authenticate_evidence", args: [item.evidence], value: 0n, nondeterministic: true, verify: () => verifyAuth(readClient, item) });
    journal.cases[caseId].authenticate_tx = au.txHash;
    const ad = await writeTx({ readClient, writeClient: operatorClient, signer: operatorAccount, journal, label: "case-" + caseId + ":adjudicate_usage", method: "adjudicate_usage", args: [item.request], value: 0n, nondeterministic: true, verify: () => verifyAdjudication(readClient, item) });
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
    const wd = await withdraw({ readClient, writeClient: adj.result === "PERMITTED" ? issuerClient : requesterClient, signer: adj.result === "PERMITTED" ? issuerAccount : requesterAccount, journal, settlement, result: adj.result, caseId });
    journal.cases[caseId].withdrawal = wd;
    journalWrite(journal);
    console.log(JSON.stringify({ case: caseId, result: adj.result, expected: item.expected, expected_match: journal.cases[caseId].expected_result_match, entitlement: settlement.settlement_type, permit_id: journal.cases[caseId].permit_id, withdrawal_tx: wd.tx_hash }));
  }
  const finalStatus = await read(readClient, "get_status");
  const accounting = await read(readClient, "get_accounting_status");
  const collections = {};
  const idMethods = { policies: "get_policy_ids", requests: "get_request_ids", evidence: "get_evidence_ids", adjudications: "get_adjudication_ids", permits: "get_permit_ids", settlements: "get_settlement_ids", withdrawals: "get_withdrawal_ids" };
  for (const [name, method] of Object.entries(idMethods)) collections[name] = await ids(readClient, method);
  const permitted = Object.values(journal.cases).filter((x) => x.result === "PERMITTED").length;
  if (collections.policies.length !== 1 || collections.requests.length !== 4 || collections.evidence.length !== 4 || collections.adjudications.length !== 4 || collections.settlements.length !== 4 || collections.withdrawals.length !== 4 || collections.permits.length !== permitted) throw new Error("FINAL_COLLECTION_COUNTS_MISMATCH");
  eq(finalStatus.total_escrow_received, 40, "TOTAL_ESCROW_RECEIVED");
  eq(finalStatus.total_escrowed, 0, "LIVE_ESCROW");
  eq(accounting.conservation_rhs, 40, "CONSERVATION");
  eq(accounting.total_payout_allocated, permitted * 10, "PAYOUT_ALLOCATED");
  eq(accounting.total_refund_allocated, (4 - permitted) * 10, "REFUND_ALLOCATED");
  eq(accounting.total_claimable_outstanding, 0, "CLAIMABLE_OUTSTANDING");
  eq(accounting.total_refundable_outstanding, 0, "REFUNDABLE_OUTSTANDING");
  eq(accounting.total_withdrawal_emitted, 40, "WITHDRAWAL_EMITTED");
  journal.final_status = jsonSafe(finalStatus); journal.final_accounting = jsonSafe(accounting); journal.final_collections = jsonSafe(collections); journal.phase = "QUALIFICATION_AND_WITHDRAWAL_VERIFIED"; journalWrite(journal);
  console.log(JSON.stringify({ phase: journal.phase, status: finalStatus, accounting, collections }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("RUNNER_STOPPED:" + errText(error).split("\n")[0]);
  if (error?.stack) console.error(error.stack);
  process.exitCode = 1;
}
