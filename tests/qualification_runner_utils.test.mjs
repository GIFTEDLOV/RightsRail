import test from "node:test";
import assert from "node:assert/strict";
import { canonical, jsonSafe } from "../tools/qualification_runner_utils.mjs";

test("qualification journal hashing is BigInt-safe", () => {
  const value = { required_fee_wei: 10n, nested: { bytes: 35344n } };
  assert.doesNotThrow(() => JSON.stringify(jsonSafe(value)));
  assert.equal(canonical(value), '{"nested":{"bytes":"35344"},"required_fee_wei":"10"}');
});
