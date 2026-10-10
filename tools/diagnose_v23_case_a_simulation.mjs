import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SDK = "C:/Users/DELL/CharterLock/frontend/node_modules/genlayer-js/dist/";
const { createAccount, createClient } = await import(pathToFileURL(join(SDK, "index.js")));
const { studioDevnet } = await import(pathToFileURL(join(SDK, "chains", "index.js")));
const address = "0xfB3335350b0e02ceFb384753990E9B377B4BCB1F";
const requesterAddress = "0x61f10cc252ed98ce7596c73fc557cca4cc600c82";
const outputPath = join(process.cwd(), "docs", "provenance", "simulations", "v23-case-a-simulation.json");

function safe(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safe(v)]));
  return value;
}
function describe(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /private.?key|mnemonic|password|secret/i.test(key) ? "[REDACTED]" : redact(item),
    ]));
  }
  return value;
}
function loadAccount(name) {
  const packagePath = join(process.env.APPDATA ?? "", "npm", "node_modules", "genlayer", "package.json");
  if (!existsSync(packagePath)) throw new Error("GENLAYER_CLI_PACKAGE_NOT_FOUND");
  const keytar = createRequire(packagePath)("keytar");
  return keytar.getPassword("genlayer-cli", `account:${name}`).then((secret) => {
    if (typeof secret !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new Error("ACCOUNT_SECRET_UNAVAILABLE");
    const account = createAccount(secret);
    if (account.address.toLowerCase() !== requesterAddress) throw new Error("REQUESTER_ADDRESS_MISMATCH");
    return account;
  });
}

const account = await loadAccount("agentpact-requester");
const client = createClient({ chain: studioDevnet, account });
const captured = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  let requestBody = null;
  try { requestBody = JSON.parse(init?.body ?? "null"); } catch { requestBody = { parse_error: true }; }
  const method = requestBody?.method;
  const response = await originalFetch(input, init);
  if (method === "sim_estimateTransactionFees" || method === "sim_call") {
    let responseBody = null;
    try { responseBody = JSON.parse(await response.clone().text()); } catch { responseBody = { parse_error: true }; }
    const params = requestBody?.params?.[0];
    captured.push({
      method,
      request: redact({
        ...requestBody,
        params: [{
          ...params,
          data_sha256: typeof params?.data === "string" ? hash(Buffer.from(params.data.slice(2), "hex")) : null,
          data_bytes: typeof params?.data === "string" ? Math.floor((params.data.length - 2) / 2) : null,
        }],
      }),
      response_status: response.status,
      response: redact(responseBody),
    });
  }
  return response;
};
const originalRequest = client.request.bind(client);
client.request = async (request) => {
  if (request?.method === "sim_estimateTransactionFees" || request?.method === "sim_call") {
    const raw = safe(request);
    const params = raw?.params?.[0];
    captured.push({
      method: request.method,
      payload: {
        ...params,
        data_sha256: typeof params?.data === "string" ? hash(Buffer.from(params.data.slice(2), "hex")) : null,
        data_bytes: typeof params?.data === "string" ? Math.floor((params.data.length - 2) / 2) : null,
      },
    });
  }
  return originalRequest(request);
};

const write = {
  account,
  address,
  functionName: "submit_usage_request",
  args: [
    "v23-request-case-a",
    "policy-v23-lumen-finch-001",
    1n,
    "Commercial technology newsletter editorial use",
    "newsletter",
    "Independent editorial article with no endorsement or recommendation.",
    "da782460a0de765d49ebcbe4f116cfab0c42b42d3aea99e4bfc3763e5b63f223",
    52132n,
    "image/png",
    "",
    "Image courtesy of Lumen Finch Studio",
  ],
  kwargs: {},
  value: 10n,
};

const report = {
  network: "studio-dev",
  chain_id: studioDevnet.id,
  contract: address,
  signer: account.address,
  write_spec: safe({ ...write, account: { address: account.address } }),
  estimate: { status: "NOT_RUN", error: null },
  simulate_write: { status: "NOT_RUN", error: null },
  simulate_write_finalized: { status: "NOT_RUN", error: null },
  captured_rpc: captured,
};

try {
  const result = await client.estimateTransactionFeesForWrite(write);
  report.estimate = { status: "PASS", result: safe(result) };
} catch (error) {
  report.estimate = { status: "FAIL", error: describe(error) };
}

try {
  const result = await client.simulateWriteContract({ ...write, includeReceipt: true });
  report.simulate_write = { status: "PASS", result: safe(result) };
} catch (error) {
  report.simulate_write = { status: "FAIL", error: describe(error) };
}

try {
  const result = await client.simulateWriteContract({
    ...write,
    includeReceipt: true,
    transactionHashVariant: "latest-finalized",
  });
  report.simulate_write_finalized = { status: "PASS", result: safe(result) };
} catch (error) {
  report.simulate_write_finalized = { status: "FAIL", error: describe(error) };
}

report.captured_rpc = captured;
mkdirSync(join(process.cwd(), "docs", "provenance", "simulations"), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: outputPath,
  estimate: report.estimate,
  simulate_write: report.simulate_write,
  simulate_write_finalized: report.simulate_write_finalized,
  rpc_methods: captured.map((x) => x.method),
  rpc_payloads: captured.map((x) => ({ method: x.method, payload: x.payload })),
}, null, 2));
