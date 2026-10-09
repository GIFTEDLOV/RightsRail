# Threat model

## Assets to protect

- frozen policy meaning and version;
- request/evidence binding;
- semantic result integrity;
- permit non-transferability across requests or versions;
- exact fee/refund accounting;
- immutable adverse history;
- availability of adjudication after issuer abandonment.

## Threats and controls

| Threat | Control |
| --- | --- |
| Issuer rewrites a policy after a request | `DRAFT`-only edits; freeze is immutable |
| Issuer deletes or replaces adverse evidence | evidence is committed once and journaled |
| Requester supplies booleans | calldata schema contains no semantic fields |
| Model returns prose/confidence/extra keys | exact parser rejects it |
| Leader returns a favorable result and validator copies it | validator independently evaluates and compares the seven booleans |
| Result shopping across generations | first canonical adjudication per request is authoritative |
| Unrelated asset receives a permit | `asset_match` is policy-gated and permit is bound to asset/request/evidence |
| Betting/endorsement context is hidden | bounded context/evidence evaluation exposes context and endorsement booleans to consensus |
| URL or media changes after review | source identifiers, digests, byte lengths, media types, request ID, policy ID/version are committed |
| Permit transfer to another use | permit binds request digest and policy version; no transfer method exists |
| Settlement replay or double pay | one settlement per request, deterministic amount, phase-two journal/idempotency gate required |
| Indexer invents state | canonical state/journal are authoritative; projections are rebuildable |
| Infrastructure failure becomes denial | consensus rejection/rotation is distinct from all four business results |

## Residual risk

Semantic evaluation can be wrong even when consensus agrees. The trust model therefore limits the claim to policy enforcement, keeps evidence provenance visible, and forbids legal conclusions. URL retrieval, vision provider availability, and payment execution need explicit production adapters and fault tests before deployment.
