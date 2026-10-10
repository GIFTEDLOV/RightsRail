# RightsRail V2.3 final submission report

Date: 2026-10-10
Network: GenLayer Studio-dev, chain `61997`
Historical V1 address: `0x984b996079d2591976FcfFb62d0506DF02E0396A`
V2.3 successor address: `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F`

## Verdict

**NO-GO for live qualification, paid-product release, GitHub publication, and Portal submission.**

**Deployment status: PASS.** One authorized V2.3 deployment finalized with successful execution and read-only canonical verification. No qualification write was attempted after deployment because the required public PNG evidence bundle was unavailable at its advertised HTTPS host.

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

No V2.3 policy, request, evidence, adjudication, permit, settlement, withdrawal, or refund transaction was executed. The V2.3 canonical counts remain zero.

Qualification is blocked by the evidence boundary, not by a semantic result. The required PNG URLs currently return HTTP 404:

- `https://rightsrail-evidence.vercel.app/reference.png`
- `https://rightsrail-evidence.vercel.app/proposed-editorial.png`
- `https://rightsrail-evidence.vercel.app/proposed-betting.png`
- `https://rightsrail-evidence.vercel.app/proposed-missing-context.png`
- `https://rightsrail-evidence.vercel.app/unrelated.png`

No fallback to SVG, localhost, fixture-only bytes, or fabricated model output was used. The existing local PNG files are retained with their manifest, but they are not yet suitable for live evidence commits until served publicly and byte-verified.

Local PNG provenance is deterministic and recorded in `provenance/media/png-evidence-manifest.json`: reference `35,344` bytes (`E0D804AB77A13F6F892B564F58656E72BF4DAFF123225B58CB637537B2AAD0C8`), editorial `52,132` bytes (`DA782460A0DE765D49EBCBE4F116CFAB0C42B42D3AEA99E4BFC3763E5B63F223`), betting `48,481` bytes (`BF7799C32A4D8A46F5DEF7C06E39E1926C2E49DF2461B35EA6111026699FEF89`), missing-context `32,221` bytes (`A9F99CCD842E6CE2DD664D0AEA21C94538A3EBA40BF93040AB9FCB0158FE2584`), and unrelated `41,410` bytes (`5D6CFA94971725D3D367A2C18D8CABABD31668B0F3D33ED6D96712D222FB993D`). These are local hashes, not public-host verification.

## Engineering gates

- Official RC5 validate/typecheck/schema: PASS.
- Official lint: only the known E010 diagnostics for nondeterministic calls; no unexpected lint failure.
- Python: 85 passed, 18 subtests; compile pass; Ruff pass; mypy pass.
- TypeScript tests: 13 passed.
- API tests: 2 passed.
- Deployment/fee/reconciliation tests: 11 passed.
- Browser E2E: 28 passed across desktop, tablet, mobile, keyboard, workflows, screenshots, and console-error checks.
- Production web/API build: PASS.
- Contract/source/ABI invariant checks: PASS for the V2.3 deployed candidate and preserved V1 history.

## Economics and cash exit

V2.3 contains canonical `PAYOUT_ALLOCATED` and `REFUND_ALLOCATED` liabilities plus `withdraw_claimable` and `withdraw_refund` paths with one-time settlement binding, frozen-recipient checks, caller authorization, and no automatic retry. Local tests cover wrong claimant, over-withdrawal, duplicate withdrawal, mutually exclusive liabilities, and zero-value handling.

External delivery has not been independently reconciled because no qualification settlement exists. `WITHDRAWAL_EMITTED` must not be reported as `DELIVERED`; failed or unknown external messages require operator reconciliation and are not automatically retried. No funds are claimed to have been delivered.

## Release readiness

- GitHub: not pushed. `gh` credentials are present locally, but the explicit no-publication boundary was respected and no verified remote was configured.
- Vercel: no application deployment was performed.
- GenLayer Portal: not submitted.
- Frontend: local controlled-demo product remains separate from canonical state; no false live qualification labels were introduced.
- Submission package: locally prepared, but not submission-ready until stable public PNG evidence and live qualification readbacks exist.

## Required next actions

1. Publish the five original PNG fixtures on a stable HTTPS evidence host and verify HTTP 200, MIME, exact byte length, and SHA-256 from the public URLs.
2. Obtain explicit authorization for the 20 qualification writes, then use fresh nonce/fee estimation and exact-hash reconciliation for every transaction.
3. Verify the four canonical outcomes without result shopping and independently reconcile entitlement delivery with distinct creator/requester actors.
4. Obtain separate explicit approval before GitHub push, Vercel deployment, or Portal submission.

## Historical provenance

The prior V1 deployment and all prior failed deployment attempts remain immutable in `docs/provenance/`. This report does not relabel or delete them.
