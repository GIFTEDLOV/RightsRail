import { describe, expect, it } from "vitest";
import { ControlledFixtureProvider, provenance } from "@rightsrail/indexer";
import { seedState } from "./store.js";

describe("controlled local store", () => {
  it("exposes explicit local provenance and all four qualification outcomes", () => {
    const state = seedState();
    const provider = new ControlledFixtureProvider(() => state);
    expect(provenance(provider).mode).toBe("CONTROLLED_LOCAL");
    expect(provenance(provider).canonical).toBe(false);
    expect(provenance(provider).contractAddress).toBeNull();
    expect(state.adjudications.map((item) => item.result)).toEqual([
      "PERMITTED",
      "DENIED",
      "INCONCLUSIVE",
      "NOT_APPLICABLE",
    ]);
  });

  it("keeps entitlement accounting distinct from external delivery", () => {
    const state = seedState();
    expect(state.accounting.total_escrow_received).toBe(40);
    expect(state.accounting.total_payout_allocated).toBe(10);
    expect(state.accounting.total_refund_allocated).toBe(30);
    expect(state.settlements.every((item) => item.delivery_status === "ENTITLEMENT_ALLOCATED")).toBe(true);
  });
});
