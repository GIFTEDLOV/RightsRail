/**
 * RightsRail Studio-dev deployment fee policy.
 *
 * This module is deliberately write-agnostic. It builds and validates the
 * explicit fee object that a future authorized genlayer-js deployContract
 * call must receive, but it never signs or broadcasts.
 */

export const CHAIN_ID = 61997;
export const RPC_URL = "https://studio-dev.genlayer.com/api";
export const RUNNER =
  "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng";
export const DEPLOYER = "0x33653e6e86807e41682d3346cdf648d6653384b1";
export const CONTRACT_SHA256 =
  "E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE";
export const ABI_SHA256 =
  "010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B";

export const OBSERVED_ATTEMPT_1_RECEIPT_COST = 78628000000000n;

// This is the exact fee profile returned by the installed genlayer-js RC
// SDK and recorded by successful Studio-dev deployments of Firewall, ClearLC,
// and CharterLock. It is a proven SDK profile, not a percentage uplift.
export const PROVEN_STUDIO_DEV_PROFILE = Object.freeze({
  feeValue: 100000000000010352n,
  distribution: Object.freeze({
    leaderTimeunitsAllocation: "100",
    validatorTimeunitsAllocation: "200",
    appealRounds: "0",
    executionBudgetPerRound: "25000000000000000",
    executionConsumed: "0",
    totalMessageFees: "0",
    rotations: Object.freeze(["3"]),
    maxPriceGenPerTimeUnit: "2",
    storageFeeMaxGasPrice: "300000000",
    receiptFeeMaxGasPrice: "300000000",
  }),
});

function asBigInt(value, label) {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`INVALID_FEE_FIELD:${label}`);
  }
}

function cloneDistribution(distribution) {
  return {
    leaderTimeunitsAllocation: String(distribution.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: String(distribution.validatorTimeunitsAllocation),
    appealRounds: String(distribution.appealRounds),
    executionBudgetPerRound: String(distribution.executionBudgetPerRound),
    executionConsumed: String(distribution.executionConsumed ?? "0"),
    totalMessageFees: String(distribution.totalMessageFees ?? "0"),
    rotations: distribution.rotations.map(String),
    maxPriceGenPerTimeUnit: String(distribution.maxPriceGenPerTimeUnit),
    storageFeeMaxGasPrice: String(distribution.storageFeeMaxGasPrice),
    receiptFeeMaxGasPrice: String(distribution.receiptFeeMaxGasPrice),
  };
}

/**
 * Convert the installed SDK's fresh estimate into the proven deployment
 * profile. The SDK estimate is required as an input; no CLI default is used.
 * If the estimate exceeds the proven profile, fail closed instead of guessing
 * a new fee formula.
 */
export function buildProvenStudioDevFees(
  estimate,
  observedReceiptCost = OBSERVED_ATTEMPT_1_RECEIPT_COST,
) {
  if (!estimate || !estimate.distribution) {
    throw new Error("FEE_ESTIMATE_MISSING_DISTRIBUTION");
  }

  const rawBudget = asBigInt(
    estimate.distribution.executionBudgetPerRound,
    "executionBudgetPerRound",
  );
  const rawFee = asBigInt(estimate.feeValue, "feeValue");
  const provenBudget = asBigInt(
    PROVEN_STUDIO_DEV_PROFILE.distribution.executionBudgetPerRound,
    "proven.executionBudgetPerRound",
  );
  const provenFee = PROVEN_STUDIO_DEV_PROFILE.feeValue;
  const receiptCost = asBigInt(observedReceiptCost, "observedReceiptCost");

  if (rawBudget <= 0n || rawFee <= 0n) {
    throw new Error("FEE_ESTIMATE_NOT_POSITIVE");
  }
  if (rawBudget > provenBudget || rawFee > provenFee) {
    throw new Error("FEE_ESTIMATE_EXCEEDS_PROVEN_PROFILE");
  }
  if (provenBudget <= receiptCost) {
    throw new Error("PROVEN_PROFILE_DOES_NOT_EXCEED_OBSERVED_RECEIPT");
  }

  // Fee and distribution are selected as one profile. This prevents changing
  // the budget while retaining a stale feeValue from the failed attempt.
  return {
    feeValue: provenFee.toString(),
    distribution: cloneDistribution(PROVEN_STUDIO_DEV_PROFILE.distribution),
    source: "genlayer-js:estimateTransactionFees -> proven Studio-dev profile",
    rawEstimate: {
      feeValue: rawFee.toString(),
      executionBudgetPerRound: rawBudget.toString(),
    },
    observedReceiptCost: receiptCost.toString(),
  };
}

/** The unsafe legacy behavior from RightsRail attempt #1, retained for the regression test. */
export function legacyUnsafeFeeProfile(estimate) {
  return {
    feeValue: String(estimate.feeValue),
    distribution: cloneDistribution(estimate.distribution),
  };
}

export function assertPreSignDeploymentRequest(request) {
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
  if (!request.fees || !request.fees.distribution) throw new Error("FEE_DISTRIBUTION_MISSING");
  if (BigInt(request.fees.feeValue) <= 0n) throw new Error("FEE_VALUE_NOT_POSITIVE");
  if (BigInt(request.fees.distribution.executionBudgetPerRound) <= BigInt(request.observedReceiptCost)) {
    throw new Error("EXECUTION_BUDGET_NOT_ABOVE_OBSERVED_RECEIPT");
  }
  if (request.constructorArgs?.length !== 0) throw new Error("CONSTRUCTOR_ARGS_CHANGED");
  if (Object.keys(request.constructorKwargs ?? {}).length !== 0) throw new Error("CONSTRUCTOR_KWARGS_CHANGED");
  return true;
}
