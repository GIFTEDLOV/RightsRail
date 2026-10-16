import { createHash } from "node:crypto";

export const V24_SOURCE_SHA256 =
  "5C99DEB31EB29B171B94F343950CBFF5204945D02160B2ADA3D742A1FFC6D321";
export const V24_ABI_SHA256 =
  "11548EA63B1C365C7985BE8C748109C4B7F4A33A1A55DE8394EF1CE90E6BE4EA";
export const V24_CHAIN_ID = 61999;
export const V24_RPC_URL = "https://studio.genlayer.com/api";
export const V24_SCHEMA = "RIGHTSRAIL_USAGE_V1";
export const V24_METHOD_COUNTS = Object.freeze({ total: 36, reads: 24, writes: 12 });
export const V24_LIMITS = Object.freeze({ deployments: 1, qualificationWrites: 24 });
export const V24_DEPLOYMENT_JOURNAL =
  "docs/provenance/live-transactions/rightsrail-v24-studionet-deployment.json";
export const V24_QUALIFICATION_JOURNAL =
  "docs/provenance/live-transactions/rightsrail-v24-studionet-qualification.json";

const PNG_SIGNATURE = "89504e470d0a1a0a";
const CASES = ["REFERENCE", "CASE_A", "CASE_B", "CASE_C", "CASE_D"];
const MANIFEST_KEYS = ["schema", "status", "host", "source", "entries"];
const ENTRY_KEYS = [
  "case",
  "role",
  "filename",
  "url",
  "mime",
  "exact_bytes",
  "sha256",
  "expected_result",
];

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

export function assertCandidateBytes({ sourceBytes, abiBytes }) {
  const sourceSha256 = digest(sourceBytes);
  const abiSha256 = digest(abiBytes);
  if (sourceSha256 !== V24_SOURCE_SHA256) fail("V24_SOURCE_HASH_MISMATCH", sourceSha256);
  if (abiSha256 !== V24_ABI_SHA256) fail("V24_ABI_HASH_MISMATCH", abiSha256);
  return { sourceSha256, abiSha256 };
}

export function inspectAbiShape(abiBytes) {
  let abi;
  try {
    abi = JSON.parse(Buffer.from(abiBytes).toString("utf8"));
  } catch {
    fail("V24_ABI_INVALID_JSON");
  }
  return inspectSchemaShape(requireObject(abi, "V24_ABI_INVALID"));
}

export function inspectSchemaShape(schema) {
  const methods = requireObject(schema, "V24_SCHEMA_INVALID").methods;
  requireObject(methods, "V24_ABI_METHODS_MISSING");
  const names = Object.keys(methods);
  const reads = names.filter((name) => methods[name]?.readonly === true);
  const writes = names.filter((name) => methods[name]?.readonly !== true);
  return { total: names.length, reads: reads.length, writes: writes.length };
}

export function assertAbiShape(abiBytes) {
  const shape = inspectAbiShape(abiBytes);
  if (
    shape.total !== V24_METHOD_COUNTS.total ||
    shape.reads !== V24_METHOD_COUNTS.reads ||
    shape.writes !== V24_METHOD_COUNTS.writes
  ) {
    fail("V24_ABI_METHOD_COUNTS_MISMATCH", JSON.stringify(shape));
  }
  return shape;
}

export function assertSchemaShape(schema) {
  const shape = inspectSchemaShape(schema);
  if (
    shape.total !== V24_METHOD_COUNTS.total ||
    shape.reads !== V24_METHOD_COUNTS.reads ||
    shape.writes !== V24_METHOD_COUNTS.writes
  ) {
    fail("V24_SCHEMA_METHOD_COUNTS_MISMATCH", JSON.stringify(shape));
  }
  return shape;
}

