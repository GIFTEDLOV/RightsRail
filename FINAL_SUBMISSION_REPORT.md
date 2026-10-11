# RightsRail V2.3 final submission report

Date: 2026-10-11
Network: GenLayer Studio-dev, chain `61997`
Historical V1 address: `0x984b996079d2591976FcfFb62d0506DF02E0396A`
V2.3 successor address: `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F`

## Verdict

**NO-GO for live qualification, paid-product release, GitHub publication, and Portal submission.**

**Deployment status: PASS.** One authorized V2.3 deployment finalized with successful execution and read-only canonical verification. The five original PNG fixtures are now publicly served and byte-verified. The authorized qualification run performed exactly two policy writes, then stopped before Case A because Studio-dev fee simulation rejected the exact payable request.

The claimed V2.4 candidate was not present in the workspace, repository
history, or available source archives inspected on 2026-10-11. The live schema
has no `get_audit_events` method. The authoritative-source reconciliation is in
`docs/SOURCE_PROVENANCE_RECONCILIATION.md`; no speculative V2.4 ABI or client
surface was added.

## Canonical deployment proof

- Deployment transaction: `0xb72fcde704b994982892a88ef45d51bc2133625c80f5c405f1bf838cced83dde`
- Status: `FINALIZED / FINISHED_WITH_RETURN`
- Sender: `0x33653e6e86807e41682d3346cdf648d6653384b1`
- Nonce: `67`; post-deployment latest/pending nonce: `68 / 68`
- Runner: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- Source SHA-256: `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE`
- Official ABI SHA-256: `010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B`
- Public surface: 35 methods, 23 reads, 12 writes
- Schema: `RIGHTSRAIL_USAGE_V1`, exact seven-key semantic schema verified
- Initial state: all collections and accounting allocations zero

The historical V1 source/ABI hashes remain unchanged in provenance. The V2.3 source is a successor candidate and must not be represented as the V1 deployment.

## Qualification status

The authorized run created and froze one V2.3 policy. Both transactions finalized with `FINISHED_WITH_RETURN`:

- create: `0xc2146e5b63248820fa520008f27581877358cb77c86410ebdcaa211fcb735b94`
- freeze: `0xf1b4106147bc3f7c4e45ac0f68958b84b65e3600fa2fb5c8b4ab6f1bfa77f001`

No V2.3 request, evidence, adjudication, permit, settlement, withdrawal, or refund transaction was executed. Canonical counts are one frozen policy and zero records in each of those later collections.

The public PNG evidence boundary is now verified:

- `https://rightsrail-evidence.vercel.app/reference.png` — HTTP 200, 35,344 bytes, `E0D804AB77A13F6F892B564F58656E72BF4DAFF123225B58CB637537B2AAD0C8`
- `https://rightsrail-evidence.vercel.app/proposed-editorial.png` — HTTP 200, 52,132 bytes, `DA782460A0DE765D49EBCBE4F116CFAB0C42B42D3AEA99E4BFC3763E5B63F223`
- `https://rightsrail-evidence.vercel.app/proposed-betting.png` — HTTP 200, 48,481 bytes, `BF7799C32A4D8A46F5DEF7C06E39E1926C2E49DF2461B35EA6111026699FEF89`
- `https://rightsrail-evidence.vercel.app/proposed-missing-context.png` — HTTP 200, 32,221 bytes, `A9F99CCD842E6CE2DD664D0AEA21C94538A3EBA40BF93040AB9FCB0158FE2584`
- `https://rightsrail-evidence.vercel.app/unrelated.png` — HTTP 200, 41,410 bytes, `5D6CFA94971725D3D367A2C18D8CABABD31668B0F3D33ED6D96712D222FB993D`

Manifest: `https://rightsrail-evidence.vercel.app/manifest.json`, HTTP 200, 2,076 bytes, SHA-256 `A6AA797FE9439CDEF689F65F8F6BCFA98BB1EC0C502E6F59EE0B2F0083D9A863`. No fallback to SVG, localhost, fixture-only bytes, or fabricated model output was used.

