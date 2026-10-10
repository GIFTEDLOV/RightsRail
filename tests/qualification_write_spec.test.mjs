import test from "node:test";
import assert from "node:assert/strict";
import {
  assertQualificationUserValue,
  buildQualificationWriteSpec,
  stripFees,
} from "../tools/qualification_write_spec.mjs";

const base = {
  account: { address: "0x33653E6e86807e41682D3346CDf648D6653384B1" },
  address: "0x984b996079d2591976FcfFb62d0506DF02E0396A",
  functionName: "submit_usage_request",
  args: ["request-live-case-a"],
  kwargs: {},
};

test("payable request requires an explicit exact frozen fee", () => {
  assert.throws(() => buildQualificationWriteSpec({ ...base }), /USER_VALUE_REQUIRED/);
  assert.throws(() => buildQualificationWriteSpec({ ...base, value: 0n }), /USER_VALUE_MISMATCH/);
  assert.throws(() => buildQualificationWriteSpec({ ...base, value: 9n }), /USER_VALUE_MISMATCH/);
  assert.throws(() => buildQualificationWriteSpec({ ...base, value: 11n }), /USER_VALUE_MISMATCH/);
  assert.equal(assertQualificationUserValue("submit_usage_request", 10n), 10n);
});

test("non-payable qualification writes carry zero user value", () => {
  const spec = buildQualificationWriteSpec({
    ...base,
    functionName: "commit_evidence",
    value: 0n,
  });
  assert.equal(spec.value, 0n);
  assert.throws(
    () => buildQualificationWriteSpec({ ...base, functionName: "commit_evidence", value: 10n }),
    /USER_VALUE_MISMATCH/,
  );
});

test("estimation and submission reuse identical concrete call inputs", async () => {
  const spec = buildQualificationWriteSpec({ ...base, value: 10n });
  const estimatedInput = stripFees(spec);
  const submittedInput = { ...spec, fees: { feeValue: "100", distribution: {} } };
  assert.deepEqual(stripFees(submittedInput), estimatedInput);
  assert.equal(estimatedInput.value, 10n);
  assert.deepEqual(estimatedInput.kwargs, {});
});
