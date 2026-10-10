# Delivery reconciliation

RightsRail's frozen contract settles by internal entitlement allocation. A
future withdrawal or external message is a separate asynchronous delivery
layer.

The off-chain model supports:

`NOT_REQUESTED` -> `ENTITLEMENT_ALLOCATED` -> `WITHDRAWAL_EMITTED` ->
`DELIVERY_CONFIRMED` or `DELIVERY_FAILED_OR_UNKNOWN`.

The deployed V1 contract does not expose withdrawal methods, so the current
canonical product stops at `ENTITLEMENT_ALLOCATED`. The local successor
candidate exposes claimant-bound withdrawal preparation, but it still stops
at `WITHDRAWAL_EMITTED` until an external delivery result is independently
reconciled. No state is labeled `PAID` or `DELIVERED` merely because a message
was emitted. Automatic retries are intentionally absent until authoritative
delivery status can prevent double delivery.
