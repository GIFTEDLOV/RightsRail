# Economic model

## Frozen fee binding

`required_fee_wei` and `settlement_recipient` are frozen policy fields. A payable request must carry exactly the frozen fee. The model never selects an amount, recipient, or refund destination.

## Terminal settlement

Settlement is allowed only after a canonical adjudication and exact request/policy-version/generation checks.

| Result | Permit | Recipient | Amount |
| --- | --- | --- | --- |
| `PERMITTED` | one bound permit | frozen settlement recipient | exact frozen fee |
| `DENIED` | none | original requester | exact escrow refund |
| `INCONCLUSIVE` | none | original requester | exact escrow refund |
| `NOT_APPLICABLE` | none | original requester | exact escrow refund |

The contract records one settlement ID per request. A permitted settlement creates a permit whose binding includes request, request digest, evidence hash, adjudication ID, generation, policy version, fee, recipient, and expiry. Native transfer is attempted after all deterministic writes; a runtime revert must revert the transaction rather than leave a canonical permit with an unpaid settlement.

## Invariants

- escrow equals the frozen required fee;
- a request settles at most once;
- a request receives at most one permit;
- a payout can target only the frozen recipient;
- a refund can target only the original requester;
- settlement cannot precede terminal adjudication;
- fee, recipient, request, policy version, evidence hash, and generation cannot be substituted at settlement.

The local deterministic reference model and mutation tests cover the state guards. Full native-value execution remains a runtime-harness integration gate.
