export const SEMANTIC_SCHEMA = "RIGHTSRAIL_USAGE_V1" as const;

export const SEMANTIC_KEYS = [
  "asset_match",
  "purpose_within_scope",
  "prohibited_context_present",
  "transformation_within_scope",
  "attribution_satisfied",
  "endorsement_implied",
  "evidence_sufficient",
] as const;

export type SemanticKey = (typeof SEMANTIC_KEYS)[number];
export type SemanticVector = Record<SemanticKey, boolean>;
export type PolicyResult =
  | "PERMITTED"
  | "DENIED"
  | "INCONCLUSIVE"
  | "NOT_APPLICABLE";

export interface EvidenceComparison {
  referenceSource: string;
  proposedSource: string;
  referenceSha256: string;
  proposedSha256: string;
  referenceByteLength: bigint;
  proposedByteLength: bigint;
  publicContextUrl?: string;
}

export interface AdjudicationReadModel {
  adjudicationId: string;
  requestId: string;
  policyId: string;
  policyVersion: number;
  generation: number;
  semanticSchema: typeof SEMANTIC_SCHEMA;
  semanticVector: SemanticVector;
  result: PolicyResult;
}

export interface ProtectedVsProposedUse {
  protectedAsset: EvidenceComparison;
  proposedActualUse: EvidenceComparison;
  adjudication?: AdjudicationReadModel;
}
