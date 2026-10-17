import test from "node:test";
import assert from "node:assert/strict";
import { executionName, assertStudionetConfig } from "../tools/genlayer_studionet.mjs";
import { verifyCandidate } from "../tools/studionet_candidate.mjs";

test("stable execution uses the proposing leader, not a canceled validator", () => {
  const tx = { statusName: "FINALIZED", consensus_data: { leader_receipt: [
    { vote: null, execution_result: "SUCCESS", result: { status: "return" }, genvm_result: { raw_error: null } },
    { vote: "agree", execution_result: "ERROR", result: { status: "contract_error", payload: "idle" }, genvm_result: { raw_error: { causes: ["VALIDATOR_QUORUM_REACHED"] } } },
  ] } };
  assert.equal(executionName(tx), "FINISHED_WITH_RETURN");
  assert.equal(executionName({ ...tx, result_name: "MAJORITY_DISAGREE" }), "FINISHED_WITH_CONSENSUS_FAILURE");
  tx.consensus_data.leader_receipt[0] = { vote: null, execution_result: "ERROR", result: { status: "contract_error", payload: "[EXPECTED] only the frozen entitlement recipient may withdraw" } };
  assert.equal(executionName(tx), "FINISHED_WITH_ERROR");
  assert.equal(executionName({ statusName: "FINALIZED" }), null);
});

test("current compatibility candidate and built-in Studionet identity are pinned", () => {
  assert.equal(assertStudionetConfig(), true);
  const candidate = verifyCandidate();
  assert.match(candidate.source, /CONTRACT_VERSION = "2\.4\.1"/);
  assert.equal(Object.keys(candidate.abi.methods).length, 36);
  assert.equal(candidate.abi.methods.get_audit_events.readonly, true);
});
