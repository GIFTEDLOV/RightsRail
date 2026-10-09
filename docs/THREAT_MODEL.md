# Threat model

## Protected assets

- frozen policy meaning, version, and fee/recipient;
- request/evidence identity and byte bindings;
- semantic result integrity;
- permit non-transferability;
- exact escrow/refund/transfer accounting;
- immutable adverse history;
- availability of adjudication after issuer abandonment.

## Controls

| Threat | Control |
| --- | --- |
| issuer rewrites a frozen policy | edits require issuer sender and `DRAFT` |
| issuer removes adverse evidence | evidence commit is one-shot and append-only |
| requester supplies favorable booleans | no semantic fields exist in request calldata |
| model emits prose/confidence/verdict | exact seven-key parser rejects it |
| leader and validator copy the same error | validator independently evaluates the same bound context |
| requester shops generations | one adjudication per request; generation increments exactly once |
| unrelated image receives a permit | asset digest/bytes/MIME binding plus `asset_match` |
| hidden betting or endorsement context | bounded context/image evidence and explicit semantic booleans |
| URL changes after review | source identifiers, digests, lengths, MIME, and context bindings |
| permit is reused for another request | permit binds request ID, request digest, evidence hash, policy version, and generation |
| fee or recipient changes after request | frozen policy binding and settlement checks |
| double settlement or payout | one settlement per request and one permit per request |
| indexer fabricates state | canonical storage and audit records are authoritative |
| fetch/runtime failure becomes denial | failure statuses remain outside the four business results |

## Residual risk

Consensus agreement does not prove semantic truth. RightsRail narrows the claim to frozen-policy enforcement and preserves the evidence facts used. External fetch behavior, vision provider availability, native-value execution, and crash recovery require further integration tests before deployment.
