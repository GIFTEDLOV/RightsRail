# Phase 3 audit

## Scope and invariants

Phase 3 adds product and read-model layers only. `contracts/rightsrail.py` and
`artifacts/rightsrail.abi.json` remain frozen. No deployment, signing,
broadcast, faucet, or GEN spending is performed.

## Trust boundary

The contract remains authoritative for canonical protocol state. The API and
web app are read-model/product layers. `CONTROLLED_LOCAL` is explicit and
noncanonical; `GENLAYER_CANONICAL` is explicit and unavailable until a
deployed address exists.

## Authority and semantics

The issuer can control only draft policy actions and close-for-future-request
behavior. The UI does not accept or derive a semantic vector or verdict. It
renders the adjudication vector returned by the provider and presents the
deterministic result.

## Evidence and multimodal boundary

The fixture and domain shapes preserve reference/proposed source, SHA-256,
exact bytes, MIME, public context digests, attribution, request ID, policy ID,
policy version, and evidence ID. The contract's two-image maximum remains the
semantic boundary.

## Provider/indexer separation

The controlled fixture provider is persistent and reproducible. The canonical
provider never silently falls back. Every API envelope carries mode,
canonical, chain ID, contract address, source, and timestamp.

## Settlement and delivery

The product displays payout/refund allocation as canonical settlement and
separates future asynchronous delivery states. The local ledger verifies the
40 received = 10 payout + 30 refund conservation fixture. No external
delivery is fabricated.

## Testing and release gates

TypeScript compile, Vitest domain/provider/route tests, Python contract tests,
API readback, Playwright browser flows, responsive overflow checks, keyboard
focus checks, production build, route inventory, fixture/canonical separation,
secret scan, and screenshot inspection are required before the local commit.
