import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, nowIso } from "@rightsrail/shared-ts";
import type {
  AccountingSnapshot,
  AdjudicationRecord,
  EvidenceRecord,
  PermitRecord,
  PolicyRecord,
  RequestRecord,
  SettlementRecord,
  SemanticVector,
} from "@rightsrail/genlayer-client";
import type { ActivityRecord, DeliveryRecord, IndexedState } from "@rightsrail/indexer";

const API_SRC = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(API_SRC, "../.data/rightsrail.local.json");
const DEMO_PATH = resolve(API_SRC, "../../web/public/demo");

export interface LocalState extends IndexedState {
  claimable_by_address: Record<string, number>;
  refundable_by_address: Record<string, number>;
  mode: "CONTROLLED_LOCAL";
}

const vectors: Record<string, SemanticVector> = {
  "case-a": {
    asset_match: true,
    purpose_within_scope: true,
    prohibited_context_present: false,
    transformation_within_scope: true,
    attribution_satisfied: true,
    endorsement_implied: false,
    evidence_sufficient: true,
  },
  "case-b": {
    asset_match: true,
    purpose_within_scope: false,
    prohibited_context_present: true,
    transformation_within_scope: true,
    attribution_satisfied: true,
    endorsement_implied: true,
    evidence_sufficient: true,
  },
  "case-c": {
    asset_match: true,
    purpose_within_scope: true,
    prohibited_context_present: false,
    transformation_within_scope: true,
    attribution_satisfied: false,
    endorsement_implied: false,
    evidence_sufficient: false,
  },
  "case-d": {
    asset_match: false,
    purpose_within_scope: true,
    prohibited_context_present: false,
    transformation_within_scope: true,
    attribution_satisfied: true,
    endorsement_implied: false,
    evidence_sufficient: true,
  },
};

function asset(file: string): { source: string; sha256: string; bytes: number; mime: string } {
  const bytes = readFileSync(resolve(DEMO_PATH, file));
  return {
    source: `/demo/${file}`,
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
    mime: "image/svg+xml",
  };
}

function policy(): PolicyRecord {
  const reference = asset("reference.svg");
  return {
    policy_id: "policy-lumen-finch-001",
    issuer: "CONTROLLED_LOCAL_ISSUER",
    version: 1,
    state: "FROZEN",
    asset_sha256: reference.sha256,
    asset_exact_bytes: reference.bytes,
    asset_media_type: reference.mime,
    asset_source: reference.source,
    allowed_purposes: ["commercial editorial", "technology newsletter", "web article"],
    prohibited_purposes: ["gambling promotion", "impersonation"],
    allowed_channels: ["newsletter", "article", "editorial web"],
    prohibited_contexts: ["betting advertisement", "synthetic endorsement", "impersonation"],
    transformation_rules: ["cropping allowed", "color changes allowed"],
    attribution_requirement: "Visible attribution required",
    endorsement_rule: "Synthetic endorsement prohibited",
    valid_from: 1767225600,
    valid_until: 0,
    required_fee_wei: 10,
    settlement_recipient: "CONTROLLED_LOCAL_RECIPIENT",
    created_at: 1767225600,
    frozen_at: 1767225660,
    closed_at: 0,
  };
}

function makeRequest(
  id: string,
  caseId: string,
  proposed: ReturnType<typeof asset>,
  purpose: string,
  context: string,
  attribution: string,
  resultState: RequestRecord["state"],
): RequestRecord {
  return {
    request_id: id,
    policy_id: "policy-lumen-finch-001",
    policy_version: 1,
    requester: caseId === "case-a" ? "CONTROLLED_LOCAL_REQUESTER_A" : "CONTROLLED_LOCAL_REQUESTER",
    purpose_description: purpose,
    channel: caseId === "case-b" ? "paid social advertisement" : "newsletter",
    context_description: context,
    proposed_asset_sha256: proposed.sha256,
    proposed_asset_exact_bytes: proposed.bytes,
    proposed_media_type: proposed.mime,
    public_evidence_url: caseId === "case-c" ? "" : `https://controlled.rightsrail.test/${caseId}`,
    attribution_text: attribution,
    request_digest: sha256(`${id}:policy-lumen-finch-001:v1`),
    required_fee: 10,
    escrowed_value: 0,
    escrow_received: 10,
    escrow_consumed: 10,
    entitlement_type: resultState === "SETTLED" && caseId === "case-a" ? "PAYOUT_ALLOCATED" : "REFUND_ALLOCATED",
    entitlement_recipient: caseId === "case-a" ? "CONTROLLED_LOCAL_RECIPIENT" : "CONTROLLED_LOCAL_REQUESTER",
    entitlement_amount: 10,
    settlement_id: `settle-${caseId}`,
    created_at: 1767225900,
    settled_at: 1767226200,
    state: resultState,
    generation: 1,
  };
}

