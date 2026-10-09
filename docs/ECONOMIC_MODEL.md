# Economic model

## Frozen fee binding

`required_fee_wei` and `settlement_recipient` are frozen policy fields. A
payable request must carry exactly the frozen fee. The semantic evaluator never
selects an amount, recipient, or refund destination.

## Terminal settlement and entitlement allocation

Settlement is allowed only after a canonical adjudication and exact
request/policy-version/generation/evidence checks.

| Result | Permit | Entitlement recipient | Amount |
| --- | --- | --- | --- |
| `PERMITTED` | one bound permit | frozen settlement recipient | exact frozen fee |
| `DENIED` | none | original requester | exact escrow |
| `INCONCLUSIVE` | none | original requester | exact escrow |
| `NOT_APPLICABLE` | none | original requester | exact escrow |

`settle_request` performs no external value transfer. It consumes the request
escrow and allocates exactly one internal entitlement in canonical GenVM state.
The permitted recipient receives a claimable balance; every other result
receives a refundable balance for the requester.

The conservation equation is:

```text
total_escrow_received
== total_escrowed
 + total_payout_allocated
 + total_refund_allocated
 - total_withdrawal_emitted
```

`total_withdrawal_emitted` remains zero because RightsRail does not expose a
withdrawal method in this phase. An external message is never treated as
delivered merely because it was emitted.

## Invariants

- escrow equals the frozen required fee;
- a request settles at most once;
- a request receives at most one permit;
- a request cannot receive both payout and refund entitlements;
- a payout can target only the frozen recipient;
- a refund can target only the original requester;
- settlement cannot precede terminal adjudication;
- fee, recipient, request, policy version, evidence hash, and generation cannot be substituted at settlement;
- settled request escrow is zero;
- `escrow_received` preserves the historical input while live `escrowed_value` is zero after settlement;
- aggregate counters equal the sum of request-level allocations.

The local deterministic reference model, direct tests, property tests, and
mutation tests cover these accounting and state guards.

## Phase 3 product boundary

The web/API product renders this ledger as a read model only. `ENTITLEMENT_ALLOCATED`
is the current terminal delivery state because the frozen contract has no
withdrawal method. Product copy must not call this state paid, delivered, or
complete.
