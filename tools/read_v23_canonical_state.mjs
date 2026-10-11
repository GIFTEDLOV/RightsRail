import { pathToFileURL } from "node:url";

const SDK = "C:/Users/DELL/CharterLock/frontend/node_modules/genlayer-js/dist/";
const { createClient } = await import(pathToFileURL(`${SDK}index.js`));
const { studioDevnet } = await import(pathToFileURL(`${SDK}chains/index.js`));

const RPC = "https://studio-dev.genlayer.com/api";
const ADDRESS = "0xfB3335350b0e02ceFb384753990E9B377B4BCB1F";
const client = createClient({ chain: studioDevnet });

function parse(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

async function read(functionName, args = []) {
  return parse(await client.readContract({ address: ADDRESS, functionName, args }));
}

const block = await client.request({ method: "eth_getBlockByNumber", params: ["latest", false] });
const ids = {};
for (const [name, method] of Object.entries({
  policies: "get_policy_ids",
  requests: "get_request_ids",
  evidence: "get_evidence_ids",
  adjudications: "get_adjudication_ids",
  permits: "get_permit_ids",
  settlements: "get_settlement_ids",
  withdrawals: "get_withdrawal_ids",
})) {
  ids[name] = await read(method, [0n, 64n]);
}

console.log(JSON.stringify({
  rpc: RPC,
  address: ADDRESS,
  latest_block_timestamp_raw: block.timestamp,
  latest_block_timestamp: Number(BigInt(block.timestamp)),
  policy: await read("get_policy", ["policy-v23-lumen-finch-001"]),
  status: await read("get_status"),
  accounting: await read("get_accounting_status"),
  ids,
}, null, 2));