export function assertStrictPngManifest(manifest) {
  const value = requireObject(manifest, "V24_MANIFEST_INVALID");
  if (Object.keys(value).sort().join("|") !== MANIFEST_KEYS.slice().sort().join("|")) {
    fail("V24_MANIFEST_FIELDS_MISMATCH");
  }
  if (value.schema !== "RIGHTSRAIL_EVIDENCE_MANIFEST_V1") fail("V24_MANIFEST_SCHEMA_MISMATCH");
  if (value.status !== "PUBLICLY_HOSTED_BYTE_VERIFIED") fail("V24_MANIFEST_STATUS_MISMATCH");
  if (typeof value.host !== "string" || !value.host.startsWith("https://")) {
    fail("V24_MANIFEST_HOST_MISMATCH");
  }
  if (!Array.isArray(value.entries) || value.entries.length !== CASES.length) {
    fail("V24_MANIFEST_ENTRY_COUNT_MISMATCH");
  }
  const seen = new Set();
  for (const entry of value.entries) {
    requireObject(entry, "V24_MANIFEST_ENTRY_INVALID");
    if (Object.keys(entry).sort().join("|") !== ENTRY_KEYS.slice().sort().join("|")) {
      fail("V24_MANIFEST_ENTRY_FIELDS_MISMATCH");
    }
    if (!CASES.includes(entry.case) || seen.has(entry.case)) fail("V24_MANIFEST_CASE_SET_MISMATCH");
    seen.add(entry.case);
    if (entry.mime !== "image/png" || !String(entry.filename).endsWith(".png")) {
      fail("V24_MANIFEST_PNG_TYPE_MISMATCH", entry.case);
    }
    if (typeof entry.url !== "string" || !entry.url.startsWith(`${value.host}/`)) {
      fail("V24_MANIFEST_URL_MISMATCH", entry.case);
    }
    if (!Number.isInteger(entry.exact_bytes) || entry.exact_bytes <= 0) {
      fail("V24_MANIFEST_BYTE_LENGTH_INVALID", entry.case);
    }
    if (!/^[0-9a-f]{64}$/i.test(entry.sha256)) fail("V24_MANIFEST_SHA_INVALID", entry.case);
    if (entry.case === "REFERENCE" && entry.expected_result !== null) {
      fail("V24_REFERENCE_RESULT_MUST_BE_NULL");
    }
    if (entry.case !== "REFERENCE" && typeof entry.expected_result !== "string") {
      fail("V24_CASE_RESULT_MISSING", entry.case);
    }
  }
  if (seen.size !== CASES.length) fail("V24_MANIFEST_CASE_SET_MISMATCH");
  return value.entries;
}

