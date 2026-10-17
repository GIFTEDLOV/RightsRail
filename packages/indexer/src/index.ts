import { createHash } from "node:crypto";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  ABI_METHODS,
  ABI_SHA256,
  CONTRACT_SHA256,
  STUDIONET_CHAIN_ID,
  STUDIONET_RPC,
  contractConfig,
  type AccountingSnapshot,
  type AdjudicationRecord,
  type EvidenceRecord,
  type PermitRecord,
  type PolicyRecord,
  type RequestRecord,
  type SettlementRecord,
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

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error("Canonical value exceeds the API's safe integer range");
    return number;
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    if (value instanceof Uint8Array) return Buffer.from(value).toString("hex");
    if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [String(key), jsonValue(item)]));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  }
  return value;
}

function parse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

function digest(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex").toUpperCase();
}

function canonicalMethodsMatch(schema: { methods?: Record<string, { readonly?: boolean }> }): void {
  const names = Object.keys(schema.methods ?? {}).sort();
  const expected = [...ABI_METHODS.reads, ...ABI_METHODS.writes].sort();
  if (names.join("|") !== expected.join("|")) throw new Error("Canonical schema method names do not match the V2.4 candidate");
  const reads = names.filter((name) => schema.methods?.[name]?.readonly === true);
  const writes = names.filter((name) => schema.methods?.[name]?.readonly !== true);
  if (reads.length !== 24 || writes.length !== 12) throw new Error("Canonical schema method counts do not match the V2.4 candidate");
}

export class GenLayerCanonicalProvider implements RightsRailProvider {
  readonly mode = "GENLAYER_CANONICAL" as const;
  readonly canonical = true as const;
  readonly config;
  private readonly client = createClient({ chain: studionet });
  private lastSnapshot: { at: number; value: IndexedState } | null = null;
  private pendingSnapshot: Promise<IndexedState> | null = null;

  invalidate(): void { this.lastSnapshot = null; }

  constructor(readonly address: string | null) {
    this.config = contractConfig("GENLAYER_CANONICAL", address);
  }

  private async read(functionName: string, args: unknown[] = []): Promise<unknown> {
    if (!this.address) throw new Error("Canonical provider unavailable: contract is not deployed");
    return parse(await this.client.readContract({ address: this.address as `0x${string}`, functionName, args: args as never[] }));
  }

  private async pages(method: string): Promise<unknown[]> {
    const values: unknown[] = [];
    for (let start = 0; ; start += 64) {
      const page = await this.read(method, [BigInt(start), 64n]);
      if (!Array.isArray(page)) throw new Error(`Canonical page is invalid: ${method}`);
      values.push(...page);
      if (page.length < 64) return values;
    }
  }

  private async records<T>(idsMethod: string, recordMethod: string): Promise<T[]> {
    const ids = await this.pages(idsMethod);
    const values: T[] = [];
    for (const id of ids) {
      const record = await this.read(recordMethod, [String(id)]);
      if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Canonical record is invalid: ${recordMethod}`);
      values.push(jsonValue(record) as T);
    }
    return values;
  }

  async snapshot(): Promise<IndexedState> {
    if (this.lastSnapshot && Date.now() - this.lastSnapshot.at < 60000) return structuredClone(this.lastSnapshot.value);
    if (!this.pendingSnapshot) this.pendingSnapshot = this.loadSnapshot().finally(() => { this.pendingSnapshot = null; });
    return structuredClone(await this.pendingSnapshot);
  }

  private async loadSnapshot(): Promise<IndexedState> {
    if (!this.address) throw new Error("Canonical provider unavailable: contract is not deployed");
    if (!/^0x[\da-fA-F]{40}$/.test(this.address)) throw new Error("Canonical provider contract address is invalid");
    if (CHAIN_ID !== STUDIONET_CHAIN_ID || studionet.id !== STUDIONET_CHAIN_ID || studionet.rpcUrls.default.http[0] !== STUDIONET_RPC) {
      throw new Error("Canonical provider is not configured for built-in Studionet");
    }

    const [source, schema] = await Promise.all([
      this.client.getContractCode(this.address as `0x${string}`),
      this.client.getContractSchema(this.address as `0x${string}`),
    ]);
    if (digest(source) !== CONTRACT_SHA256) throw new Error("Canonical contract source hash does not match the V2.4 candidate");
    canonicalMethodsMatch(schema);
    const [policies, requests, evidence, adjudications, permits, settlements, accountingRaw, auditRaw] = await Promise.all([
      this.records<PolicyRecord>("get_policy_ids", "get_policy"),
      this.records<RequestRecord>("get_request_ids", "get_request"),
      this.records<EvidenceRecord>("get_evidence_ids", "get_evidence"),
      this.records<AdjudicationRecord>("get_adjudication_ids", "get_adjudication"),
      this.records<PermitRecord>("get_permit_ids", "get_permit"),
      this.records<SettlementRecord>("get_settlement_ids", "get_settlement"),
      this.read("get_accounting_status"),
      this.pages("get_audit_events"),
    ]);
    if (!accountingRaw || typeof accountingRaw !== "object" || Array.isArray(accountingRaw)) throw new Error("Canonical accounting read is invalid");
    if (!Array.isArray(auditRaw)) throw new Error("Canonical audit page is invalid");
    const accounting = jsonValue(accountingRaw) as AccountingSnapshot;
    const delivery: DeliveryRecord[] = settlements.map((settlement) => ({
      settlement_id: settlement.settlement_id,
      status: settlement.delivery_status as DeliveryRecord["status"],
      recipient: settlement.recipient,
      amount: settlement.amount,
      external_operation: settlement.withdrawal_id || null,
    }));
    const activity = auditRaw.map((item, index) => {
      const parsed = parse(item) as Record<string, unknown>;
      const action = String(parsed.action ?? "CANONICAL_AUDIT_EVENT");
      const timestamp = Number(parsed.at);
      return {
        id: `audit-${String(parsed.sequence ?? index + 1)}`,
        action,
        subject_id: String(parsed.subject_id ?? ""),
        at: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : "",
        description: `Canonical audit event ${String(parsed.sequence ?? index + 1)}; details hash ${String(parsed.details_sha256 ?? "unavailable")}.`,
        severity: action.includes("FAILED") || action.includes("DENIED") ? "WARNING" as const : "INFO" as const,
      };
    });
    const value: IndexedState = { policies, requests, evidence, adjudications, permits, settlements, accounting, delivery, activity };
    this.lastSnapshot = { at: Date.now(), value };
    return structuredClone(value);
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
