import { useEffect, useState } from "react";
import type { createClient as CreateClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { AppShell, PageHeader, ProvenanceBadge } from "./components";
import { useLiveStatus } from "./live";

type Schema = { methods: Record<string, { readonly: boolean; payable?: boolean; params: Array<[string, unknown]> }> };
type Provider = NonNullable<NonNullable<Parameters<typeof CreateClient>[0]>["provider"]>;
type Journal = { method: string; state: string; hash?: `0x${string}`; error?: string; receipt?: unknown };

export function executionResult(tx: unknown): string | null {
  const value = tx as { txExecutionResultName?: string; consensus_data?: { leader_receipt?: Array<{ vote?: string | null; result?: { status?: string }; execution_result?: string; genvm_result?: { raw_error?: unknown } }> } };
  if (value.txExecutionResultName) return value.txExecutionResultName;
  const leaders = value.consensus_data?.leader_receipt;
  const leader = leaders?.find((item) => item.vote == null) ?? leaders?.[0];
  if (leader?.result?.status === "return" && leader.execution_result === "SUCCESS" && !leader.genvm_result?.raw_error) return "FINISHED_WITH_RETURN";
  if (["error", "user_error", "contract_error"].includes(leader?.result?.status ?? "") && leader?.execution_result === "ERROR") return "FINISHED_WITH_ERROR";
  return null;
}

function argument(type: unknown, text: string): unknown {
  if (typeof type === "string" && /^(u?int\d*|u256|i256)$/.test(type)) return BigInt(text);
  if (type === "string" || type === "address") return text;
  return JSON.parse(text) as unknown;
}

export function TransactionComposer({ initialMethod = "submit_usage_request" }: { initialMethod?: string }) {
  const status = useLiveStatus();
  const [schema, setSchema] = useState<Schema | null>(null);
  const [method, setMethod] = useState(initialMethod);
  const [values, setValues] = useState<Record<string, string>>({});
  const [value, setValue] = useState("0");
  const [journal, setJournal] = useState<Journal | null>(null);
  const [pollVersion, setPollVersion] = useState(0);
  const key = `rightsrail.transaction.${status?.contractAddress ?? "unconfigured"}`;
  const persist = (next: Journal) => { localStorage.setItem(key, JSON.stringify(next)); setJournal(next); };
  useEffect(() => {
    let active = true;
    void fetch("/release/rightsrail.abi.json").then((res) => { if (!res.ok) throw new Error("ABI unavailable"); return res.json() as Promise<Schema>; }).then((data) => { if (active) setSchema(data); }).catch((error: unknown) => { if (active) setJournal({ method: initialMethod, state: "ERROR", error: String(error) }); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved) { try { setJournal(JSON.parse(saved) as Journal); } catch { setJournal({ method, state: "ERROR", error: "Stored transaction journal is invalid." }); } }
  }, [key]);
  useEffect(() => {
    if (!journal?.hash || ["CANONICAL_READBACK", "ERROR"].includes(journal.state)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const hash = journal.hash;
    const submittedMethod = journal.method;
    const started = Date.now();
    const poll = async () => {
      try {
        const { createClient } = await import("genlayer-js");
        const client = createClient({ chain: studionet });
        const receipt = await client.getTransaction({ hash: hash as Parameters<typeof client.getTransaction>[0]["hash"] });
        if (!active) return;
        const stage = receipt.statusName ?? String(receipt.status);
        const result = executionResult(receipt);
        if (stage === "FINALIZED") {
          if (result !== "FINISHED_WITH_RETURN") { persist({ method: submittedMethod, hash, state: "ERROR", error: `Finalized execution: ${result ?? "unverified result"}`, receipt }); return; }
          persist({ method: submittedMethod, hash, state: "EXECUTION_RESULT_CHECK", receipt });
          const refresh = await fetch("/api/refresh", { method: "POST" });
          if (!refresh.ok) throw new Error("Execution succeeded; canonical refresh failed. Resume this receipt to refresh.");
          // A successful API read verifies that the refreshed canonical state is available.
          const readback = await fetch("/api/status");
          if (!readback.ok) throw new Error("Execution succeeded; canonical readback is pending.");
          persist({ method: submittedMethod, hash, state: "CANONICAL_READBACK", receipt });
          window.dispatchEvent(new Event("rightsrail-confirmed"));
          return;
        }
        if (["CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(stage)) { persist({ method: submittedMethod, hash, state: "ERROR", error: `Transaction ended: ${stage}`, receipt }); return; }
        persist({ method: submittedMethod, hash, state: stage === "ACCEPTED" ? "ACCEPTED" : "PENDING", receipt });
      } catch (error) {
        if (active) persist({ method: submittedMethod, hash, state: "PENDING", error: String(error) });
      }
      if (active && Date.now() - started < 40 * 60_000) timer = setTimeout(() => { void poll(); }, 15000);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [journal?.hash, pollVersion]);

  const selected = schema?.methods[method];
  const pending = journal && !["ERROR", "CANONICAL_READBACK", "REJECTED"].includes(journal.state);
  async function submit() {
    if (!status?.deployed || !status.contractAddress || !selected) return;
    const provider = (window as Window & { ethereum?: Provider }).ethereum;
    if (!provider) { setJournal({ method, state: "REJECTED", error: "Connect a browser wallet to sign a Studionet transaction." }); return; }
    let signed = false;
    try {
      const args = selected.params.map(([name, type]) => argument(type, values[name] ?? ""));
      const escrow = selected.payable ? BigInt(value) : 0n;
      if (escrow < 0n) throw new Error("Escrow cannot be negative.");
      persist({ method, state: "AWAITING_WALLET" });
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      if (!accounts[0]) throw new Error("Wallet returned no account.");
      const chain = await provider.request({ method: "eth_chainId" });
      if (Number(BigInt(String(chain))) !== studionet.id) {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xf22f" }] });
      }
      const confirmedChain = await provider.request({ method: "eth_chainId" });
      if (Number(BigInt(String(confirmedChain))) !== 61999) throw new Error("Wallet must use Studionet chain 61999.");
      const { createClient } = await import("genlayer-js");
      const client = createClient({ chain: studionet, account: accounts[0] as `0x${string}`, provider });
      signed = true;
      const hash = await client.writeContract({ address: status.contractAddress as `0x${string}`, functionName: method, args: args as never[], value: escrow });
      persist({ method, state: "BROADCAST", hash: hash as `0x${string}` });
    } catch (error) {
      const rejected = (error as { code?: number }).code === 4001 || /user rejected|denied transaction signature/i.test(String(error));
      persist({ method, state: signed && !rejected ? "UNCERTAIN" : "REJECTED", error: `${String(error)}${signed && !rejected ? " Check your wallet and nonce before any further submission; no retry was sent." : ""}` });
    }
  }
  return <section className="panel panel-pad" style={{ maxWidth: 1000 }}>
    <div className="panel-kicker">Studionet transaction</div>
    <h2>Review and sign</h2>
    <p>Studionet · chain 61999 · gasless protocol execution. Payable escrow is entered in attoGEN (10¹⁸ attoGEN = 1 GEN). Your wallet signs each write.</p>
    <code style={{ overflowWrap: "anywhere" }}>{status?.contractAddress ?? "Waiting for verified deployment configuration"}</code>
    <div className="form-grid" style={{ marginTop: 20 }}>
      <div className="field full"><label htmlFor="transaction-method">Contract method</label><select id="transaction-method" value={method} disabled={!!pending} onChange={(event) => { setMethod(event.target.value); setValues({}); }}>{Object.entries(schema?.methods ?? {}).filter(([, definition]) => !definition.readonly).map(([name]) => <option key={name}>{name}</option>)}</select></div>
      {selected?.params.map(([name, type]) => <div className="field full" key={`${method}-${name}`}><label htmlFor={`arg-${name}`}>{name} ({typeof type === "string" ? type : "JSON"})</label><input id={`arg-${name}`} value={values[name] ?? ""} disabled={!!pending} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} /></div>)}
      {selected?.payable && <div className="field full"><label htmlFor="escrow-value">Escrow (attoGEN)</label><input id="escrow-value" inputMode="numeric" value={value} disabled={!!pending} onChange={(event) => setValue(event.target.value)} /></div>}
    </div>
    <button className="button button-dark" type="button" disabled={!status?.deployed || !!pending || !schema} onClick={() => { void submit(); }}>Review in wallet and sign</button>
    {journal && <div role="status" aria-live="polite" className="review-box" style={{ marginTop: 20, overflowWrap: "anywhere" }}><strong>{journal.method}: {journal.state}</strong>{journal.hash && <p><a href={`https://explorer-studio.genlayer.com/transactions/${journal.hash}`} target="_blank" rel="noreferrer">{journal.hash}</a></p>}{journal.error && <p role="alert">{journal.error}</p>}{journal.hash && journal.state !== "CANONICAL_READBACK" && <button type="button" onClick={() => setPollVersion((version) => version + 1)}>Resume this receipt</button>}</div>}
  </section>;
}

export function Transactions() {
  return <AppShell><PageHeader eyebrow="Live application" title="Contract transactions" description="Submit a reviewed write, follow consensus to finality, and refresh canonical state after confirmed execution." action={<ProvenanceBadge />} /><TransactionComposer /></AppShell>;
}
