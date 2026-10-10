import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ABI_SHA256,
  CHAIN_ID,
  CONTRACT_SHA256,
  DEPLOYER,
  PROVEN_STUDIO_DEV_PROFILE,
  RPC_URL,
  RUNNER,
  assertPreSignDeploymentRequest,
  buildProvenStudioDevFees,
} from "../tools/deployment_fee_policy_v23.mjs";

const root = resolve(import.meta.dirname, "..");
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

test("V2.3 deployment constants match the integrated source and official ABI", () => {
  assert.equal(digest(resolve(root, "contracts/rightsrail.py")), CONTRACT_SHA256);
  assert.equal(digest(resolve(root, "artifacts/rightsrail.abi.json")), ABI_SHA256);
  assert.equal(CHAIN_ID, 61997);
  assert.equal(RPC_URL, "https://studio-dev.genlayer.com/api");
  assert.equal(DEPLOYER, "0x33653e6e86807e41682d3346cdf648d6653384b1");
  assert.equal(RUNNER, "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng");
});

test("V2.3 deployment budget stays above the historical receipt cost", () => {
  const fees = buildProvenStudioDevFees({
    feeValue: "100000000000010352",
    distribution: PROVEN_STUDIO_DEV_PROFILE.distribution,
  });
  assert.equal(fees.distribution.executionBudgetPerRound, "25000000000000000");
  assert.ok(BigInt(fees.distribution.executionBudgetPerRound) > 78628000000000n);
  assert.equal(fees.feeValue, "100000000000010352");
});

test("V2.3 pre-sign guard rejects stale legacy deployment budget", () => {
  assert.throws(
    () => assertPreSignDeploymentRequest({
      chainId: CHAIN_ID,
      rpc: RPC_URL,
      sender: DEPLOYER,
      nonce: 0,
      latestNonce: 0,
      pendingNonce: 0,
      runner: RUNNER,
      userValue: "0",
      sourceSha256: CONTRACT_SHA256,
      abiSha256: ABI_SHA256,
      observedReceiptCost: "78628000000000",
      constructorArgs: [],
      constructorKwargs: {},
      fees: {
        feeValue: "76548000000000",
        distribution: {
          ...PROVEN_STUDIO_DEV_PROFILE.distribution,
          executionBudgetPerRound: "76548000000000",
        },
      },
    }),
    /EXECUTION_BUDGET_NOT_ABOVE_OBSERVED_RECEIPT/,
  );
});
