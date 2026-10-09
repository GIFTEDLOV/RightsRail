# `RIGHTSRAIL_USAGE_V1`

The model output is exactly one JSON object with exactly these seven keys and JSON boolean values:

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

The parser rejects missing or extra keys, duplicate keys, strings such as `"true"`, integers such as `0`/`1`, `null`, nested values, markdown fencing, leading or trailing prose, multiple objects, malformed JSON, non-standard JSON constants, and invalid UTF-8 bytes.

## Question boundary

- `asset_match`: does the proposed artifact match the protected reference asset?
- `purpose_within_scope`: is the requested purpose inside the frozen allowed purposes?
- `prohibited_context_present`: is a frozen prohibited purpose or context present?
- `transformation_within_scope`: are the observed/requested changes inside the frozen transformation rules?
- `attribution_satisfied`: is the frozen attribution requirement satisfied?
- `endorsement_implied`: does the use imply an unauthorized endorsement or recommendation?
- `evidence_sufficient`: is the authenticated evidence sufficient to answer the questions?

These are policy-relative semantic questions, not legal conclusions. The evaluator cannot decide ownership, copyright law, damages, fees, recipient, refund, or the final result.

## Consensus handling

Leader and validator outputs are independently parsed. The validator compares only the ordered seven-boolean tuple. Post-consensus parsing happens before any state mutation. Malformed output or disagreement rejects/rotates consensus and cannot create a business result.
