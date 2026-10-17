import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { semanticDescriptions, semanticLabels, resultTone } from "./api";
import type { EvidenceRecord, PolicyRecord, RequestRecord, SemanticKey, SemanticVector, SettlementRecord } from "@rightsrail/genlayer-client";
import { useLiveStatus } from "./live";

export function Mark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-mark ${compact ? "brand-mark--compact" : ""}`} aria-hidden="true"><span>R</span><i /></span>;
}

export function Brand() {
  return <Link to="/" className="brand"><Mark /><span><strong>RightsRail</strong><small>SEMANTIC RIGHTS INFRASTRUCTURE</small></span></Link>;
}

const nav = [
  ["/app", "Control plane", "⌘"],
  ["/policies", "Policies", "P"],
  ["/requests", "Usage requests", "U"],
  ["/settlements", "Entitlements", "E"],
  ["/activity", "Activity", "A"],
  ["/transactions", "Transactions", "T"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const live = useLiveStatus();
  return <div className="app-frame">
    <header className="topbar"><Brand /><div className="topbar-actions"><span className="network-pill"><span className="signal-dot" /> {live?.deployed ? "STUDIONET 61999" : live ? "CONTROLLED LOCAL" : "CONNECTING"}</span><Link className="topbar-link" to="/integrate">Integrate <span>↗</span></Link><Link className="avatar" to="/app" aria-label="Open operator profile">LF</Link></div></header>
    <div className="app-body">
      <aside className="sidebar"><div className="sidebar-label">Rights control plane</div><nav aria-label="Application navigation">{nav.map(([href, label, glyph]) => <NavLink key={href} to={href} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}><span className="side-glyph">{glyph}</span>{label}</NavLink>)}</nav><div className="sidebar-spacer" /><div className="sidebar-foot"><span className="mini-lock">⌁</span><span><b>{live?.deployed ? "Studionet" : "Local only"}</b><small>{live?.deployed ? "Wallet transactions available" : "No network writes"}</small></span></div></aside>
      <main className="main-content">{children}</main>
    </div>
  </div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-action">{action}</div>}</div>;
}

export function ProvenanceBadge({ compact = false }: { compact?: boolean }) {
  const status = useLiveStatus();
  return <span className={`provenance-badge ${compact ? "compact" : ""}`}><span className="signal-dot" /> {status?.deployed ? "CANONICAL STUDIONET" : status ? "CONTROLLED LOCAL" : "CONNECTING"} <em>·</em> {status?.deployed ? "61999" : status ? "UNDEPLOYED" : "UNVERIFIED"}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge status-${resultTone(value)}`}>{value.replaceAll("_", " ")}</span>;
}

export function LoadingSkeleton({ lines = 4 }: { lines?: number }) {
  return <div className="skeleton-stack" aria-label="Loading"><span className="skeleton skeleton-title" />{Array.from({ length: lines }, (_, i) => <span className="skeleton" key={i} />)}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-card state-error"><div className="state-icon">!</div><div><strong>RightsRail API unavailable</strong><p>{message}</p><Link className="text-link" to="/app">Return to control plane →</Link></div></div>;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <div className="state-card"><div className="state-icon state-icon--muted">○</div><div><strong>{title}</strong><p>{message}</p>{action}</div></div>;
}

export function HashField({ label, value }: { label: string; value: string }) {
  return <div className="hash-field"><span>{label}</span><code title={value}>{value}</code><button type="button" className="copy-button" onClick={() => void navigator.clipboard?.writeText(value)} aria-label={`Copy ${label}`}>copy</button></div>;
}

export function MediaPanel({ title, source, sha, bytes, mime, variant, alt }: { title: string; source: string; sha: string; bytes: number; mime: string; variant: "protected" | "proposed"; alt: string }) {
  return <section className={`media-panel media-${variant}`}><div className="media-heading"><span className="panel-kicker">{variant === "protected" ? "01 / REGISTERED" : "02 / OBSERVED"}</span><strong>{title}</strong></div><div className="media-visual"><img src={source} alt={alt} /><span className="media-corner">{variant === "protected" ? "FROZEN" : "CAPTURED"}</span></div><div className="media-meta"><div><span>source</span><code>{source}</code></div><div><span>media type</span><code>{mime}</code></div><div><span>exact bytes</span><code>{bytes.toLocaleString()}</code></div><div><span>sha-256</span><code>{sha.slice(0, 18)}…</code></div></div></section>;
}

