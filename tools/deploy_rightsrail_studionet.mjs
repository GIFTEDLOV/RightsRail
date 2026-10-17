import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readClient, rpc, NETWORK, verifyStudionetFeePolicy, loadConfiguredAccount, pollFinal, safeJson, statusName, executionName } from "./genlayer_studionet.mjs";
import { MANIFEST, DEPLOYER, DEPLOYMENT_JOURNAL, hash, canonical, verifyCandidate } from "./studionet_candidate.mjs";

let journal;
const persist = () => writeFileSync(DEPLOYMENT_JOURNAL, JSON.stringify(safeJson(journal), null, 2) + "\n");
const parse = (value) => typeof value === "string" ? JSON.parse(value) : value;
const addressOf = (tx) => tx?.data?.contract_address ?? tx?.data?.contractAddress ?? tx?.contractAddress ?? tx?.contract_address ?? tx?.txDataDecoded?.contractAddress;
async function main() {
  const candidate = verifyCandidate();
  const feePolicy = await verifyStudionetFeePolicy();
  const client = readClient();
  journal = existsSync(DEPLOYMENT_JOURNAL) ? JSON.parse(readFileSync(DEPLOYMENT_JOURNAL)) : {
    schema: "RIGHTSRAIL_STUDIONET_DEPLOYMENT_V1", network: { alias: NETWORK.alias, rpc: NETWORK.rpc, chain_id: NETWORK.chainId, consensus_main: NETWORK.consensusMain, consensus_data: NETWORK.consensusData },
    candidate: { source: MANIFEST.source, source_sha256: candidate.sourceSha256, abi: MANIFEST.abi, abi_sha256: candidate.abiSha256, runner: MANIFEST.runner, schema_shape: MANIFEST.schema_shape },
    fee_policy: feePolicy, broadcast_count: 0, deployment_count: 0, transaction_id: null, contract_address: null, created_at: new Date().toISOString(),
  };
  if (journal.candidate.source_sha256 !== candidate.sourceSha256 || journal.candidate.abi_sha256 !== candidate.abiSha256) throw new Error("JOURNAL_CANDIDATE_MISMATCH");
  const generated = await client.getContractSchemaForCode(candidate.source);
  if (canonical(generated) !== canonical(candidate.abi)) throw new Error("PREFLIGHT_FULL_SCHEMA_MISMATCH");
  const account = await loadConfiguredAccount("firewall-only", DEPLOYER);
  const history = await rpc("sim_getTransactionsForAddress", [account.address]);
  if (!Array.isArray(history)) throw new Error("DEPLOYER_HISTORY_UNAVAILABLE");
  const exact = history.filter((tx) => Number(tx.type) === 1 && typeof tx.data?.contract_code === "string" && hash(tx.data.contract_code) === candidate.sourceSha256);
  if (exact.length > 1) throw new Error("MULTIPLE_EXACT_DEPLOYMENTS_REQUIRE_RECONCILIATION");
  if (!journal.transaction_id && exact.length === 1) {
    journal.transaction_id = exact[0].hash;
    journal.contract_address = addressOf(exact[0]);
    journal.recovered_from_chain_history = true;
    persist();
  }
  if (!journal.transaction_id) {
    if (journal.broadcast_count > 0) throw new Error("UNCERTAIN_PRIOR_BROADCAST_RECONCILE_SAME_NONCE");
    const latest = Number(BigInt(await rpc("eth_getTransactionCount", [account.address, "latest"])));
    const pending = Number(BigInt(await rpc("eth_getTransactionCount", [account.address, "pending"])));
    if (latest !== pending) throw new Error("DEPLOYER_PENDING_NONCE_NOT_RECONCILED");
    journal.signer = { account_name: "firewall-only", address: account.address };
    journal.nonce = latest;
    journal.balance_before_wei = BigInt(await rpc("eth_getBalance", [account.address, "latest"])).toString();
    journal.phase = "BROADCASTING_ONCE";
    journal.broadcast_count = 1;
    persist();
    journal.transaction_id = await readClient(account).deployContract({ account, code: candidate.source, args: [], kwargs: {} });
    journal.phase = "HASH_PERSISTED_POLLING_SAME_TRANSACTION";
    persist();
    console.log(`Deployment transaction persisted: ${journal.transaction_id}`);
  } else console.log(`Resuming deployment transaction: ${journal.transaction_id}`);
  const final = await pollFinal(client, journal.transaction_id, { intervalMs: 12000, onPoll(tx) {
    journal.receipt = safeJson(tx); journal.status = statusName(tx); journal.execution_status = executionName(tx); journal.last_polled_at = new Date().toISOString();
    journal.contract_address = addressOf(tx) ?? journal.contract_address; persist();
  }});
  if (statusName(final) !== "FINALIZED" || executionName(final) !== "FINISHED_WITH_RETURN") throw new Error(`DEPLOYMENT_EXECUTION_FAILED:${statusName(final)}:${executionName(final)}`);
  const address = addressOf(final) ?? journal.contract_address;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("DEPLOYED_ADDRESS_MISSING");
  journal.contract_address = address; persist();
  const deployedCode = await client.getContractCode(address);
  const deployedSchema = await client.getContractSchema(address);
  if (hash(deployedCode) !== candidate.sourceSha256 || canonical(deployedSchema) !== canonical(candidate.abi)) throw new Error("DEPLOYED_SOURCE_OR_FULL_SCHEMA_MISMATCH");
  if (!journal.verification?.initial_state_verified) {
    const read = async (functionName, args = []) => parse(await client.readContract({ address, functionName, args }));
    const info = await read("contract_info");
    if (info.version !== "2.4.1" || info.withdrawal_supported !== true || info.owner_override !== false) throw new Error("INITIAL_CONTRACT_INFO_MISMATCH");
    const status = await read("get_status");
    const accounting = await read("get_accounting_status");
    for (const item of [...Object.values(status), ...Object.values(accounting)]) if (BigInt(item) !== 0n) throw new Error("INITIAL_STATE_NOT_EMPTY");
    journal.verification = { initial_state_verified: true, initial_status: status, initial_accounting: accounting, contract_info: info, source_parity: true, abi_schema_parity: true, source_sha256: hash(deployedCode), schema_shape: MANIFEST.schema_shape };
  }
  journal.broadcast_count = journal.recovered_from_chain_history ? journal.broadcast_count : 1;
  journal.deployment_count = 1;
  journal.phase = "DEPLOYMENT_VERIFIED";
  delete journal.error;
  persist();
  console.log(JSON.stringify({ phase: journal.phase, address, transaction_id: journal.transaction_id, status: journal.status, execution_status: journal.execution_status, hashes: { source: candidate.sourceSha256, abi: candidate.abiSha256 } }, null, 2));
}
try { await main(); } catch (error) { if (journal) { journal.error = String(error?.stack ?? error); persist(); } console.error(error); process.exitCode = 1; }
