export type PolicyState = "DRAFT" | "FROZEN" | "CLOSED";
export type RequestState =
  | "SUBMITTED"
  | "EVIDENCE_COMMITTED"
  | "ADJUDICATED"
  | "SETTLED";
export type EvidenceAuthStatus =
  | "AUTHENTICATED"
  | "FETCH_FAILED"
  | "INVALID_CONTENT"
  | "AUTHENTICATION_FAILED";

export interface RightsRailContractInfo {
  name: "RightsRail";
  version: string;
  semantic_schema: "RIGHTSRAIL_USAGE_V1";
  max_semantic_images: 2;
  owner_override: false;
}

export interface CanonicalRead<T> {
  value: T;
  source: "contract" | "rebuildable-indexer";
  finality: "CANONICAL" | "PENDING";
  execution: "NOT_APPLICABLE" | "SUCCEEDED" | "FAILED";
}

export interface TransactionJournalEntry {
  sequence: bigint;
  action: string;
  subjectId: string;
  detailsSha256: string;
  stateBefore: string;
  stateAfter: string;
}

export interface EvidenceAuthenticationJob {
  evidenceId: string;
  attempt: number;
  status: EvidenceAuthStatus;
  journalSequence?: bigint;
}
