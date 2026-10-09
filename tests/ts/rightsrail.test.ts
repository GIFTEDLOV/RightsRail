import { describe, expect, it } from "vitest";
import { ABI_METHODS, ABI_SHA256, CONTRACT_SHA256, FrozenContractClient, SEMANTIC_KEYS, assertSemanticVector, contractConfig } from "@rightsrail/genlayer-client";
import { ControlledFixtureProvider, GenLayerCanonicalProvider, findById, provenance } from "@rightsrail/indexer";
import { seedState } from "../../apps/api/src/store.js";

describe("RightsRail frozen client boundary", () => {
  it("keeps the contract candidate metadata and 30-method ABI explicit", () => {
    expect(CONTRACT_SHA256).toBe("C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B");
    expect(ABI_SHA256).toBe("E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB");
    expect(ABI_METHODS.reads).toHaveLength(21);
    expect(ABI_METHODS.writes).toHaveLength(9);
    expect(contractConfig("CONTROLLED_LOCAL").contractAddress).toBeNull();
  });

  it("prepares a local journal entry without enabling broadcast", () => {
    const entry = new FrozenContractClient(contractConfig()).prepare("submit_usage_request", ["policy-1"], 10);
    expect(entry.state).toBe("PRECONDITION_READ");
    expect(entry.canonical).toBe(false);
  });

  it("rejects non-exact semantic vectors", () => {
    const valid = Object.fromEntries(SEMANTIC_KEYS.map((key) => [key, true]));
    expect(() => assertSemanticVector({ ...valid, extra: false })).toThrow();
    expect(() => assertSemanticVector({ ...valid, asset_match: "true" })).toThrow();
    expect(() => assertSemanticVector({ ...valid, evidence_sufficient: 1 })).toThrow();
    expect(() => assertSemanticVector(valid)).not.toThrow();
  });
});

describe("provider and fixture provenance", () => {
  it("returns controlled local state with all four deterministic outcomes", async () => {
    const state = seedState();
    const provider = new ControlledFixtureProvider(() => state);
    const snapshot = await provider.snapshot();
    expect(provenance(provider)).toMatchObject({ mode: "CONTROLLED_LOCAL", canonical: false, contractAddress: null });
    expect(snapshot.adjudications.map((item) => item.result)).toEqual(["PERMITTED", "DENIED", "INCONCLUSIVE", "NOT_APPLICABLE"]);
    expect(snapshot.permits).toHaveLength(1);
    expect(snapshot.accounting.total_escrow_received).toBe(40);
    expect(snapshot.accounting.total_payout_allocated + snapshot.accounting.total_refund_allocated).toBe(40);
  });

  it("does not silently fall back from canonical mode", async () => {
    await expect(new GenLayerCanonicalProvider(null).snapshot()).rejects.toThrow("not deployed");
  });

  it("finds typed records by their canonical identifier", () => {
    const state = seedState();
    expect(findById(state.permits, "permit_id", "permit-case-a").request_id).toBe("request-case-a");
    expect(() => findById(state.permits, "permit_id", "missing")).toThrow("Record not found");
  });
});
