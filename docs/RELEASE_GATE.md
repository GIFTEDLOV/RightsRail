# RightsRail release gate

## Immutable deployed provenance

- Contract: `0x984b996079d2591976FcfFb62d0506DF02E0396A`
- Chain: `61997` Studio-dev
- Frozen V1 source SHA-256:
  `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B`
- Frozen V1 ABI SHA-256:
  `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB`
- Current deployed state: one frozen policy, zero qualification records.
- V2.3 successor: `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F`.
- V2.3 deployment transaction: `0xb72fcde704b994982892a88ef45d51bc2133625c80f5c405f1bf838cced83dde`.
- V2.3 source SHA-256: `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE`.
- V2.3 official ABI SHA-256: `010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B`.
- V2.3 state at deployment readback: zero policies, requests, evidence, adjudications, permits, settlements and accounting allocations.
- Current V2.3 state after the authorized run: one frozen policy; zero requests, evidence, adjudications, permits, settlements, withdrawals, and accounting allocations; audit count `2`.

## Gate checklist

| Gate | Requirement | Current status |
| --- | --- | --- |
| Source/ABI parity | V2.3 source/schema match the deployed successor | PASS, read-only verified |
| Contract safety | Hardened source passed RC5 validate/typecheck/schema and local adversarial gates | PASS locally; live qualification pending |
| Cash exit | Beneficiary payout and requester refund are withdrawable | Candidate/deployment path present; no live settlement exists, so external delivery is unconfirmed |
| Timestamp | Contract uses GenVM transaction datetime | BLOCKED: exact V2.3 payable fee simulation rejects the active-window request; no request broadcast |
| Semantic consensus | Exact seven-key parsing and independent validator | PASS in local direct/adversarial suite |
| Evidence | Two bounded images, immutable digest/byte/MIME binding | PASS for five public PNG fixtures; HTTP 200 and exact local/public bytes and hashes |
| Canonical provider | Reads V2.3 state without fixture fallback | PASS for deployment readback; qualification state is empty |
| Regression suite | Python, TS, API, browser, build, mutation/property gates | PASS locally; no live semantic qualification |
| External publication | GitHub, Vercel, portal submission | GitHub/Portal NOT DONE; evidence-only Vercel host deployed and verified; app deployment not performed |

## Latest V2.3 qualification stop

The authorized run finalized exactly two policy writes (create and freeze),
then stopped before Case A because `sim_estimateTransactionFees` rejected the
exact payable `submit_usage_request` call with `Missing or invalid parameters`.
The request carried all 11 ABI arguments, empty kwargs, and the frozen fee of
10 wei. No request, evidence, adjudication, settlement, withdrawal, or refund
write was broadcast. The exact hashes and stop record are in
`docs/provenance/live-transactions/rightsrail-v23-live-qualification.json` and
`docs/V23_QUALIFICATION_RUN_BLOCKER.md`.

## Stop conditions

Stop on any hash mismatch, unresolved nonce, nonterminal execution status,
semantic infrastructure failure, unknown external delivery status, provider
fallback, or missing canonical readback. A new deployment or live
qualification requires separate explicit authorization.