function makeEvidence(id: string, requestId: string, proposed: ReturnType<typeof asset>, contextUrl: string, sufficient: boolean): EvidenceRecord {
  const reference = asset("reference.svg");
  return {
    evidence_id: id,
    request_id: requestId,
    policy_id: "policy-lumen-finch-001",
    policy_version: 1,
    reference_source: reference.source,
    reference_sha256: reference.sha256,
    reference_byte_length: reference.bytes,
    reference_mime: reference.mime,
    proposed_source: proposed.source,
    proposed_sha256: proposed.sha256,
    proposed_byte_length: proposed.bytes,
    proposed_mime: proposed.mime,
    public_context_url: contextUrl,
    context_content_sha256: sufficient ? sha256(`${id}:context`) : "",
    context_screenshot_sha256: sufficient ? sha256(`${id}:screenshot`) : "",
    authority_digest: sha256(`${reference.source}|${proposed.source}|${contextUrl}`),
    attribution_text: sufficient ? "Image courtesy of Lumen Finch Studio" : "",
    schema_version: "RIGHTSRAIL_EVIDENCE_V1",
    status: "COMMITTED",
  };
}

function resultFor(caseId: string): AdjudicationRecord["result"] {
  const results: Record<string, AdjudicationRecord["result"]> = { "case-a": "PERMITTED", "case-b": "DENIED", "case-c": "INCONCLUSIVE", "case-d": "NOT_APPLICABLE" };
  return results[caseId] ?? "DENIED";
}

function makeAdjudication(id: string, requestId: string, evidenceId: string, caseId: string): AdjudicationRecord {
  return {
    adjudication_id: id,
    request_id: requestId,
    policy_id: "policy-lumen-finch-001",
    policy_version: 1,
    evidence_id: evidenceId,
    evidence_hash: sha256(`${evidenceId}:immutable`),
    generation: 1,
    semantic_schema: "RIGHTSRAIL_USAGE_V1",
    semantic_vector: vectors[caseId] ?? vectors["case-a"],
    result: resultFor(caseId),
    state: "FINAL",
    created_at: 1767226150,
  };
}

function makeSettlement(caseId: string, requestId: string, adjudicationId: string): SettlementRecord {
  const result = resultFor(caseId);
  return {
    settlement_id: `settle-${caseId}`,
    request_id: requestId,
    policy_id: "policy-lumen-finch-001",
    policy_version: 1,
    requester: caseId === "case-a" ? "CONTROLLED_LOCAL_REQUESTER_A" : "CONTROLLED_LOCAL_REQUESTER",
    adjudication_id: adjudicationId,
    generation: 1,
    result,
    settlement_type: result === "PERMITTED" ? "PAYOUT_ALLOCATED" : "REFUND_ALLOCATED",
    amount: 10,
    recipient: result === "PERMITTED" ? "CONTROLLED_LOCAL_RECIPIENT" : "CONTROLLED_LOCAL_REQUESTER",
    escrow_received: 10,
    escrow_consumed: 10,
    settled_at: 1767226200,
    delivery_status: "ENTITLEMENT_ALLOCATED",
    withdrawal_id: "",
  };
}

