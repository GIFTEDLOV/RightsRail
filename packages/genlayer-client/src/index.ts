import { RIGHTSRAIL_SCHEMA, type ProviderMode } from "@rightsrail/shared-ts";

export const CONTRACT_SHA256 =
  "C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B" as const;
export const ABI_SHA256 =
  "E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB" as const;
export const CANDIDATE_CONTRACT_SHA256 =
  "CEC17DF5D0D096591706B9547349DC870CE20C9276C9BCA2B0270204FDD29F0F" as const;
export const CANDIDATE_ABI_SHA256 =
  "E7FC1AB9E0EC3BC20BB06C992318F300000B1F617FA6F8977F0DEEF2B688F805" as const;
export const RUNNER =
  "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" as const;
export const STUDIO_DEV_RPC = "https://studio-dev.genlayer.com/api" as const;
export const STUDIO_DEV_CHAIN_ID = 61997 as const;

export const ABI_METHODS = {
  reads: [
    "contract_info",
    "get_accounting_status",
    "get_adjudication",
    "get_adjudication_ids",
    "get_claimable",
    "get_evidence",
    "get_evidence_ids",
    "get_permit",
    "get_permit_ids",
    "get_permit_status",
    "get_policy",
    "get_policy_ids",
    "get_policy_version",
    "get_refundable",
    "get_request",
    "get_request_ids",
    "get_semantic_keys",
    "get_semantic_schema",
    "get_settlement",
    "get_settlement_ids",
    "get_status",
  ],
  writes: [
    "adjudicate_usage",
    "authenticate_evidence",
    "close_policy",
    "commit_evidence",
    "create_policy",
    "freeze_policy",
    "settle_request",
    "submit_usage_request",
    "update_policy_draft",
  ],
} as const;

export const CANDIDATE_ABI_METHODS = {
  reads: [...ABI_METHODS.reads, "get_withdrawal", "get_withdrawal_ids"],
  writes: [...ABI_METHODS.writes, "withdraw_claimable", "withdraw_refund"],
} as const;

export type ReadMethod = (typeof ABI_METHODS.reads)[number];
export type WriteMethod = (typeof ABI_METHODS.writes)[number];
export type ContractMethod = ReadMethod | WriteMethod;

export type PolicyState = "DRAFT" | "FROZEN" | "CLOSED";
export type RequestState = "SUBMITTED" | "EVIDENCE_COMMITTED" | "ADJUDICATED" | "SETTLED";
export type PolicyResult = "PERMITTED" | "DENIED" | "INCONCLUSIVE" | "NOT_APPLICABLE";
export type SettlementType = "PAYOUT_ALLOCATED" | "REFUND_ALLOCATED";
export type DeliveryStatus =
  | "NOT_REQUESTED"
  | "ENTITLEMENT_ALLOCATED"
  | "WITHDRAWAL_EMITTED"
  | "ZERO_VALUE_NO_TRANSFER"
  | "DELIVERY_CONFIRMED"
  | "DELIVERY_FAILED_OR_UNKNOWN";

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

export interface ContractInfo {
  name: "RightsRail";
  version: string;
  semantic_schema: typeof RIGHTSRAIL_SCHEMA;
  max_semantic_images: 2;
  owner_override: false;
  settlement_model: "ENTITLEMENT_ALLOCATION";
  withdrawal_supported: boolean;
  delivery_model?: string;
  withdrawal_retry?: string;
}

export interface PolicyRecord {
  policy_id: string;
  issuer: string;
  version: number;
  state: PolicyState;
  asset_sha256: string;
  asset_exact_bytes: number;
  asset_media_type: string;
  asset_source: string;
  allowed_purposes: string[];
  prohibited_purposes: string[];
  allowed_channels: string[];
  prohibited_contexts: string[];
  transformation_rules: string[];
  attribution_requirement: string;
  endorsement_rule: string;
  valid_from: number;
  valid_until: number;
  required_fee_wei: number;
  settlement_recipient: string;
  created_at: number;
  frozen_at: number;
  closed_at: number;
}

export interface RequestRecord {
  request_id: string;
  policy_id: string;
  policy_version: number;
  requester: string;
  purpose_description: string;
  channel: string;
  context_description: string;
  proposed_asset_sha256: string;
  proposed_asset_exact_bytes: number;
  proposed_media_type: string;
  public_evidence_url: string;
  attribution_text: string;
  request_digest: string;
  required_fee: number;
  escrowed_value: number;
  escrow_received: number;
  escrow_consumed: number;
  entitlement_type: SettlementType | "";
  entitlement_recipient: string;
  entitlement_amount: number;
  settlement_id: string;
  created_at: number;
  settled_at: number;
  state: RequestState;
  generation: number;
  withdrawal_id?: string;
}

export interface EvidenceRecord {
  evidence_id: string;
  request_id: string;
  policy_id: string;
  policy_version: number;
  reference_source: string;
  reference_sha256: string;
  reference_byte_length: number;
  reference_mime: string;
  proposed_source: string;
  proposed_sha256: string;
  proposed_byte_length: number;
  proposed_mime: string;
  public_context_url: string;
  context_content_sha256: string;
  context_screenshot_sha256: string;
  authority_digest: string;
  attribution_text: string;
  schema_version: string;
  status: "COMMITTED";
}

export interface AdjudicationRecord {
  adjudication_id: string;
  request_id: string;
  policy_id: string;
  policy_version: number;
  evidence_id: string;
  evidence_hash: string;
  generation: number;
  semantic_schema: typeof RIGHTSRAIL_SCHEMA;
  semantic_vector: SemanticVector;
  result: PolicyResult;
  state: "FINAL";
  created_at: number;
}

