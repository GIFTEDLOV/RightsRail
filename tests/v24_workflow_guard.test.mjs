import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  V24_ABI_SHA256,
  V24_METHOD_COUNTS,
  V24_SOURCE_SHA256,
  appendPreBroadcast,
  assertAbiShape,
  assertCaseAStudionetPreflight,
  assertCandidateBytes,
  assertPolicyCheckpoint,
  assertStrictPngManifest,
  createV24Journal,
  submitExactlyOnce,
} from "../tools/rightsrail_v24_gate.mjs";
import { assertPreSignDeploymentRequest } from "../tools/deployment_fee_policy_v24.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));

test("V2.4 authority is pinned without accepting the current V2.3 bytes", () => {
  assert.equal(V24_SOURCE_SHA256, "5C99DEB31EB29B171B94F343950CBFF5204945D02160B2ADA3D742A1FFC6D321");
  assert.equal(V24_ABI_SHA256, "11548EA63B1C365C7985BE8C748109C4B7F4A33A1A55DE8394EF1CE90E6BE4EA");
  assert.throws(
    () => assertCandidateBytes({ sourceBytes: read("contracts/rightsrail.py"), abiBytes: read("artifacts/rightsrail.abi.json") }),
    /V24_SOURCE_HASH_MISMATCH|V24_ABI_HASH_MISMATCH/,
  );
});

test("V2.4 ABI gate checks only the frozen surface counts", () => {
  const methods = {};
  for (let index = 0; index < V24_METHOD_COUNTS.reads; index += 1) {
    methods[`read_${index}`] = { readonly: true };
  }
  for (let index = 0; index < V24_METHOD_COUNTS.writes; index += 1) {
    methods[`write_${index}`] = { readonly: false };
  }
  assert.deepEqual(assertAbiShape(Buffer.from(JSON.stringify({ methods }))), V24_METHOD_COUNTS);
});

test("strict manifest requires exactly the five pinned PNG cases", () => {
  const manifest = JSON.parse(read("provenance/media/live-png-manifest.json"));
  assert.equal(assertStrictPngManifest(manifest).length, 5);
  const malformed = { ...manifest, entries: manifest.entries.slice(0, 4) };
  assert.throws(() => assertStrictPngManifest(malformed), /V24_MANIFEST_ENTRY_COUNT_MISMATCH/);
});

test("pre-broadcast journal is persisted before a write", () => {
  const journal = createV24Journal("qualification");
  const persisted = [];
  const record = appendPreBroadcast(
    journal,
    { label: "policy:create", method: "create_policy", nonce: 8, args: [], value: 0 },
    (value) => persisted.push(structuredClone(value)),
  );
  assert.equal(record.phase, "PRE_BROADCAST");
  assert.equal(record.tx_hash, null);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].transactions[0].phase, "PRE_BROADCAST");
});

test("uncertain write stops without an automatic retry", async () => {
  const journal = createV24Journal("qualification");
  let calls = 0;
  await assert.rejects(
    submitExactlyOnce(
      journal,
      { label: "case-A:submit_usage_request", method: "submit_usage_request", nonce: 10, args: [], value: 10 },
      async () => {
        calls += 1;
        throw new Error("timeout after broadcast");
      },
      () => undefined,
    ),
    /V24_UNCERTAIN_BROADCAST/,
  );
  assert.equal(calls, 1);
  assert.equal(journal.broadcast_count, 0);
  assert.equal(journal.phase, "STOPPED_UNCERTAIN_BROADCAST");
});

test("qualification continuation requires successful policy checkpoint and read-only Case A preflight", () => {
  const journal = createV24Journal("qualification");
  journal.transactions.push(
    { label: "policy:create", phase: "COMPLETE", status: "FINALIZED", execution_status: "FINISHED_WITH_RETURN" },
    { label: "policy:freeze", phase: "COMPLETE", status: "FINALIZED", execution_status: "FINISHED_WITH_RETURN" },
  );
  assert.equal(assertPolicyCheckpoint(journal), true);
  assert.equal(
    assertCaseAStudionetPreflight({
      broadcasted: false,
      write_submitted: false,
      simulation_status: "PASS",
      fee_model_status: "GASLESS_VERIFIED",
      fee_estimate: { gasless: true, feeValue: "0", source: "supported SDK estimate" },
      network_alias: "studionet",
      user_value_wei: "10",
    }),
    true,
  );
});

test("missing or nonzero fee estimates block a Studionet pre-sign request", () => {
  const request = {
    networkAlias: "studionet",
    chainId: 61999,
    rpc: "https://studio.genlayer.com/api",
    sender: "0x33653e6e86807e41682d3346cdf648d6653384b1",
    runner: "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng",
    userValue: "0",
    nonce: 8,
    latestNonce: 8,
    pendingNonce: 8,
    sourceSha256: V24_SOURCE_SHA256,
    abiSha256: V24_ABI_SHA256,
    constructorArgs: [],
    constructorKwargs: {},
  };
  assert.throws(() => assertPreSignDeploymentRequest(request), /FEE_ESTIMATE_NOT_CONFIRMED_GASLESS/);
  request.feeEstimate = { gasless: true, feeValue: "1" };
  assert.throws(() => assertPreSignDeploymentRequest(request), /GASLESS_FEE_ESTIMATE_HAS_NONZERO_VALUE/);
  request.feeEstimate.feeValue = "0";
  assert.equal(assertPreSignDeploymentRequest(request), true);
});
