import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ABI_SHA256,
  CHAIN_ID,
  CONTRACT_SHA256,
  DEPLOYER,
  RPC_URL,
  RUNNER,
  assertPreSignDeploymentRequest,
  buildProvenStudioDevFees,
} from "./deployment_fee_policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail.py");
const abiPath = join(root, "artifacts", "rightsrail.abi.json");
const outputPath = join(root, "docs", "provenance", "rightsrail-deployment-attempt-2-prepared.json");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`RPC_HTTP_${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC_${body.error.code}:${body.error.message}`);
  return body.result;
}

async function importSdk() {
  const candidates = [
    process.env.RIGHTSRAIL_GENLAYER_JS_PATH,
    join(root, "node_modules", "genlayer-js", "dist", "index.js"),
    "C:/Users/DELL/CharterLock/frontend/node_modules/genlayer-js/dist/index.js",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const sdk = await import(pathToFileURL(candidate));
      const chainsPath = join(dirname(candidate), "chains", "index.js");
      const chains = await import(pathToFileURL(chainsPath));
      return { sdk, studioDevnet: chains.studioDevnet, path: candidate };
    }
  }
  throw new Error("GENLAYER_JS_RC_SDK_NOT_FOUND");
}

function hexToBigInt(value) {
  return BigInt(value);
}

const sourceBytes = readFileSync(sourcePath);
const abiBytes = readFileSync(abiPath);
const sourceSha256 = sha256(sourceBytes);
const abiSha256 = sha256(abiBytes);
if (sourceSha256 !== CONTRACT_SHA256) throw new Error("CONTRACT_HASH_MISMATCH");
if (abiSha256 !== ABI_SHA256) throw new Error("ABI_HASH_MISMATCH");

const { sdk, studioDevnet, path: sdkPath } = await importSdk();
if (studioDevnet.id !== CHAIN_ID) throw new Error("SDK_CHAIN_ID_MISMATCH");
const client = sdk.createClient({ chain: studioDevnet });

// This is a read-only SDK call. deployContract is intentionally never called.
const rawEstimate = await client.estimateTransactionFees();
const currentFeePolicy = await client.getCurrentFeePolicy();
const fees = buildProvenStudioDevFees(rawEstimate);

const [latestHex, pendingHex, balanceHex] = await Promise.all([
  rpc("eth_getTransactionCount", [DEPLOYER, "latest"]),
  rpc("eth_getTransactionCount", [DEPLOYER, "pending"]),
  rpc("eth_getBalance", [DEPLOYER, "latest"]),
]);
const latestNonce = Number(hexToBigInt(latestHex));
const pendingNonce = Number(hexToBigInt(pendingHex));
const balance = hexToBigInt(balanceHex);

const request = {
  preparedAt: new Date().toISOString(),
  broadcasted: false,
  signed: false,
  chainId: CHAIN_ID,
  rpc: RPC_URL,
  sender: DEPLOYER,
  nonce: latestNonce,
  latestNonce,
  pendingNonce,
  balanceWei: balance.toString(),
  runner: RUNNER,
  sourcePath: "contracts/rightsrail.py",
  sourceBytes: sourceBytes.length,
  sourceSha256,
  abiPath: "artifacts/rightsrail.abi.json",
  abiBytes: abiBytes.length,
  abiSha256,
  userValue: "0",
  constructorArgs: [],
  constructorKwargs: {},
  observedReceiptCost: fees.observedReceiptCost,
  fees,
  currentFeePolicy,
  sdk: {
    package: "genlayer-js",
    path: sdkPath,
    explicitCall: "client.deployContract({ account, code, args: [], kwargs: {}, fees })",
    invoked: false,
  },
};

assertPreSignDeploymentRequest(request);
writeFileSync(outputPath, `${JSON.stringify(request, (_, value) => typeof value === "bigint" ? value.toString() : value, 2)}\n`, "utf8");
console.log(JSON.stringify(request, (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
