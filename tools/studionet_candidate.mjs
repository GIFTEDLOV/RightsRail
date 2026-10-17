import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { NETWORK } from "./genlayer_studionet.mjs";

export const MANIFEST = JSON.parse(readFileSync(new URL("../provenance/studionet-candidate-manifest.json", import.meta.url)));
export const DEPLOYER = "0x33653e6e86807e41682d3346cdf648d6653384b1";
export const CONTRACT_SHA256 = MANIFEST.source_sha256;
export const ABI_SHA256 = MANIFEST.abi_sha256;
export const RUNNER = MANIFEST.runner;
export const CHAIN_ID = NETWORK.chainId;
export const RPC_URL = NETWORK.rpc;
export const NETWORK_ALIAS = NETWORK.alias;
export const DEPLOYMENT_JOURNAL = "docs/provenance/live-transactions/rightsrail-studionet-deployment.json";
export const QUALIFICATION_JOURNAL = "docs/provenance/live-transactions/rightsrail-studionet-qualification.json";
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
export const canonical = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : typeof v === "bigint" ? v.toString() : v);
export function verifyCandidate() {
  const source = readFileSync(MANIFEST.source);
  const abiBytes = readFileSync(MANIFEST.abi);
  if (hash(source) !== CONTRACT_SHA256 || hash(abiBytes) !== ABI_SHA256) throw new Error("CANDIDATE_MANIFEST_HASH_MISMATCH");
  const abi = JSON.parse(abiBytes);
  const methods = Object.values(abi.methods);
  if (methods.length !== 36 || methods.filter((m) => m.readonly === true).length !== 24 || abi.methods.get_audit_events.readonly !== true) throw new Error("CANDIDATE_SCHEMA_MISMATCH");
  if (!source.toString().startsWith(`# { "Depends": "${RUNNER}" }`)) throw new Error("CANDIDATE_RUNNER_MISMATCH");
  return { source: source.toString(), abi, sourceSha256: CONTRACT_SHA256, abiSha256: ABI_SHA256 };
}
