import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { readClient, rpc, NETWORK, verifyStudionetFeePolicy, safeJson } from "./genlayer_studionet.mjs";

const sourcePath = "contracts/rightsrail_studionet.py";
const abiPath = "artifacts/rightsrail-studionet.abi.json";
const signer = "0x33653e6e86807e41682d3346cdf648d6653384b1";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
const code = readFileSync(sourcePath, "utf8");
console.log("Generating exact stable Studionet schema (read-only)...");
const client = readClient();
const schema = await client.getContractSchemaForCode(code);
if (!schema?.methods) throw new Error("STUDIONET_GENERATED_SCHEMA_MISSING");
const names = Object.keys(schema.methods);
const shape = { methods: names.length, reads: names.filter((n) => schema.methods[n].readonly === true).length, writes: names.filter((n) => schema.methods[n].readonly !== true).length };
if (shape.methods !== 36 || shape.reads !== 24 || shape.writes !== 12 || schema.methods.get_audit_events?.readonly !== true) throw new Error("STUDIONET_GENERATED_SCHEMA_MISMATCH");
writeFileSync(abiPath, JSON.stringify(schema, null, 2) + "\n");
const history = await rpc("sim_getTransactionsForAddress", [signer]);
if (!Array.isArray(history)) throw new Error("SIGNER_HISTORY_UNAVAILABLE");
const deployments = history.filter((tx) => Number(tx.type) === 1).map((tx) => ({ hash: tx.hash, status: tx.status, address: tx.data?.contract_address ?? null, source_sha256: typeof tx.data?.contract_code === "string" ? hash(tx.data.contract_code) : null }));
const policy = await verifyStudionetFeePolicy();
const manifest = {
  product: "RightsRail", version: "2.4.1", network: NETWORK,
  source: sourcePath, source_sha256: hash(readFileSync(sourcePath)),
  abi: abiPath, abi_sha256: hash(readFileSync(abiPath)), schema_shape: shape,
  baseline_source_sha256: hash(readFileSync("contracts/rightsrail_v24.py")),
  runner: code.split("\n")[0].match(/py-genlayer:[^"]+/)[0],
  schema_generation: { tool: "genlayer-js 1.1.8 getContractSchemaForCode", network_alias: "studionet", rpc: NETWORK.rpc, generated_at: new Date().toISOString() },
  fee_policy: policy,
};
writeFileSync("provenance/studionet-candidate-manifest.json", JSON.stringify(safeJson(manifest), null, 2) + "\n");
writeFileSync("docs/provenance/rightsrail-studionet-preflight.json", JSON.stringify(safeJson({ ...manifest, signer, existing_deployments: deployments, latest_nonce: await rpc("eth_getTransactionCount", [signer, "latest"]), pending_nonce: await rpc("eth_getTransactionCount", [signer, "pending"]), balance_wei: BigInt(await rpc("eth_getBalance", [signer, "latest"])).toString(), broadcast_count: 0 }), null, 2) + "\n");
console.log(JSON.stringify({ ...manifest, existing_deployments: deployments }, null, 2));