export interface PermitRecord {
  permit_id: string;
  policy_id: string;
  policy_version: number;
  issuer: string;
  requester: string;
  asset_sha256: string;
  request_id: string;
  request_digest: string;
  evidence_id: string;
  evidence_hash: string;
  adjudication_id: string;
  generation: number;
  semantic_schema: typeof RIGHTSRAIL_SCHEMA;
  fee: number;
  settlement_recipient: string;
  issued_at: number;
  expires_at: number;
  permit_binding_hash: string;
  status: "ISSUED";
}

export interface SettlementRecord {
  settlement_id: string;
  request_id: string;
  policy_id: string;
  policy_version: number;
  requester: string;
  adjudication_id: string;
  generation: number;
  result: PolicyResult;
  settlement_type: SettlementType;
  amount: number;
  recipient: string;
  escrow_received: number;
  escrow_consumed: number;
  settled_at: number;
  delivery_status: DeliveryStatus;
  withdrawal_id: string;
}

export interface AccountingSnapshot {
  total_escrow_received: number;
  total_escrowed: number;
  total_payout_allocated: number;
  total_refund_allocated: number;
  total_claimable_outstanding: number;
  total_refundable_outstanding: number;
  total_withdrawal_emitted: number;
  conservation_rhs: number;
}

export interface WithdrawalRecord {
  withdrawal_id: string;
  settlement_id: string;
  request_id: string;
  entitlement_type: SettlementType;
  recipient: string;
  amount: number;
  status: "WITHDRAWAL_EMITTED" | "ZERO_VALUE_NO_TRANSFER";
  emitted_at: number;
  delivery_confirmation: "NOT_AVAILABLE";
}

export interface TransactionJournalEntry {
  id: string;
  requestId?: string;
  action: string;
  state: "PRECONDITION_READ" | "PREPARED" | "AWAITING_WALLET" | "BROADCAST" | "PENDING" | "ACCEPTED" | "FINALIZED" | "EXECUTION_RESULT_CHECK" | "CANONICAL_READBACK";
  canonical: false;
  createdAt: string;
}

export interface DeploymentConfig {
  mode: ProviderMode;
  chainId: number;
  rpcUrl: string | null;
  contractAddress: string | null;
  contractSha256: typeof CONTRACT_SHA256;
  abiSha256: typeof ABI_SHA256;
  runner: typeof RUNNER;
}

export interface CanonicalReader {
  readonly config: DeploymentConfig;
  getPolicy(id: string): Promise<PolicyRecord>;
  getRequest(id: string): Promise<RequestRecord>;
  getEvidence(id: string): Promise<EvidenceRecord>;
  getAdjudication(id: string): Promise<AdjudicationRecord>;
  getPermit(id: string): Promise<PermitRecord>;
  getSettlement(id: string): Promise<SettlementRecord>;
  getAccounting(): Promise<AccountingSnapshot>;
}

export interface TransactionPreparer {
  prepare(method: WriteMethod, args: readonly unknown[], value?: number): TransactionJournalEntry;
}

export class FrozenContractClient implements CanonicalReader, TransactionPreparer {
  readonly config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  prepare(method: WriteMethod, args: readonly unknown[], value?: number): TransactionJournalEntry {
    if (this.config.mode === "GENLAYER_CANONICAL") {
      throw new Error("Canonical transaction broadcasting is disabled in this local phase");
    }
    return {
      id: `journal-${method}-${Date.now()}`,
      action: `${method}:${JSON.stringify(args)}${value === undefined ? "" : `:${value}`}`,
      state: "PRECONDITION_READ",
      canonical: false,
      createdAt: new Date().toISOString(),
    };
  }

  private unavailable(): never {
    throw new Error("No deployed RightsRail contract address is configured");
  }
  getPolicy(_id: string): Promise<PolicyRecord> { return Promise.reject(this.unavailable()); }
  getRequest(_id: string): Promise<RequestRecord> { return Promise.reject(this.unavailable()); }
  getEvidence(_id: string): Promise<EvidenceRecord> { return Promise.reject(this.unavailable()); }
  getAdjudication(_id: string): Promise<AdjudicationRecord> { return Promise.reject(this.unavailable()); }
  getPermit(_id: string): Promise<PermitRecord> { return Promise.reject(this.unavailable()); }
  getSettlement(_id: string): Promise<SettlementRecord> { return Promise.reject(this.unavailable()); }
  getAccounting(): Promise<AccountingSnapshot> { return Promise.reject(this.unavailable()); }
}

export function contractConfig(mode: ProviderMode = "CONTROLLED_LOCAL"): DeploymentConfig {
  return {
    mode,
    chainId: STUDIO_DEV_CHAIN_ID,
    rpcUrl: mode === "GENLAYER_CANONICAL" ? STUDIO_DEV_RPC : null,
    contractAddress: null,
    contractSha256: CONTRACT_SHA256,
    abiSha256: ABI_SHA256,
    runner: RUNNER,
  };
}

export function assertSemanticVector(value: unknown): asserts value is SemanticVector {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid semantic vector");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join("|") !== [...SEMANTIC_KEYS].sort().join("|")) throw new Error("Semantic schema keys mismatch");
  for (const key of SEMANTIC_KEYS) if (typeof record[key] !== "boolean") throw new Error(`Semantic key ${key} is not boolean`);
}
