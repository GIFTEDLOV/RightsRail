# RightsRail product

RightsRail is a digital rights control plane and forensic media verification
system. Its promise is: **usage rights that understand the use**.

The product binds an issuer's frozen usage policy to the exact media,
context, attribution, and purpose in which a requester proposes to use an
asset. It does not determine copyright ownership or legal infringement.

The local Phase 3 product is intentionally labeled `UNDEPLOYED` and
`CONTROLLED LOCAL QUALIFICATION`. It demonstrates the product model with one
original fictional Lumen Finch asset and four deterministic cases:

| Case | Use | Result | Entitlement |
| --- | --- | --- | --- |
| A | Editorial/newsletter with attribution | `PERMITTED` | payout + permit |
| B | Betting promotion with endorsement implication | `DENIED` | refund |
| C | Missing context evidence | `INCONCLUSIVE` | refund |
| D | Unrelated proposed artifact | `NOT_APPLICABLE` | refund |

The flagship screen is the protected-asset versus proposed-use comparison. It
places provenance facts first, then the seven semantic dimensions, then the
deterministic result.
