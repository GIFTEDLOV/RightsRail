# RightsRail release gate

## Immutable deployed provenance

- Contract: `0x984b996079d2591976FcfFb62d0506DF02E0396A`
- Chain: `61997` Studio-dev
- Frozen V1 source SHA-256:
  `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B`
- Frozen V1 ABI SHA-256:
  `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB`
- Current deployed state: one frozen policy, zero qualification records.
- Local successor candidate source SHA-256:
  `CEC17DF5D0D096591706B9547349DC870CE20C9276C9BCA2B0270204FDD29F0F`.
- Local successor candidate ABI SHA-256:
  `E7FC1AB9E0EC3BC20BB06C992318F300000B1F617FA6F8977F0DEEF2B688F805`.

## Gate checklist

| Gate | Requirement | Current status |
| --- | --- | --- |
| Source/ABI parity | Hashes match the historical deployment | PASS for V1 history; local candidate is a different release |
| Contract safety | No unreviewed source mutation | PASS for deployed V1; candidate changes documented |
| Cash exit | Beneficiary payout and requester refund are withdrawable | BLOCKED for deployed V1; candidate fixed locally |
| Timestamp | GenVM time is deterministic and simulation-compatible | BLOCKED for V1 live qualification; candidate uses transaction datetime |
| Semantic consensus | Exact seven-key parsing and independent validator | PASS in local direct/adversarial suite |
| Evidence | Two bounded images, immutable digest/byte/MIME binding | PASS locally; hosted candidate qualification pending |
| Canonical provider | Reads contract state without fixture fallback | BLOCKED; adapter intentionally fails closed |
| Regression suite | Python, TS, API, browser, build, mutation/property gates | Must be rerun at final candidate hash |
| External publication | GitHub, Vercel, portal submission | NOT AUTHORIZED / NOT DONE |

## Stop conditions

Stop on any hash mismatch, unresolved nonce, nonterminal execution status,
semantic infrastructure failure, unknown external delivery status, provider
fallback, or missing canonical readback. A new deployment or live
qualification requires separate explicit authorization.
