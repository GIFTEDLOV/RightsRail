/** Read-only Studionet preflight; never signs or broadcasts. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ABI_SHA256, CHAIN_ID, CONTRACT_SHA256, DEPLOYER, NETWORK_ALIAS, RPC_URL, RUNNER } from "./deployment_fee_policy_v24.mjs";
import { assertAbiShape, assertCandidateBytes, inspectSchemaShape } from "./rightsrail_v24_gate.mjs";
import { assertStudionetConfig, loadConfiguredAccount, NETWORK, readClient, requireGaslessFeeEstimate, rpc } from "./genlayer_studionet.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "contracts", "rightsrail_v24.py");
const abiPath = join(root, "artifacts", "rightsrail-v24.abi.json");
const outputPath = join(root, "docs", "provenance", "rightsrail-v24-studionet-preflight.json");
const journalPath = join(root, "docs", "provenance", "live-transactions", "rightsrail-v24-studionet-deployment.json");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();

async function main() {
  assertStudionetConfig();
  if (NETWORK_ALIAS !== "studionet" || CHAIN_ID !== 61999 || RPC_URL !== NETWORK.rpc) throw new Error("BUILTIN_STUDIONET_PIN_MISMATCH");
  const source = readFileSync(sourcePath);
  const abi = readFileSync(abiPath);
  const hashes = assertCandidateBytes({ sourceBytes: source, abiBytes: abi });
  const localShape = assertAbiShape(abi);
  const signer = await loadConfiguredAccount("firewall-only", DEPLOYER);
  const client = readClient(signer);
  const [rpcChainId, gasPrice, latest, pending, balance, history] = await Promise.all([
    rpc("eth_chainId", []), rpc("eth_gasPrice", []), rpc("eth_getTransactionCount", [DEPLOYER, "latest"]),
    rpc("eth_getTransactionCount", [DEPLOYER, "pending"]), rpc("eth_getBalance", [DEPLOYER, "latest"]),
    rpc("sim_getTransactionsForAddress", [DEPLOYER]),
  ]);
  const chainId = Number(BigInt(rpcChainId));
  const latestNonce = Number(BigInt(latest));
  const pendingNonce = Number(BigInt(pending));
  if (chainId !== CHAIN_ID) throw new Error(`RPC_CHAIN_ID_MISMATCH:${chainId}`);
  if (latestNonce !== pendingNonce) throw new Error(`SIGNER_NONCE_MISMATCH:${latestNonce}:${pendingNonce}`);
  let generatedSchema = null;
  let schemaError = null;
  try { generatedSchema = await client.getContractSchemaForCode(source.toString("utf8")); }
  catch (error) {
    const message = String(error?.message ?? error);
    schemaError = message.includes("invalid_contract")
      ? "gen_getContractSchemaForCode returned VM_ERROR invalid_contract"
      : message.split("\n")[0].slice(0, 300);
  }
  const generatedShape = generatedSchema ? inspectSchemaShape(generatedSchema) : null;
  const abiNames = Object.keys(JSON.parse(abi.toString("utf8")).methods).sort();
  const sourceNames = generatedSchema ? Object.keys(generatedSchema.methods ?? {}).sort() : [];
  const remoteSchemaParity = Boolean(generatedSchema) && JSON.stringify(generatedShape) === JSON.stringify(localShape) && JSON.stringify(abiNames) === JSON.stringify(sourceNames);
  let feeEstimate = null;
  let feeEstimateError = null;
  try { feeEstimate = await requireGaslessFeeEstimate(client); }
  catch (error) { feeEstimateError = String(error?.message ?? error); }
  const deployments = (Array.isArray(history) ? history : []).filter((tx) => Number(tx?.type) === 1).map((tx) => ({
    hash: tx.hash, status: tx.status, address: tx.data?.contract_address ?? null,
    source_sha256: typeof tx.data?.contract_code === "string" ? digest(Buffer.from(tx.data.contract_code, "utf8")) : null,
  }));
  const priorExact = deployments.filter((item) => item.source_sha256 === CONTRACT_SHA256);
  if (priorExact.length > 1) throw new Error("MULTIPLE_EXACT_CANDIDATE_DEPLOYMENTS_IN_SIGNER_HISTORY");
  const existingJournal = (() => { try { return JSON.parse(readFileSync(journalPath, "utf8")); } catch { return null; } })();
  const result = {
    schema: "RIGHTSRAIL_V24_STUDIONET_PREFLIGHT_V1",
    observed_at_utc: new Date().toISOString(),
    status: "BLOCKED_BEFORE_BROADCAST",
    network: { ...NETWORK, built_in_configuration: true, custom_rpc_override_used: false, rpc_chain_id: chainId, alias_confirmed_by_cli: true },
    signer: { account_name: "firewall-only", address: signer.address, balance_wei: BigInt(balance).toString(), balance_gen: (Number(BigInt(balance)) / 1e18).toString(), latest_nonce: latestNonce, pending_nonce: pendingNonce },
    fee_behavior: { eth_gas_price_wei_observed_but_not_used_as_protocol_fee_quote: BigInt(gasPrice).toString(), fee_estimate_required: true, estimator: "GenLayerJS estimateTransactionFees", status: feeEstimate?.gasless === true ? "GASLESS_CONFIRMED" : "NO_SUPPORTED_FEE_QUOTE", quote: feeEstimate, error: feeEstimateError, cli_estimate_observed: { command: "genlayer estimate-fees --json", rpc_method: "sim_getFeeConfig", error_code: -32601, error: "Method not found: sim_getFeeConfig", quote: null } },
    candidate: { source: "contracts/rightsrail_v24.py", source_bytes: source.length, source_sha256: hashes.sourceHash, abi: "artifacts/rightsrail-v24.abi.json", abi_bytes: abi.length, abi_sha256: hashes.abiHash, runner: RUNNER, schema_shape: { methods: localShape.total, reads: localShape.reads, writes: localShape.writes }, local_genvm_rc5_schema_match: true, remote_schema_exact_match: remoteSchemaParity, remote_schema_error: schemaError, get_audit_events_read_only_in_local_abi: JSON.parse(abi.toString("utf8")).methods?.get_audit_events?.readonly === true },
    existing_state: { repository_studionet_journal_found: Boolean(existingJournal?.transaction_id ?? existingJournal?.tx_hash), exact_candidate_in_configured_signer_history: priorExact.length === 1, exact_candidate_transaction_id: priorExact[0]?.hash ?? null, exact_candidate_address: priorExact[0]?.address ?? null, configured_signer_deployment_history_count: deployments.length, deployments },
    deployment_allowed: priorExact.length === 0 && !existingJournal?.transaction_id && !existingJournal?.tx_hash && remoteSchemaParity && feeEstimate?.gasless === true,
    blockers: [
      ...(remoteSchemaParity ? [] : [{ gate: "STUDIONET_SOURCE_SCHEMA_COMPATIBILITY", result: schemaError?.slice(0, 500) ?? "Remote schema did not match generated ABI." }]),
      ...(feeEstimate?.gasless === true ? [] : [{ gate: "STUDIONET_FEE_ESTIMATE", result: feeEstimateError ?? "SDK did not confirm gasless execution." }]),
    ],
  };
  result.status = result.deployment_allowed ? "READ_ONLY_PREFLIGHT_PASS" : "BLOCKED_BEFORE_BROADCAST";
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.deployment_allowed) throw new Error("STUDIONET_PREFLIGHT_BLOCKED_BEFORE_BROADCAST");
}

main().catch((error) => { process.stderr.write(`${error?.stack ?? error}\n`); process.exitCode = 1; });
