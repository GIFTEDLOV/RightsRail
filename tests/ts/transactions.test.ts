import { describe, expect, it } from "vitest";
import { executionResult } from "../../apps/web/src/transactions";

describe("hosted transaction receipt classification", () => {
  const accepted = {
    statusName: "FINALIZED",
    result_name: "MAJORITY_AGREE",
    consensus_data: {
      leader_receipt: [
        {
          vote: null,
          execution_result: "SUCCESS",
          result: { status: "return" },
          genvm_result: { raw_error: null },
        },
        {
          vote: "idle",
          execution_result: "ERROR",
          result: { status: "contract_error" },
          genvm_result: { raw_error: { causes: ["VALIDATOR_QUORUM_REACHED"] } },
        },
      ],
    },
  };

  it("uses the proposing leader for a committed transaction", () => {
    expect(executionResult(accepted)).toBe("FINISHED_WITH_RETURN");
  });

  it("does not present terminal validator disagreement as success", () => {
    expect(executionResult({ ...accepted, result_name: "MAJORITY_DISAGREE" })).toBe(
      "FINISHED_WITH_CONSENSUS_FAILURE",
    );
  });

  it("recognizes stable rollback receipts as execution errors", () => {
    const rollback = structuredClone(accepted);
    rollback.consensus_data.leader_receipt[0] = {
      vote: null,
      execution_result: "ERROR",
      result: { status: "rollback" },
      genvm_result: { raw_error: null },
    };
    expect(executionResult(rollback)).toBe("FINISHED_WITH_ERROR");
  });
});