export function EvidenceComparison({ evidence, proposedAlt = "Proposed use" }: { evidence: EvidenceRecord; proposedAlt?: string }) {
  return <div className="comparison-grid"><MediaPanel title="Protected asset" source={evidence.reference_source} sha={evidence.reference_sha256} bytes={evidence.reference_byte_length} mime={evidence.reference_mime} variant="protected" alt="Protected Lumen Finch reference asset" /><div className="comparison-connector" aria-hidden="true"><span>VS</span><i /></div><MediaPanel title="Proposed actual use" source={evidence.proposed_source} sha={evidence.proposed_sha256} bytes={evidence.proposed_byte_length} mime={evidence.proposed_mime} variant="proposed" alt={proposedAlt} /></div>;
}

export function SemanticMatrix({ vector, compact = false }: { vector: SemanticVector; compact?: boolean }) {
  return <div className={`semantic-matrix ${compact ? "semantic-matrix--compact" : ""}`}>{(Object.keys(semanticLabels) as SemanticKey[]).map((key) => <div className={`semantic-row ${vector[key] ? "is-true" : "is-false"}`} key={key}><span className="semantic-symbol">{vector[key] ? "✓" : "×"}</span><div className="semantic-copy"><strong>{semanticLabels[key]}</strong>{!compact && <small>{semanticDescriptions[key]}</small>}</div><span className="semantic-value">{vector[key] ? "TRUE" : "FALSE"}</span></div>)}</div>;
}

export function PolicySummary({ policy }: { policy: PolicyRecord }) {
  return <div className="policy-summary"><div className="summary-head"><div><span className="panel-kicker">FROZEN POLICY / V{policy.version}</span><h3>{policy.policy_id}</h3></div><StatusBadge value={policy.state} /></div><div className="policy-lines"><div><span>Allowed</span><b>{policy.allowed_purposes.join(" · ")}</b></div><div><span>Channels</span><b>{policy.allowed_channels.join(" · ")}</b></div><div><span>Restrictions</span><b>{policy.prohibited_contexts.join(" · ")}</b></div><div><span>Attribution</span><b>{policy.attribution_requirement}</b></div></div></div>;
}

export function SettlementCard({ settlement }: { settlement: SettlementRecord }) {
  return <div className="settlement-card"><div className="settlement-icon">{settlement.settlement_type === "PAYOUT_ALLOCATED" ? "↗" : "↩"}</div><div className="settlement-copy"><div className="card-inline"><strong>{settlement.settlement_type.replaceAll("_", " ")}</strong><StatusBadge value={settlement.delivery_status} /></div><p>{settlement.result === "PERMITTED" ? "Frozen recipient entitlement allocated." : "Requester refund entitlement allocated."}</p><Link className="text-link" to={`/settlements/${settlement.settlement_id}`}>View settlement →</Link></div><strong className="settlement-amount">{settlement.amount} <small>attoGEN</small></strong></div>;
}

export function AuditTimeline({ items }: { items: Array<{ id: string; action: string; subject_id: string; at: string; description: string; severity: string }> }) {
  return <div className="audit-timeline">{items.map((item) => <div className="audit-item" key={item.id}><span className={`audit-dot audit-${item.severity.toLowerCase()}`} /><div><div className="card-inline"><strong>{item.action.replaceAll("_", " ")}</strong><time>{item.at}</time></div><p>{item.description}</p><code>{item.subject_id}</code></div></div>)}</div>;
}

export function DetailLink({ label, href }: { label: string; href: string }) { return <Link className="detail-link" to={href}><span>{label}</span><b>↗</b></Link>; }

export function RequestRow({ request }: { request: RequestRecord }) { return <Link className="data-row" to={`/requests/${request.request_id}`}><span className="row-main"><b>{request.request_id}</b><small>{request.purpose_description}</small></span><StatusBadge value={request.state} /><span className="row-end">{request.entitlement_type.replaceAll("_", " ") || "Awaiting adjudication"}<b>→</b></span></Link>; }
