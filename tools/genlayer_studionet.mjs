/** Stable GenLayerJS helpers for the built-in Studionet configuration. */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const NETWORK = Object.freeze({
  alias: "studionet",
  chainId: 61999,
  rpc: "https://studio.genlayer.com/api",
  consensusMain: "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575",
  consensusData: "0x88B0F18613Db92Bf970FfE264E02496e20a74D16",
});

export function assertStudionetConfig() {
  if (studionet.id !== NETWORK.chainId) throw new Error("STUDIONET_CHAIN_ID_MISMATCH");
  if (studionet.rpcUrls.default.http[0] !== NETWORK.rpc) throw new Error("STUDIONET_RPC_MISMATCH");
  if (studionet.consensusMainContract?.address?.toLowerCase() !== NETWORK.consensusMain.toLowerCase()) {
    throw new Error("STUDIONET_CONSENSUS_MAIN_MISMATCH");
  }
  if (studionet.consensusDataContract?.address?.toLowerCase() !== NETWORK.consensusData.toLowerCase()) {
    throw new Error("STUDIONET_CONSENSUS_DATA_MISMATCH");
  }
  return true;
}

export function readClient(account) {
  assertStudionetConfig();
  return createClient(account ? { chain: studionet, account } : { chain: studionet });
}

/** Require the documented SDK quote before any contract transaction. */
export async function requireGaslessFeeEstimate(client) {
  if (typeof client.estimateTransactionFees !== "function") {
    throw new Error("STUDIONET_FEE_ESTIMATOR_UNAVAILABLE_IN_INSTALLED_SDK");
  }
  const estimate = await client.estimateTransactionFees();
  if (estimate?.gasless !== true) {
    throw new Error("STUDIONET_FEE_QUOTE_DID_NOT_CONFIRM_GASLESS_EXECUTION");
  }
  if (estimate.feeValue !== undefined && BigInt(estimate.feeValue) !== 0n) {
    throw new Error("STUDIONET_GASLESS_QUOTE_HAS_NONZERO_FEE_VALUE");
  }
  return estimate;
}

export async function loadConfiguredAccount(name, expectedAddress) {
  const cliPackage = join(process.env.APPDATA ?? "", "npm", "node_modules", "genlayer", "package.json");
  if (!existsSync(cliPackage)) throw new Error("GENLAYER_CLI_KEYRING_NOT_FOUND");
  const cliConfigPath = join(process.env.USERPROFILE ?? "", ".genlayer", "genlayer-config.json");
  if (!existsSync(cliConfigPath)) throw new Error("GENLAYER_CLI_NETWORK_CONFIG_NOT_FOUND");
  const cliConfig = JSON.parse(readFileSync(cliConfigPath, "utf8"));
  if (cliConfig.network !== NETWORK.alias) throw new Error(`CONFIGURED_NETWORK_MISMATCH:${cliConfig.network}`);
  const keytar = createRequire(cliPackage)("keytar");
  const privateKey = await keytar.getPassword("genlayer-cli", `account:${name}`);
  if (typeof privateKey !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(`EXISTING_ACCOUNT_SECRET_UNAVAILABLE:${name}`);
  }
  const account = createAccount(privateKey);
  if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(`ACCOUNT_ADDRESS_MISMATCH:${name}`);
  }
  return account;
}

export async function rpc(method, params) {
  assertStudionetConfig();
  const response = await fetch(NETWORK.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`RPC_HTTP_${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC_${body.error.code}:${body.error.message}`);
  return body.result;
}

export function safeJson(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(safeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeJson(item)]));
  }
  return value;
}

export function statusName(tx) {
  return tx?.statusName ?? tx?.status ?? tx?.consensusStatus ?? null;
}

export function executionName(tx) {
  return tx?.txExecutionResultName ?? tx?.executionResultName ?? tx?.execution_result ?? null;
}

/** Poll the same hash until terminal finality. Never submits or rebroadcasts. */
export async function pollFinal(client, hash, { onPoll = () => {}, timeoutMs = 40 * 60_000, intervalMs = 10_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let transientDelay = intervalMs;
  while (Date.now() < deadline) {
    let tx;
    try {
      tx = await client.getTransaction({ hash });
      transientDelay = intervalMs;
    } catch (error) {
      if (!/429|rate limit|server busy|temporarily unavailable|timeout|reconnect/i.test(String(error?.message ?? error))) throw error;
      await new Promise((resolve) => setTimeout(resolve, transientDelay));
      transientDelay = Math.min(60_000, transientDelay * 2);
      continue;
    }
    const status = statusName(tx);
    onPoll(tx);
    if (["FINALIZED", "CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"].includes(String(status))) return tx;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`FINALIZATION_TIMEOUT_SAME_HASH:${hash}`);
}
