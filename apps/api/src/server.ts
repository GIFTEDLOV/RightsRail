import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ABI_METHODS, contractConfig } from "@rightsrail/genlayer-client";
import { ControlledFixtureProvider, GenLayerCanonicalProvider, envelope, findById, type RightsRailProvider } from "@rightsrail/indexer";
import { CHAIN_ID, nowIso } from "@rightsrail/shared-ts";
import { localStore } from "./store.js";

const port = Number(process.env.PORT ?? 3002);
const configuredMode = process.env.RIGHTSRAIL_PROVIDER_MODE === "GENLAYER_CANONICAL" ? "GENLAYER_CANONICAL" : "CONTROLLED_LOCAL";
const configuredContractAddress = process.env.RIGHTSRAIL_CONTRACT_ADDRESS ?? null;
const provider: RightsRailProvider = configuredMode === "GENLAYER_CANONICAL"
  ? new GenLayerCanonicalProvider(configuredContractAddress)
  : new ControlledFixtureProvider(() => localStore.snapshot());
const appConfig = contractConfig(configuredMode, configuredContractAddress);

function caseIdFromRequest(requestId: string): string {
  const match = requestId.match(/(?:v24-)?request-(case-[a-d])$/i);
  return match?.[1]?.toLowerCase() ?? requestId.replace(/^request-/, "");
}

function headers(): Record<string, string> {
  return { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "http://127.0.0.1:3001", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
}
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, headers());
  res.end(JSON.stringify(body));
}
function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => { raw += chunk.toString("utf8"); });
    req.on("end", () => {
      if (!raw) return resolveBody({});
      try { resolveBody(JSON.parse(raw) as Record<string, unknown>); } catch { reject(new Error("Request body is not valid JSON")); }
    });
    req.on("error", reject);
  });
}
async function snapshot() {
  return provider.snapshot();
}
function error(res: ServerResponse, status: number, code: string, message: string): void {
  writeJson(res, status, { error: { code, message }, provenance: { mode: configuredMode, canonical: configuredMode === "GENLAYER_CANONICAL", chainId: CHAIN_ID, contractAddress: configuredContractAddress, source: configuredMode === "GENLAYER_CANONICAL" ? "genlayer-contract" : "controlled-fixture-store", asOf: nowIso() } });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, headers()); res.end(); return; }
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  const path = url.pathname.replace(/\/$/, "") || "/";
  try {
    if (path === "/api/status" && req.method === "GET") {
      const state = await snapshot();
      return writeJson(res, 200, envelope(provider, { mode: configuredMode, deployed: provider.canonical, chainId: CHAIN_ID, contractAddress: appConfig.contractAddress, runner: appConfig.runner, contractSha256: appConfig.contractSha256, abiSha256: appConfig.abiSha256, semanticSchema: "RIGHTSRAIL_USAGE_V1", publicMethodCount: ABI_METHODS.reads.length + ABI_METHODS.writes.length, publicReadMethodCount: ABI_METHODS.reads.length, publicWriteMethodCount: ABI_METHODS.writes.length, counts: { policies: state.policies.length, requests: state.requests.length, evidence: state.evidence.length, adjudications: state.adjudications.length, permits: state.permits.length, settlements: state.settlements.length }, label: provider.canonical ? "CANONICAL STUDIONET V2.4" : "CONTROLLED LOCAL QUALIFICATION" }));
    }
    const state = await snapshot();
    if (path === "/api/policies" && req.method === "GET") return writeJson(res, 200, envelope(provider, state.policies));
    if (path === "/api/requests" && req.method === "GET") return writeJson(res, 200, envelope(provider, state.requests));
    if (path === "/api/settlements" && req.method === "GET") return writeJson(res, 200, envelope(provider, state.settlements));
    if (path === "/api/activity" && req.method === "GET") return writeJson(res, 200, envelope(provider, state.activity));
    if (path === "/api/accounting" && req.method === "GET") {
      const localState = configuredMode === "CONTROLLED_LOCAL" ? localStore.snapshot() : null;
      return writeJson(res, 200, envelope(provider, { ...state.accounting, claimable_by_address: localState?.claimable_by_address ?? {}, refundable_by_address: localState?.refundable_by_address ?? {}, delivery: state.delivery }));
    }
    if (path === "/api/demos" && req.method === "GET") return writeJson(res, 200, envelope(provider, state.adjudications.map((adjudication) => ({ case_id: caseIdFromRequest(adjudication.request_id), request_id: adjudication.request_id, result: adjudication.result, settlement_type: state.settlements.find((item) => item.request_id === adjudication.request_id)?.settlement_type, permit_id: state.permits.find((item) => item.request_id === adjudication.request_id)?.permit_id ?? null }))));
    const demoMatch = path.match(/^\/api\/demos\/([^/]+)$/);
    if (demoMatch && req.method === "GET") {
      const caseId = demoMatch[1];
      const request = findById(state.requests, "request_id", state.adjudications.find((item) => caseIdFromRequest(item.request_id) === caseId)?.request_id ?? `request-${caseId}`);
      const evidence = findById(state.evidence, "request_id", request.request_id);
      const adjudication = findById(state.adjudications, "request_id", request.request_id);
      const settlement = findById(state.settlements, "request_id", request.request_id);
      return writeJson(res, 200, envelope(provider, { case_id: caseId, request, evidence, adjudication, settlement, permit: state.permits.find((item) => item.request_id === request.request_id) ?? null }));
    }
    type CollectionName = "policies" | "requests" | "evidence" | "adjudications" | "permits" | "settlements";
    const routes: Array<[RegExp, CollectionName, string]> = [
      [/^\/api\/policies\/([^/]+)$/, "policies", "policy_id"],
      [/^\/api\/requests\/([^/]+)$/, "requests", "request_id"],
      [/^\/api\/evidence\/([^/]+)$/, "evidence", "evidence_id"],
      [/^\/api\/adjudications\/([^/]+)$/, "adjudications", "adjudication_id"],
      [/^\/api\/permits\/([^/]+)$/, "permits", "permit_id"],
      [/^\/api\/settlements\/([^/]+)$/, "settlements", "settlement_id"],
    ];
    for (const [pattern, collection, key] of routes) {
      const match = path.match(pattern);
      if (match && req.method === "GET") return writeJson(res, 200, envelope(provider, findById(state[collection] as object[], key, match[1])));
    }
    if ((path === "/api/local/reset" || path === "/api/local/policy-drafts") && req.method === "POST" && configuredMode === "GENLAYER_CANONICAL") return error(res, 403, "CANONICAL_READ_ONLY", "Canonical Studionet mode is read-only; local fixture writes are disabled.");
    if (path === "/api/local/reset" && req.method === "POST") return writeJson(res, 200, envelope(provider, localStore.reset()));
    if (path === "/api/local/policy-drafts" && req.method === "POST") return writeJson(res, 201, envelope(provider, localStore.addPolicyDraft(await readBody(req))));
    if (path.startsWith("/api/")) return error(res, 404, "NOT_FOUND", "The requested RightsRail record or endpoint was not found.");
    return error(res, 404, "NOT_FOUND", "API route not found.");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unexpected local API failure";
    const status = message.startsWith("Record not found") ? 404 : 500;
    return error(res, status, status === 404 ? "RECORD_NOT_FOUND" : "LOCAL_API_ERROR", message);
  }
});

server.listen(port, "127.0.0.1", () => console.log(`RightsRail API listening on http://127.0.0.1:${port} (${configuredMode})`));
