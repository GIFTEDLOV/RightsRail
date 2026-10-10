# Economic security audit

## Scope

The deployed V1 contract at `0x984b996079d2591976FcfFb62d0506DF02E0396A`
supports settlement as internal entitlement allocation only. It has no cash
exit. The local successor candidate adds claimant-bound withdrawal methods,
but has not been deployed and must not be represented as the deployed ABI.

## Findings

| ID | Severity | Affected surface | Evidence / reproducer | Resolution | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ECON-001 | CRITICAL | V1 `settle_request` / cash custody | A permitted request increments `claimable_by_address`, but V1 exposes no withdrawal method; funded liability cannot leave the contract | Added candidate `withdraw_claimable` and `withdraw_refund` with exact settlement binding, caller authorization, one-time consumption, liability counters, and native recipient emission | `tests/direct/test_economic_settlement_mock.py` | FIXED locally; deployed V1 remains a release blocker for paid production |
| ECON-002 | HIGH | Accounting | Allocation counters alone cannot distinguish outstanding liabilities from released value | Candidate tracks `total_*_outstanding` and uses `received = escrowed + outstanding liabilities + emitted` | economic mock tests and state-machine tests | FIXED locally |
| ECON-003 | HIGH | Withdrawal delivery status | An emitted external message is not independently confirmed delivery | Candidate records `WITHDRAWAL_EMITTED` and `delivery_confirmation=NOT_AVAILABLE`; no automatic retry is exposed | withdrawal tests | MITIGATED; external reconciliation still required |
| ECON-004 | HIGH | Actor separation | Same-address demo qualification does not prove recipient authorization | Domain and direct tests use distinct requester, issuer, and recipient actors; wrong claimant fails | `tests/direct/test_state_machine.py`, `tests/direct/test_economic_settlement_mock.py` | FIXED locally |
| ECON-005 | MEDIUM | Zero-value entitlements | Zero fee could underflow or fabricate a transfer | Candidate records `ZERO_VALUE_NO_TRANSFER` and leaves balances at zero | zero-fee direct test | FIXED locally |

## Candidate invariants

```text
total_escrow_received
  = total_escrowed
  + total_claimable_outstanding
  + total_refundable_outstanding
  + total_withdrawal_emitted
```

`total_payout_allocated` and `total_refund_allocated` are cumulative historical
allocation counters; the outstanding counters are the current liabilities.
The contract and domain model reject double settlement, dual entitlement,
wrong claimant, wrong entitlement type, overdraw, and withdrawal replay.

## Remaining economic blocker

The successor withdrawal path has passed the local direct harness, including
actual `NativeRecipient(...).emit_transfer` execution with funded local
contract balance. GenLayer message delivery remains asynchronous, and this
audit has not produced an independent hosted delivery acknowledgment. A
positive-value production release therefore remains blocked until a separately
authorized successor deployment and delivery reconciliation qualification.
