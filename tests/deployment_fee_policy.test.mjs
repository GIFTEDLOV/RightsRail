import test from "node:test";
import assert from "node:assert/strict";
import {
  OBSERVED_ATTEMPT_1_RECEIPT_COST,
  PROVEN_STUDIO_DEV_PROFILE,
  assertPreSignDeploymentRequest,
  buildProvenStudioDevFees,
  legacyUnsafeFeeProfile,
} from "../tools/deployment_fee_policy.mjs";

const failedEstimate = {
  feeValue: "76548000002588",
  distribution: {
    leaderTimeunitsAllocation: "100",
    validatorTimeunitsAllocation: "200",
    appealRounds: "0",
    executionBudgetPerRound: "76548000000000",
    executionConsumed: "0",
    totalMessageFees: "0",
    rotations: ["0"],
    maxPriceGenPerTimeUnit: "2",
    storageFeeMaxGasPrice: "300000000",
    receiptFeeMaxGasPrice: "300000000",
  },
};

test("old RightsRail fee construction reproduces the observed budget failure", () => {
  const oldFees = legacyUnsafeFeeProfile(failedEstimate);
  assert.equal(oldFees.distribution.executionBudgetPerRound, "76548000000000");
  assert.ok(BigInt(oldFees.distribution.executionBudgetPerRound) <= OBSERVED_ATTEMPT_1_RECEIPT_COST);
});

test("corrected builder exceeds the observed receipt and rebuilds fee with the profile", () => {
  const fees = buildProvenStudioDevFees(failedEstimate);
  assert.equal(fees.distribution.executionBudgetPerRound, "25000000000000000");
  assert.equal(fees.feeValue, "100000000000010352");
  assert.ok(BigInt(fees.distribution.executionBudgetPerRound) > OBSERVED_ATTEMPT_1_RECEIPT_COST);
});

test("fresh SDK estimate and fee profile are treated as one atomic pair", () => {
  const estimate = {
    feeValue: PROVEN_STUDIO_DEV_PROFILE.feeValue.toString(),
    distribution: PROVEN_STUDIO_DEV_PROFILE.distribution,
  };
  const fees = buildProvenStudioDevFees(estimate);
  assert.equal(fees.feeValue, "100000000000010352");
  assert.equal(fees.distribution.executionBudgetPerRound, "25000000000000000");
});

test("an unproven larger estimate fails closed instead of retaining a stale fee", () => {
  const larger = structuredClone(failedEstimate);
  larger.distribution.executionBudgetPerRound = "25000000000000001";
  assert.throws(() => buildProvenStudioDevFees(larger), /FEE_ESTIMATE_EXCEEDS_PROVEN_PROFILE/);
});

test("pre-sign guard rejects a budget that does not cover the observed receipt", () => {
  const fees = buildProvenStudioDevFees(failedEstimate);
  const request = {
    chainId: 61997,
    rpc: "https://studio-dev.genlayer.com/api",
    sender: "0x33653e6e86807e41682d3346cdf648d6653384b1",
    runner: "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng",
    userValue: "0",
    nonce: 14,
    latestNonce: 14,
    pendingNonce: 14,
    sourceSha256: "C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B",
    abiSha256: "E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB",
    constructorArgs: [],
    constructorKwargs: {},
    observedReceiptCost: OBSERVED_ATTEMPT_1_RECEIPT_COST.toString(),
    fees,
  };
  assert.equal(assertPreSignDeploymentRequest(request), true);
  request.fees.distribution.executionBudgetPerRound = "76548000000000";
  assert.throws(() => assertPreSignDeploymentRequest(request), /EXECUTION_BUDGET_NOT_ABOVE_OBSERVED_RECEIPT/);
});
