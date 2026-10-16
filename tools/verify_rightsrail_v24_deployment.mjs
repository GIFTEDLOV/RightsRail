/** Read-only verification of the final Studionet deployment and receipt. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ABI_SHA256, CHAIN_ID, CONTRACT_SHA256, RPC_URL } from "./deployment_fee_policy_v24.mjs";
import { assertAbiShape, assertCandidateBytes, inspectSchemaShape } from "./rightsrail_v24_gate.mjs";
import { assertStudionetConfig, NETWORK, readClient, safeJson, statusName, executionName } from "./genlayer_studionet.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail_v24.py");
const abiPath = join(root, "artifacts", "rightsrail-v24.abi.json");
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-v24-studionet-deployment.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
const parse = (value) => { if (typeof value === "string") { try { return JSON.parse(value); } catch { return value; } } return value; };

async function main() {
  assertStudionetConfig();
  if (NETWORK.chainId !== CHAIN_ID || NETWORK.rpc !== RPC_URL) throw new Error("STUDIONET_NETWORK_PIN_MISMATCH");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  if (journal.network?.alias !== "studionet" || journal.network?.chain_id !== CHAIN_ID) throw new Error("DEPLOYMENT_JOURNAL_NETWORK_MISMATCH");
  if (journal.broadcast_count !== 1 || !journal.transaction_id) throw new Error("DEPLOYMENT_TRANSACTION_NOT_RECORDED");
  const source = readFileSync(sourcePath);
  const abi = readFileSync(abiPath);
  const hashes = assertCandidateBytes({ sourceBytes: source, abiBytes: abi });
  const localShape = assertAbiShape(abi);
  const client = readClient();
  const receipt = await client.getTransaction({ hash: journal.transaction_id });
  const status = statusName(receipt);
  const execution = executionName(receipt);
  if (status !== "FINALIZED" || execution !== "FINISHED_WITH_RETURN") throw new Error(`DEPLOYMENT_RECEIPT_NOT_SUCCESSFUL:${status}:${execution}`);
  const address = journal.contract_address ?? receipt?.data?.contract_address ?? receipt?.contract_address ?? receipt?.txDataDecoded?.contractAddress;
  if (typeof address !== "string" || !/^0x[\da-fA-F]{40}$/.test(address)) throw new Error("DEPLOYMENT_ADDRESS_MISSING");
  const schema = await client.getContractSchema(address);
  const shape = inspectSchemaShape(schema);
  const deployedSource = await client.getContractCode(address);
  if (hash(Buffer.from(deployedSource, "utf8")) !== CONTRACT_SHA256) throw new Error("DEPLOYED_SOURCE_IDENTITY_MISMATCH");
  if (JSON.stringify(shape) !== JSON.stringify(localShape)) throw new Error("DEPLOYED_SCHEMA_SHAPE_MISMATCH");
  const localNames = Object.keys(JSON.parse(abi.toString("utf8")).methods).sort();
  if (JSON.stringify(Object.keys(schema.methods ?? {}).sort()) !== JSON.stringify(localNames)) throw new Error("DEPLOYED_SCHEMA_METHODS_MISMATCH");
  const read = async (method, args = []) => parse(await client.readContract({ address, functionName: method, args }));
  const [statusRecord, accounting, audit] = await Promise.all([read("get_status"), read("get_accounting_status"), read("get_audit_events", [0n, 100n])]);
  if (JSON.stringify(statusRecord) !== JSON.stringify(journal.verification?.initial_status)) throw new Error("INITIAL_STATUS_JOURNAL_MISMATCH");
  if (JSON.stringify(accounting) !== JSON.stringify(journal.verification?.initial_accounting)) throw new Error("INITIAL_ACCOUNTING_JOURNAL_MISMATCH");
  if (!Array.isArray(audit) || audit.length !== 0) throw new Error("INITIAL_AUDIT_READBACK_MISMATCH");
  const verification = {
    verified_at_utc: new Date().toISOString(),
    network: { alias: NETWORK.alias, rpc: NETWORK.rpc, chain_id: NETWORK.chainId },
    candidate: { source_sha256: hashes.sourceHash, abi_sha256: hashes.abiHash, deployed_source_sha256: hash(Buffer.from(deployedSource, "utf8")), schema_shape: shape, get_audit_events_readonly: schema.methods?.get_audit_events?.readonly === true },
    transaction: { hash: journal.transaction_id, status, execution_status: execution, receipt: safeJson(receipt) },
    contract_address: address,
    initial_state: { status: safeJson(statusRecord), accounting: safeJson(accounting), audit_events: audit.length },
  };
  journal.verification = { ...journal.verification, ...verification, source_parity: true, abi_schema_parity: true, initial_state_verified: true };
  journal.phase = "DEPLOYMENT_VERIFIED";
  journal.status = status;
  journal.execution_status = execution;
  journal.contract_address = address;
  journal.receipt = safeJson(receipt);
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(verification, null, 2));
}

main().catch((error) => { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; });