The historical qualification blocker was runtime-side: the exact Case A payable write (`submit_usage_request`, 11 ABI arguments, empty kwargs, `value=10` wei) failed both `sim_call` and `sim_estimateTransactionFees` when no explicit GenVM datetime context was supplied. The deepest available result decoded to `[EXPECTED] policy is outside its validity window`, despite canonical chain time being inside the stored policy window. A current read-only probe using the documented datetime context now makes both the exact payable `sim_call` and fee estimate succeed; it does not authorize a write or create a business result. The original request/response artifact remains `docs/provenance/simulations/v23-case-a-simulation.json`; the new probe is `docs/provenance/simulations/gltest-studio-timestamp-probe.json`.

The current read-only gate was rerun on 2026-10-11. All five public PNGs
again matched HTTP 200, MIME, byte-length, and SHA-256 expectations. The
deployed source hash again matched local V2.3 source `E22EF2CC...`; the schema
again reported 35 methods (23 reads / 12 writes) and no `get_audit_events`.
The complete gate is in `docs/STUDIO_DEV_READONLY_GATE.md`.

An isolated localhost GLSim probe was added using the documented
`sim_config.genvm_datetime` transaction context. GLSim started after the
project-local server dependencies were installed, but exact V2.3 deployment
stopped before contract initialization because the local RC5 bundle does not
contain the pinned `py-genlayer:5jyc...` runner. The supported direct RC5 suite
passes the active-window boundary cases. A separate hosted no-write probe now
passes with explicit datetime context while confirming canonical state is
unchanged. The support reproduction is
`docs/provenance/GENLAYER_SUPPORT_V23_TIMESTAMP_REPRO.md`.

Local and public PNG provenance is recorded in `provenance/media/png-evidence-manifest.json` and `provenance/media/live-png-manifest.json`.

## Engineering gates

- Official RC5 validate/typecheck: PASS; deployed hosted schema readback: PASS; local `genvm-lint schema`: BLOCKED by E101 because the pinned RC5 runner is absent from the local cache.
- Official lint: only the known E010 diagnostics for nondeterministic calls; no unexpected lint failure.
- Python: 85 passed, 18 subtests; compile pass; Ruff pass; mypy pass.
- TypeScript tests: 13 passed.
- API tests: 2 passed.
- Deployment/fee/reconciliation and Case A simulation-forensics tests: 14 passed.
- Direct timestamp boundary tests: 2 passed; exact V2.3 GLSim probe: blocked before initialization by missing pinned RC5 runner.
- Browser E2E: 28 passed across desktop, tablet, mobile, keyboard, workflows, screenshots, and console-error checks.
- Production web/API build: PASS.
- Contract/source/ABI invariant checks: PASS for the V2.3 deployed candidate and preserved V1 history.

## Economics and cash exit

V2.3 contains canonical `PAYOUT_ALLOCATED` and `REFUND_ALLOCATED` liabilities plus `withdraw_claimable` and `withdraw_refund` paths with one-time settlement binding, frozen-recipient checks, caller authorization, and no automatic retry. Local tests cover wrong claimant, over-withdrawal, duplicate withdrawal, mutually exclusive liabilities, and zero-value handling.

External delivery has not been independently reconciled because no qualification settlement exists. `WITHDRAWAL_EMITTED` must not be reported as `DELIVERED`; failed or unknown external messages require operator reconciliation and are not automatically retried. No funds are claimed to have been delivered.

## Release readiness

- GitHub: not pushed. The qualification blocker prevents a defensible release; no verified RightsRail remote was configured.
- Vercel: no application deployment was performed.
- GenLayer Portal: not submitted.
- Frontend: local controlled-demo product remains separate from canonical state; no false live qualification labels were introduced.
- Submission package: locally prepared, but not submission-ready until the simulator/runtime blocker is resolved and live qualification plus delivery readbacks exist.

## Required next actions

1. Supply the exact V2.4 candidate source and generated ABI if V2.4 integration is required; do not infer it from the V2.3 deployment.
2. Carry the tested explicit Studio-dev datetime context into the qualification runner and obtain fresh explicit authorization before any write; do not treat the read-only simulation as qualification.
3. Run the remaining qualification writes with exact-hash reconciliation only after authorization.
4. Verify the four canonical outcomes and independently reconcile entitlement delivery with distinct creator/requester actors.
5. Obtain separate publication approval before GitHub push or Portal submission; the evidence-only Vercel host is already live.

## Historical provenance

The prior V1 deployment and all prior failed deployment attempts remain immutable in `docs/provenance/`. This report does not relabel or delete them.
