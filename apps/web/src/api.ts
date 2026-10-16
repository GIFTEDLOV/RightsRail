import type {
  AccountingSnapshot,
  AdjudicationRecord,
  EvidenceRecord,
  PermitRecord,
  PolicyRecord,
  RequestRecord,
  SettlementRecord,
  SemanticKey,
  SemanticVector,
} from "@rightsrail/genlayer-client";

export interface Provenance {
  mode: "CONTROLLED_LOCAL" | "GENLAYER_CANONICAL";
  canonical: boolean;
  chainId: number;
  contractAddress: string | null;
  source: string;
  asOf: string;
}
export interface Envelope<T> { data: T; provenance: Provenance; }
export interface StatusData {
  mode: "CONTROLLED_LOCAL" | "GENLAYER_CANONICAL";
  deployed: boolean;
  chainId: number;
  contractAddress: string | null;
  runner: string;
  contractSha256: string;
  abiSha256: string;
  semanticSchema: "RIGHTSRAIL_USAGE_V1";
  publicMethodCount: number;
  publicReadMethodCount: number;
  publicWriteMethodCount: number;
  counts: Record<string, number>;
  label: string;
}
export interface DemoCase {
  case_id: string;
  request_id: string;
  result: string;
  settlement_type: string;
  permit_id: string | null;
}
export interface DemoBundle {
  case_id: string;
  request: RequestRecord;
  evidence: EvidenceRecord;
  adjudication: AdjudicationRecord;
  settlement: SettlementRecord;
  permit: PermitRecord | null;
}
export interface AccountingData extends AccountingSnapshot {
  claimable_by_address: Record<string, number>;
  refundable_by_address: Record<string, number>;
  delivery: Array<{ settlement_id: string; status: string; recipient: string; amount: number; external_operation: string | null }>;
}

async function request<T>(path: string, init?: RequestInit): Promise<Envelope<T>> {
  const response = await fetch(path, init);
  const payload = (await response.json()) as Envelope<T> & { error?: { message: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Request failed: ${response.status}`);
  return payload;
}

export const api = {
  status: () => request<StatusData>("/api/status"),
  policies: () => request<PolicyRecord[]>("/api/policies"),
  policy: (id: string) => request<PolicyRecord>(`/api/policies/${encodeURIComponent(id)}`),
  requests: () => request<RequestRecord[]>("/api/requests"),
  request: (id: string) => request<RequestRecord>(`/api/requests/${encodeURIComponent(id)}`),
  evidence: (id: string) => request<EvidenceRecord>(`/api/evidence/${encodeURIComponent(id)}`),
  adjudication: (id: string) => request<AdjudicationRecord>(`/api/adjudications/${encodeURIComponent(id)}`),
  permit: (id: string) => request<PermitRecord>(`/api/permits/${encodeURIComponent(id)}`),
  settlements: () => request<SettlementRecord[]>("/api/settlements"),
  settlement: (id: string) => request<SettlementRecord>(`/api/settlements/${encodeURIComponent(id)}`),
  activity: () => request<Array<{ id: string; action: string; subject_id: string; at: string; description: string; severity: string }>>("/api/activity"),
  accounting: () => request<AccountingData>("/api/accounting"),
  demos: () => request<DemoCase[]>("/api/demos"),
  demo: (id: string) => request<DemoBundle>(`/api/demos/${encodeURIComponent(id)}`),
  reset: () => request<unknown>("/api/local/reset", { method: "POST" }),
  saveDraft: (body: Record<string, unknown>) => request<PolicyRecord>("/api/local/policy-drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
};

export const semanticLabels: Record<SemanticKey, string> = {
  asset_match: "Asset identity",
  purpose_within_scope: "Purpose within scope",
  prohibited_context_present: "Prohibited context",
  transformation_within_scope: "Transformation within scope",
  attribution_satisfied: "Attribution satisfied",
  endorsement_implied: "Endorsement implied",
  evidence_sufficient: "Evidence sufficient",
};

export const semanticDescriptions: Record<SemanticKey, string> = {
  asset_match: "The proposed media is bound to the protected reference asset.",
  purpose_within_scope: "The stated use belongs to a purpose the policy permits.",
  prohibited_context_present: "A restricted context appears in the use or capture.",
  transformation_within_scope: "Cropping, color, and other edits stay within policy scope.",
  attribution_satisfied: "The required attribution is present and meaningful.",
  endorsement_implied: "The artifact implies an unauthorized recommendation or endorsement.",
  evidence_sufficient: "The authenticated media and context support a bounded evaluation.",
};

export function resultTone(result: string): string {
  return result.toLowerCase().replaceAll("_", "-");
}

export function vectorSummary(vector: SemanticVector): { key: SemanticKey; value: boolean }[] {
  return (Object.keys(vector) as SemanticKey[]).map((key) => ({ key, value: vector[key] }));
}
