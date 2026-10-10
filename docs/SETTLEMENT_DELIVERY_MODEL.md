# Settlement and delivery model

RightsRail deliberately separates two events:

```text
SETTLEMENT  = canonical entitlement allocation
WITHDRAWAL  = asynchronous value delivery
```

`settle_request` performs the first event only. It atomically consumes the
request's escrow into one of these canonical ledger entries:

- `PAYOUT_ALLOCATED`: the frozen settlement recipient receives a claimable
  balance and a bound permit exists;
- `REFUND_ALLOCATED`: the original requester receives a refundable balance and
  no permit exists.

There is no external transfer in `settle_request`, so that method does not
claim message delivery or transaction rollback for a value message. The
deployed frozen V1 contract has no withdrawal methods. The local successor
candidate adds `withdraw_claimable` and `withdraw_refund`; these are pull
methods bound to the immutable settlement recipient/requester and exact
settlement amount. They record `WITHDRAWAL_EMITTED`, never `DELIVERED`, and
have no automatic retry path because an unknown external delivery result could
make a retry double-pay.

The future Phase 3 indexer may track a parent settlement transaction, emitted
messages, triggered transaction IDs, external operation, execution result,
recipient, and amount. Its UI states must remain distinct:

```text
ENTITLEMENT_ALLOCATED
WITHDRAWAL_EMITTED
DELIVERY_CONFIRMED
DELIVERY_FAILED_OR_UNKNOWN
```

Only `ENTITLEMENT_ALLOCATED` and the candidate's explicit withdrawal record
are canonical successor state. `DELIVERY_CONFIRMED` remains an off-chain
reconciliation status unless a future contract-verifiable acknowledgement
mechanism is added. The deployed V1 remains allocation-only.
