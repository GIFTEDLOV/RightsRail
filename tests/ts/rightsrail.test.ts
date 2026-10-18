import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ABI_METHODS, ABI_SHA256, CONTRACT_SHA256, FrozenContractClient, SEMANTIC_KEYS, STUDIONET_CHAIN_ID, STUDIONET_RPC, assertSemanticVector, contractConfig } from "@rightsrail/genlayer-client";
import { ControlledFixtureProvider, GenLayerCanonicalProvider, findById, provenance } from "@rightsrail/indexer";
import { seedState } from "../../apps/api/src/store.js";

describe("RightsRail frozen client boundary", () => {
  it("keeps the V2.4 candidate metadata and 36-method ABI explicit", () => {
    expect(CONTRACT_SHA256).toBe("DA0828DD579AB0CAA6432AF713559D4E3B5E679444F71E7345C4FF8E0F21EC47");
    expect(ABI_SHA256).toBe("AB93A76683921294FAC694751CF877E0F195A69DC7659FB5F02D6D34BC099B61");
    expect(ABI_METHODS.reads).toHaveLength(24);
    expect(ABI_METHODS.writes).toHaveLength(12);
    expect(ABI_METHODS.reads).toContain("get_audit_events");
    expect(contractConfig("CONTROLLED_LOCAL").contractAddress).toBeNull();
    expect(contractConfig("GENLAYER_CANONICAL", "0x984b996079d2591976FcfFb62d0506DF02E0396A")).toMatchObject({ chainId: STUDIONET_CHAIN_ID, rpcUrl: STUDIONET_RPC, contractAddress: "0x984b996079d2591976FcfFb62d0506DF02E0396A" });
  });

  it("matches the checked client method inventory to the generated V2.4 ABI", () => {
    const abi = JSON.parse(readFileSync(new URL("../../artifacts/rightsrail-studionet.abi.json", import.meta.url), "utf8")) as { methods: Record<string, { readonly: boolean }> };
    const reads = Object.entries(abi.methods).filter(([, value]) => value.readonly).map(([name]) => name).sort();
    const writes = Object.entries(abi.methods).filter(([, value]) => !value.readonly).map(([name]) => name).sort();
    expect([...ABI_METHODS.reads].sort()).toEqual(reads);
    expect([...ABI_METHODS.writes].sort()).toEqual(writes);
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

  it("retains the configured canonical address in provenance", () => {
    const provider = new GenLayerCanonicalProvider("0x984b996079d2591976FcfFb62d0506DF02E0396A");
    expect(provenance(provider)).toMatchObject({
      mode: "GENLAYER_CANONICAL",
      canonical: true,
      contractAddress: "0x984b996079d2591976FcfFb62d0506DF02E0396A",
    });
  });

  it("reads and briefly caches only the canonical status view for the status endpoint", async () => {
    const readContract = vi.fn().mockResolvedValue({ policy_count: 1n, request_count: 4n });
    const provider = new GenLayerCanonicalProvider(
      "0x984b996079d2591976FcfFb62d0506DF02E0396A",
      { readContract } as never,
    );
    await expect(provider.applicationStatus()).resolves.toEqual({ policy_count: 1, request_count: 4 });
    await provider.applicationStatus();
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "get_status" }));
    provider.invalidate();
    await provider.applicationStatus();
    expect(readContract).toHaveBeenCalledTimes(2);
  });

  it("finds typed records by their canonical identifier", () => {
    const state = seedState();
    expect(findById(state.permits, "permit_id", "permit-case-a").request_id).toBe("request-case-a");
    expect(() => findById(state.permits, "permit_id", "missing")).toThrow("Record not found");
  });
});