export function seedState(): LocalState {
  const protectedAsset = asset("reference.svg");
  const proposedA = asset("proposed-editorial.svg");
  const proposedB = asset("proposed-betting.svg");
  const proposedC = asset("proposed-missing-context.svg");
  const proposedD = asset("unrelated.svg");
  const p = policy();
  const requests = [
    makeRequest("request-case-a", "case-a", proposedA, "Technology newsletter editorial", "Independent product analysis; no endorsement", "Image courtesy of Lumen Finch Studio", "SETTLED"),
    makeRequest("request-case-b", "case-b", proposedB, "Commercial betting promotion", "Betting offer presented as a recommendation", "Image courtesy of Lumen Finch Studio", "SETTLED"),
    makeRequest("request-case-c", "case-c", proposedC, "Technology newsletter editorial", "Context page unavailable during capture", "", "SETTLED"),
    makeRequest("request-case-d", "case-d", proposedD, "Technology newsletter editorial", "Unrelated asset supplied", "Image courtesy of Lumen Finch Studio", "SETTLED"),
  ];
  const evidence = [
    makeEvidence("evidence-case-a", "request-case-a", proposedA, "https://controlled.rightsrail.test/case-a", true),
    makeEvidence("evidence-case-b", "request-case-b", proposedB, "https://controlled.rightsrail.test/case-b", true),
    makeEvidence("evidence-case-c", "request-case-c", proposedC, "", false),
    makeEvidence("evidence-case-d", "request-case-d", proposedD, "https://controlled.rightsrail.test/case-d", true),
  ];
  const adjudications = [
    makeAdjudication("adj-case-a", "request-case-a", "evidence-case-a", "case-a"),
    makeAdjudication("adj-case-b", "request-case-b", "evidence-case-b", "case-b"),
    makeAdjudication("adj-case-c", "request-case-c", "evidence-case-c", "case-c"),
    makeAdjudication("adj-case-d", "request-case-d", "evidence-case-d", "case-d"),
  ];
  const settlements = adjudications.map((adjudication) => makeSettlement(adjudication.request_id.replace("request-", ""), adjudication.request_id, adjudication.adjudication_id));
  const accounting: AccountingSnapshot = {
    total_escrow_received: 40,
    total_escrowed: 0,
    total_payout_allocated: 10,
    total_refund_allocated: 30,
    total_claimable_outstanding: 10,
    total_refundable_outstanding: 30,
    total_withdrawal_emitted: 0,
    conservation_rhs: 40,
  };
  const permits: PermitRecord[] = [{
    permit_id: "permit-case-a",
    policy_id: p.policy_id,
    policy_version: 1,
    issuer: p.issuer,
    requester: requests[0].requester,
    asset_sha256: protectedAsset.sha256,
    request_id: requests[0].request_id,
    request_digest: requests[0].request_digest,
    evidence_id: evidence[0].evidence_id,
    evidence_hash: adjudications[0].evidence_hash,
    adjudication_id: adjudications[0].adjudication_id,
    generation: 1,
    semantic_schema: "RIGHTSRAIL_USAGE_V1",
    fee: 10,
    settlement_recipient: p.settlement_recipient,
    issued_at: 1767226200,
    expires_at: 0,
    permit_binding_hash: sha256("permit-case-a:bound"),
    status: "ISSUED",
  }];
  const delivery: DeliveryRecord[] = settlements.map((settlement) => ({
    settlement_id: settlement.settlement_id,
    status: "ENTITLEMENT_ALLOCATED",
    recipient: settlement.recipient,
    amount: settlement.amount,
    external_operation: null,
  }));
  const activity: ActivityRecord[] = [
    { id: "activity-004", action: "SETTLEMENT_ALLOCATED", subject_id: "settle-case-a", at: nowIso(), description: "Payout entitlement allocated; permit issued.", severity: "SUCCESS" },
    { id: "activity-003", action: "ADJUDICATION_FINALIZED", subject_id: "adj-case-b", at: nowIso(), description: "Semantic policy result DENIED.", severity: "WARNING" },
    { id: "activity-002", action: "EVIDENCE_AUTHENTICATED", subject_id: "evidence-case-a", at: nowIso(), description: "Reference and proposed media bindings authenticated.", severity: "SUCCESS" },
    { id: "activity-001", action: "POLICY_FROZEN", subject_id: p.policy_id, at: nowIso(), description: "Lumen Finch usage policy frozen locally.", severity: "INFO" },
  ];
  return {
    mode: "CONTROLLED_LOCAL",
    policies: [p],
    requests,
    evidence,
    adjudications,
    permits,
    settlements,
    accounting,
    delivery,
    activity,
    claimable_by_address: { [p.settlement_recipient]: 10 },
    refundable_by_address: { CONTROLLED_LOCAL_REQUESTER_A: 0, CONTROLLED_LOCAL_REQUESTER: 30 },
  };
}

export class LocalStore {
  private state: LocalState;
  constructor() {
    this.state = this.load();
  }
  private load(): LocalState {
    if (!existsSync(DATA_PATH)) {
      const seeded = seedState();
      this.persist(seeded);
      return seeded;
    }
    return JSON.parse(readFileSync(DATA_PATH, "utf8")) as LocalState;
  }
  private persist(state: LocalState): void {
    mkdirSync(dirname(DATA_PATH), { recursive: true });
    writeFileSync(DATA_PATH, JSON.stringify(state, null, 2), "utf8");
  }
  snapshot(): LocalState { return structuredClone(this.state); }
  reset(): LocalState {
    this.state = seedState();
    this.persist(this.state);
    return this.snapshot();
  }
  addPolicyDraft(input: Record<string, unknown>): PolicyRecord {
    const id = `policy-draft-${Date.now()}`;
    const draft: PolicyRecord = {
      ...this.state.policies[0],
      ...input,
      policy_id: id,
      state: "DRAFT",
      version: 1,
      created_at: Math.floor(Date.now() / 1000),
      frozen_at: 0,
      closed_at: 0,
    } as PolicyRecord;
    this.state.policies = [draft, ...this.state.policies];
    this.state.activity = [{ id: `activity-${Date.now()}`, action: "POLICY_DRAFT_PREPARED", subject_id: id, at: nowIso(), description: "Local pre-deployment policy draft prepared.", severity: "INFO" }, ...this.state.activity];
    this.persist(this.state);
    return draft;
  }
}

export const localStore = new LocalStore();
