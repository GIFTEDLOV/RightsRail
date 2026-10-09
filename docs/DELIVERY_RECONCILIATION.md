# Delivery reconciliation

RightsRail's frozen contract settles by internal entitlement allocation. A
future withdrawal or external message is a separate asynchronous delivery
layer.

The off-chain model supports:

`NOT_REQUESTED` -> `ENTITLEMENT_ALLOCATED` -> `WITHDRAWAL_EMITTED` ->
`DELIVERY_CONFIRMED` or `DELIVERY_FAILED_OR_UNKNOWN`.

The current contract does not expose withdrawal methods, so the local product
stops at `ENTITLEMENT_ALLOCATED`. It never labels an entitlement `PAID` or
`DELIVERED` merely because an external message was emitted. Automatic retries
are intentionally absent until authoritative delivery status can prevent
double delivery.
