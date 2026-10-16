import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  V24_ABI_SHA256,
  V24_SOURCE_SHA256,
  assertAbiShape,
  assertCandidateBytes,
} from "./rightsrail_v24_gate.mjs";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, process.env.RIGHTSRAIL_V24_SOURCE ?? "contracts/rightsrail_v24.py");
const abiPath = resolve(root, process.env.RIGHTSRAIL_V24_ABI ?? "artifacts/rightsrail-v24.abi.json");

if (!existsSync(sourcePath) || !existsSync(abiPath)) {
  throw new Error(`V24_CANDIDATE_MISSING:${sourcePath}:${abiPath}`);
}

const sourceBytes = readFileSync(sourcePath);
const abiBytes = readFileSync(abiPath);
const hashes = assertCandidateBytes({ sourceBytes, abiBytes });
const shape = assertAbiShape(abiBytes);
if (hashes.sourceSha256 !== V24_SOURCE_SHA256 || hashes.abiSha256 !== V24_ABI_SHA256) {
  throw new Error("V24_AUTHORITY_CONSTANTS_MISMATCH");
}
console.log(JSON.stringify({ sourcePath, abiPath, ...hashes, shape }, null, 2));
