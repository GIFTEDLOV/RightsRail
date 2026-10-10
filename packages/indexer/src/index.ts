import type {
  AccountingSnapshot,
  AdjudicationRecord,
  EvidenceRecord,
  PermitRecord,
  PolicyRecord,
  RequestRecord,
  SettlementRecord,
} from "@rightsrail/genlayer-client";
import { CHAIN_ID, nowIso, type ApiEnvelope, type ProviderMode, type ProvenanceMeta } from "@rightsrail/shared-ts";

export interface ActivityRecord {
  id: string;
  action: string;
  subject_id: string;
  at: string;
  description: string;
  severity: "INFO" | "SUCCESS" | "WARNING";
}

export interface DeliveryRecord {
  settlement_id: string;
  status: "NOT_REQUESTED" | "ENTITLEMENT_ALLOCATED" | "WITHDRAWAL_EMITTED" | "DELIVERY_CONFIRMED" | "DELIVERY_FAILED_OR_UNKNOWN" | "ZERO_VALUE_NO_TRANSFER";
  recipient: string;
  amount: number;
  external_operation: string | null;
}

export interface IndexedState {
  policies: PolicyRecord[];
  requests: RequestRecord[];
  evidence: EvidenceRecord[];
  adjudications: AdjudicationRecord[];
  permits: PermitRecord[];
  settlements: SettlementRecord[];
  accounting: AccountingSnapshot;
  delivery: DeliveryRecord[];
  activity: ActivityRecord[];
}

export interface RightsRailProvider {
  readonly mode: ProviderMode;
  readonly canonical: boolean;
  snapshot(): Promise<IndexedState>;
}

export class ControlledFixtureProvider implements RightsRailProvider {
  readonly mode = "CONTROLLED_LOCAL" as const;
  readonly canonical = false as const;
  constructor(private readonly snapshotFactory: () => IndexedState) {}
  async snapshot(): Promise<IndexedState> {
    return structuredClone(this.snapshotFactory());
  }
}

export class GenLayerCanonicalProvider implements RightsRailProvider {
  readonly mode = "GENLAYER_CANONICAL" as const;
  readonly canonical = true as const;
  constructor(readonly address: string | null) {}
  async snapshot(): Promise<IndexedState> {
    if (!this.address) throw new Error("Canonical provider unavailable: contract is not deployed");
    throw new Error("Canonical provider read adapter is not active until a contract address is configured");
  }
}

export function provenance(provider: RightsRailProvider): ProvenanceMeta {
  return {
    mode: provider.mode,
    canonical: provider.canonical,
    chainId: CHAIN_ID,
    contractAddress: provider instanceof GenLayerCanonicalProvider ? provider.address : null,
    source: provider.canonical ? "genlayer-contract" : "controlled-fixture-store",
    asOf: nowIso(),
  };
}

export function envelope<T>(provider: RightsRailProvider, data: T): ApiEnvelope<T> {
  return { data, provenance: provenance(provider) };
}

export function findById<T extends object>(items: T[], key: string, id: string): T {
  const found = items.find((item) => (item as Record<string, unknown>)[key] === id);
  if (!found) throw new Error(`Record not found: ${id}`);
  return found;
}
