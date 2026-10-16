import { createHash } from "node:crypto";

export const RIGHTSRAIL_SCHEMA = "RIGHTSRAIL_USAGE_V1" as const;
export const CHAIN_ID = 61999 as const;
export const PROVIDER_MODE = "CONTROLLED_LOCAL" as const;

export type ProviderMode = "CONTROLLED_LOCAL" | "GENLAYER_CANONICAL";
export type ProvenanceSource = "controlled-fixture-store" | "genlayer-contract";

export interface ProvenanceMeta {
  mode: ProviderMode;
  canonical: boolean;
  chainId: number;
  contractAddress: string | null;
  source: ProvenanceSource;
  asOf: string;
}

export interface ApiEnvelope<T> {
  data: T;
  provenance: ProvenanceMeta;
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function shortHash(value: string, visible = 12): string {
  if (value.length <= visible * 2 + 1) return value;
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}
