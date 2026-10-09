# `RIGHTSRAIL_USAGE_V1`

The semantic result is exactly one JSON object containing exactly seven keys, each with a JSON boolean value:

```json
{
  "asset_match": true,
  "purpose_within_scope": true,
  "prohibited_context_present": false,
  "transformation_within_scope": true,
  "attribution_satisfied": true,
  "endorsement_implied": false,
  "evidence_sufficient": true
}
```

No extra keys, missing keys, strings, numbers, confidence, prose, arbitrary verdict, address, or payment amount are accepted. JSON duplicate keys and non-standard constants are rejected. The parser validates the mapping before any policy result is computed.

## Meaning

- `asset_match`: the proposed artifact is the protected/reference asset for this request.
- `purpose_within_scope`: the described use is within the frozen allowed purpose.
- `prohibited_context_present`: a frozen prohibited context is present.
- `transformation_within_scope`: the transformation is within frozen rules.
- `attribution_satisfied`: the frozen attribution requirement is satisfied.
- `endorsement_implied`: the artifact implies an unauthorized endorsement or recommendation.
- `evidence_sufficient`: the bound evidence is sufficient for a semantic determination.

These are policy-relative semantic questions, not legal conclusions.

## Consensus rule

The leader and every validator independently produce and strictly parse this object. They compare only the seven boolean values. A malformed model result or disagreement causes consensus rejection/rotation. It cannot create an adjudication or any business result.
