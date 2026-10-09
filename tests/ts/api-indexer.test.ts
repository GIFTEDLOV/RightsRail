import { describe, expect, it } from "vitest";
import { ControlledFixtureProvider, envelope } from "@rightsrail/indexer";
import { LocalStore, seedState } from "../../apps/api/src/store.js";

describe("local API and indexer read model", () => {
  it("exposes provenance on a controlled snapshot", async () => {
    const provider = new ControlledFixtureProvider(seedState);
    const response = envelope(provider, await provider.snapshot());
    expect(response.provenance).toMatchObject({
      mode: "CONTROLLED_LOCAL",
      canonical: false,
      chainId: 61997,
      contractAddress: null,
      source: "controlled-fixture-store",
    });
    expect(response.data.delivery.every((item) => item.status === "ENTITLEMENT_ALLOCATED")).toBe(true);
  });

  it("persists local policy preparation and can be reset reproducibly", () => {
    const store = new LocalStore();
    const draft = store.addPolicyDraft({ allowed_purposes: ["controlled local editorial"] });
    expect(store.snapshot().policies[0].policy_id).toBe(draft.policy_id);
    expect(store.snapshot().policies[0].state).toBe("DRAFT");
    const reset = store.reset();
    expect(reset.policies).toHaveLength(1);
    expect(reset.policies[0].policy_id).toBe("policy-lumen-finch-001");
  });
});
