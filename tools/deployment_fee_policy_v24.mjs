/** V2.4 Studionet network and candidate pins. */
export const NETWORK_ALIAS = "studionet";
export const CHAIN_ID = 61999;
export const RPC_URL = "https://studio.genlayer.com/api";
export const RUNNER = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";
export const DEPLOYER = "0x33653e6e86807e41682d3346cdf648d6653384b1";
export const CONTRACT_SHA256 = "5C99DEB31EB29B171B94F343950CBFF5204945D02160B2ADA3D742A1FFC6D321";
export const ABI_SHA256 = "11548EA63B1C365C7985BE8C748109C4B7F4A33A1A55DE8394EF1CE90E6BE4EA";
export function assertPreSignDeploymentRequest(request) {
  if (request.networkAlias !== NETWORK_ALIAS) throw new Error("NETWORK_ALIAS_MISMATCH");
  if (request.chainId !== CHAIN_ID) throw new Error("CHAIN_ID_MISMATCH");
  if (request.rpc !== RPC_URL) throw new Error("RPC_MISMATCH");
  if (String(request.sender).toLowerCase() !== DEPLOYER) throw new Error("SENDER_MISMATCH");
  if (request.runner !== RUNNER) throw new Error("RUNNER_MISMATCH");
  if (request.userValue !== "0") throw new Error("USER_VALUE_MUST_BE_ZERO");
  if (!Number.isInteger(request.nonce) || request.nonce < 0) throw new Error("INVALID_NONCE");
  if (request.latestNonce !== request.pendingNonce) throw new Error("NONCE_NOT_RECONCILED");
  if (request.nonce !== request.latestNonce) throw new Error("NONCE_SNAPSHOT_MISMATCH");
  if (request.sourceSha256 !== CONTRACT_SHA256) throw new Error("CONTRACT_HASH_MISMATCH");
  if (request.abiSha256 !== ABI_SHA256) throw new Error("ABI_HASH_MISMATCH");
  if (request.feeEstimate?.gasless !== true) throw new Error("FEE_ESTIMATE_NOT_CONFIRMED_GASLESS");
  if (request.feeEstimate.feeValue !== undefined && BigInt(request.feeEstimate.feeValue) !== 0n) {
    throw new Error("GASLESS_FEE_ESTIMATE_HAS_NONZERO_VALUE");
  }
  if (request.constructorArgs?.length !== 0) throw new Error("CONSTRUCTOR_ARGS_CHANGED");
  if (Object.keys(request.constructorKwargs ?? {}).length !== 0) throw new Error("CONSTRUCTOR_KWARGS_CHANGED");
  return true;
}
