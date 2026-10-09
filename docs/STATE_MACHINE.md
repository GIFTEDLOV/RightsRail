# State machine

## Policy

```text
DRAFT --issuer freeze--> FROZEN --issuer close--> CLOSED
```

Only `DRAFT` is editable. `CLOSED` stops new requests but does not erase requests, evidence, adjudications, permits, or settlements already committed.

## Request

```text
SUBMITTED --commit evidence--> EVIDENCE_COMMITTED
EVIDENCE_COMMITTED --first canonical adjudication--> ADJUDICATED
ADJUDICATED --deterministic settlement--> SETTLED
```

Requests bind `policy_id` and `policy_version`. Existing requests may finish after their policy is closed. A second evidence commit, second canonical adjudication, or second settlement is rejected.

## Adjudication outcomes

The semantic vector is parsed first. The policy engine then applies this strict precedence:

1. insufficient evidence => `INCONCLUSIVE`;
2. asset mismatch => `NOT_APPLICABLE`;
3. all five positive/negative permission predicates satisfy => `PERMITTED`;
4. otherwise => `DENIED`.

Only `PERMITTED` issues a permit. Every other result refunds the request escrow according to the deterministic settlement rule and creates no permit.

## Failure semantics

Malformed calldata, absent `gl.vm.Return`, malformed leader output, malformed validator output, missing bound state, and semantic disagreement are consensus rejection/rotation conditions. They are not transitions to `INCONCLUSIVE`, `DENIED`, `PERMITTED`, or `NOT_APPLICABLE`.

## Journal discipline

Every state mutation appends a journal entry with a monotonic sequence, action, subject ID, details digest, and timestamp. Historical entries are never overwritten. Phase-two execution must use the journal for crash recovery and idempotent settlement.