export async function fetchAndVerifyStrictPngManifest(manifest, fetchImpl = fetch) {
  const entries = assertStrictPngManifest(manifest);
  const verified = [];
  for (const entry of entries) {
    const response = await fetchImpl(entry.url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const actualSha256 = digest(bytes).toLowerCase();
    const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
    if (
      response.status !== 200 ||
      !contentType.startsWith("image/png") ||
      bytes.length !== entry.exact_bytes ||
      actualSha256 !== entry.sha256.toLowerCase() ||
      bytes.subarray(0, 8).toString("hex") !== PNG_SIGNATURE
    ) {
      fail("V24_PUBLIC_PNG_MISMATCH", entry.case);
    }
    verified.push({
      case: entry.case,
      url: entry.url,
      status: response.status,
      content_type: response.headers.get("content-type"),
      exact_bytes: bytes.length,
      sha256: actualSha256,
    });
  }
  return verified;
}

export function createV24Journal(kind) {
  if (kind !== "deployment" && kind !== "qualification") fail("V24_JOURNAL_KIND_INVALID");
  return {
    schema: "RIGHTSRAIL_V24_TRANSACTION_JOURNAL_V1",
    network_alias: "studionet",
    version: "2.4.0",
    kind,
    chain_id: V24_CHAIN_ID,
    rpc: V24_RPC_URL,
    source_sha256: V24_SOURCE_SHA256,
    abi_sha256: V24_ABI_SHA256,
    phase: "PRECONDITION",
    deployment_count: 0,
    qualification_writes: 0,
    broadcast_count: 0,
    transactions: [],
    failures: [],
  };
}

function persist(journal, persistJournal) {
  if (typeof persistJournal !== "function") fail("V24_JOURNAL_PERSIST_CALLBACK_REQUIRED");
  persistJournal(journal);
}

export function appendPreBroadcast(journal, { label, method, nonce, args, value }, persistJournal) {
  requireObject(journal, "V24_JOURNAL_INVALID");
  if (journal.broadcast_count >= V24_LIMITS.qualificationWrites) fail("V24_QUALIFICATION_WRITE_LIMIT");
  const record = {
    label,
    method,
    nonce,
    args,
    value: String(value),
    phase: "PRE_BROADCAST",
    tx_hash: null,
  };
  journal.transactions.push(record);
  persist(journal, persistJournal);
  return record;
}

export async function submitExactlyOnce(journal, spec, write, persistJournal) {
  const record = appendPreBroadcast(journal, spec, persistJournal);
  let txHash;
  try {
    txHash = await write();
  } catch (error) {
    record.phase = "SUBMISSION_STATE_UNCERTAIN";
    record.error = String(error);
    journal.phase = "STOPPED_UNCERTAIN_BROADCAST";
    journal.failures.push({ label: record.label, reason: "UNCERTAIN_BROADCAST" });
    persist(journal, persistJournal);
    fail("V24_UNCERTAIN_BROADCAST", record.label);
  }
  if (typeof txHash !== "string" || txHash.length < 8) {
    record.phase = "SUBMISSION_STATE_UNCERTAIN";
    journal.phase = "STOPPED_UNCERTAIN_BROADCAST";
    journal.failures.push({ label: record.label, reason: "MISSING_TRANSACTION_HASH" });
    persist(journal, persistJournal);
    fail("V24_UNCERTAIN_BROADCAST", record.label);
  }
  record.tx_hash = txHash;
  record.phase = "SUBMITTED_HASH_PERSISTED";
  journal.broadcast_count += 1;
  journal.qualification_writes = journal.broadcast_count;
  persist(journal, persistJournal);
  return record;
}

export function assertPolicyCheckpoint(journal) {
  const records = new Map(journal.transactions.map((item) => [item.label, item]));
  for (const label of ["policy:create", "policy:freeze"]) {
    const record = records.get(label);
    if (
      !record ||
      record.phase !== "COMPLETE" ||
      record.status !== "FINALIZED" ||
      record.execution_status !== "FINISHED_WITH_RETURN"
    ) {
      fail("V24_POLICY_CHECKPOINT_MISSING", label);
    }
  }
  return true;
}

export function assertCaseAStudionetPreflight(report) {
  requireObject(report, "V24_CASE_A_PREFLIGHT_INVALID");
  if (report.broadcasted !== false || report.write_submitted !== false) {
    fail("V24_CASE_A_PREFLIGHT_NOT_READ_ONLY");
  }
  if (
    report.simulation_status !== "PASS" ||
    report.fee_model_status !== "GASLESS_VERIFIED" ||
    report.fee_estimate?.gasless !== true ||
    (report.fee_estimate.feeValue !== undefined && BigInt(report.fee_estimate.feeValue) !== 0n)
  ) {
    fail("V24_CASE_A_PREFLIGHT_FAILED");
  }
  if (report.network_alias !== "studionet") fail("V24_CASE_A_NETWORK_MISMATCH");
  if (String(report.user_value_wei) !== "10") fail("V24_CASE_A_VALUE_MISMATCH");
  return true;
}

export function assertQualificationBound(journal) {
  if (journal.broadcast_count > V24_LIMITS.qualificationWrites) {
    fail("V24_QUALIFICATION_WRITE_LIMIT");
  }
  if (journal.deployment_count > V24_LIMITS.deployments) fail("V24_DEPLOYMENT_LIMIT");
  return true;
}
