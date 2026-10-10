import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const report = JSON.parse(
  readFileSync("docs/provenance/simulations/v23-case-a-simulation.json", "utf8"),
);
const source = readFileSync("contracts/rightsrail.py", "utf8");

function capture(method, variant) {
  const item = report.captured_rpc.find(
    (entry) =>
      entry.method === method &&
      entry.request.params[0].transaction_hash_variant === variant,
  );
  assert.ok(item, `missing captured ${method} ${variant}`);
  return item;
}

function failedExecution(item) {
  const error = item.response.error;
  const receipt = error.data.receipt;
  assert.equal(error.code, -32000);
  assert.equal(error.message, "execution failed");
  assert.equal(receipt.execution_result, "ERROR");
  const decoded = Buffer.from(receipt.result, "base64");
  // GenVM prefixes this returned byte string with its one-byte result tag.
  return decoded.subarray(1).toString("utf8");
}

function requestShape(item) {
  const request = item.request.params[0];
  return {
    type: request.type,
    to: request.to,
    from: request.from,
    data_sha256: request.data_sha256,
    data_bytes: request.data_bytes,
    value: request.value,
  };
}

test("V2.3 Case A simulation reaches the contract validity guard", () => {
  const estimate = capture("sim_estimateTransactionFees", "latest-nonfinal");
  const simulation = capture("sim_call", "latest-nonfinal");

  assert.equal(failedExecution(estimate), "[EXPECTED] policy is outside its validity window");
  assert.equal(failedExecution(simulation), "[EXPECTED] policy is outside its validity window");
  assert.deepEqual(requestShape(estimate), requestShape(simulation));
  assert.equal(estimate.request.params[0].value, "0xa");
  assert.equal(estimate.request.params[0].data_bytes, 333);
  assert.equal(
    estimate.request.params[0].data_sha256,
    "088a5ea348f44b06cdf04f55e3dd6ad34c656b5c6883b4e94b3f3be6c7bb17f8",
  );
  assert.ok(estimate.request.params[0].fees, "fee estimation includes fees");
  assert.equal(simulation.request.params[0].fees, undefined);
});

test("finalized-state simulation does not cure the same execution failure", () => {
  const nonfinal = capture("sim_call", "latest-nonfinal");
  const finalized = capture("sim_call", "latest-finalized");

  assert.equal(failedExecution(nonfinal), "[EXPECTED] policy is outside its validity window");
  assert.equal(failedExecution(finalized), "[EXPECTED] policy is outside its validity window");
  assert.deepEqual(requestShape(nonfinal), requestShape(finalized));
  assert.notEqual(
    nonfinal.request.params[0].transaction_hash_variant,
    finalized.request.params[0].transaction_hash_variant,
  );
});

test("the deployed source fails closed on the simulator datetime boundary", () => {
  assert.match(source, /gl\.message\.raw\["datetime"\]/);
  assert.match(source, /if now < policy\["valid_from"\] or/);
  assert.match(source, /policy is outside its validity window/);
  assert.match(source, /escrowed = _require_u256\(int\(gl\.message\.value\)/);
});
