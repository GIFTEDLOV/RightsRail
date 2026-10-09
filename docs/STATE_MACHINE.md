# State machine

## Policy

```text
DRAFT --issuer update--> DRAFT
DRAFT --issuer freeze--> FROZEN
FROZEN --issuer close--> CLOSED
```

Only `DRAFT` permits edits. `FROZEN` and `CLOSED` policy records remain readable forever. Closing stops future requests; it does not erase existing requests, evidence, adjudications, permits, settlements, or audit history.

## Request

```text
SUBMITTED --commit once--> EVIDENCE_COMMITTED
EVIDENCE_COMMITTED --first canonical consensus--> ADJUDICATED
ADJUDICATED --one deterministic settlement--> SETTLED
```

Requests bind the frozen `policy_id` and `policy_version`. Duplicate request digests are rejected. A request has one immutable evidence commitment, one canonical adjudication generation, one permit at most, and one settlement at most.

## Evidence authentication

```text
COMMITTED --authenticated fetch/capture--> AUTHENTICATED
COMMITTED --transport error--> FETCH_FAILED --retry allowed--> COMMITTED attempt
COMMITTED --bad content--> INVALID_CONTENT
COMMITTED --digest/authority mismatch--> AUTHENTICATION_FAILED
```

Only `FETCH_FAILED` is retryable. `INVALID_CONTENT` and `AUTHENTICATION_FAILED` are terminal evidence outcomes. None is silently converted into a semantic business result. Adjudication requires `AUTHENTICATED`.

## Result precedence

```text
evidence_sufficient == false -> INCONCLUSIVE
else asset_match == false -> NOT_APPLICABLE
else all five permission predicates pass -> PERMITTED
else -> DENIED
```

Only `PERMITTED` issues a permit and allocates the frozen licensing fee to the
frozen recipient's claimable balance. The other three outcomes create no permit
and allocate the exact escrow to the original requester's refundable balance.
Settlement is canonical entitlement allocation, not external delivery.

## One-state-too-early audit

| Operation | Required previous state | Earlier state rejected |
| --- | --- | --- |
| update policy | `DRAFT`, issuer sender | `FROZEN`/`CLOSED` or wrong sender |
| freeze policy | `DRAFT`, issuer sender | already frozen/closed or wrong sender |
| close policy | `FROZEN`, issuer sender | `DRAFT`/`CLOSED` or wrong sender |
| submit request | `FROZEN`, exact version and fee | `DRAFT`/`CLOSED`, wrong fee/version |
| commit evidence | `SUBMITTED`, exact request/policy bindings | any other request state |
| authenticate evidence | committed evidence; only failed transport retry | missing/terminal auth |
| adjudicate | `EVIDENCE_COMMITTED`, authenticated evidence, no prior adjudication | submitted/settled/duplicate |
| settle | `ADJUDICATED`, matching generation/version | before final adjudication or duplicate |

The same table is exercised by `tests/direct/test_replay_and_preconditions.py` and the mutation-kill matrix.
