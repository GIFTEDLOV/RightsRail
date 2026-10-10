# Historical steward regression matrix

This matrix is evidence-based. `PASS` means the relevant control is covered
by a local regression and the current candidate behavior was observed. It does
not mean the deployed V1 contract has changed.

| ID | Historical reference | RightsRail control | Evidence / regression | Status |
| --- | --- | --- | --- | --- |
| SR-01 | ClearLC cash-exit correction | Allocated value has a claimant-bound pull path in the local successor candidate; payout and refund paths are mutually typed | `tests/direct/test_economic_settlement_mock.py`, `tests/direct/test_state_machine.py` | FIXED locally; deployed V1 remains without withdrawal |
| SR-02 | PAVEL one-state-too-early evidence gate | Adjudication requires committed evidence, authenticated evidence, exact request binding, and terminal generation | `tests/direct/test_replay_and_preconditions.py`, `tests/adversarial/test_semantic_parser.py` | PASS |
| SR-03 | PALINODE canonical/read-model confusion | Provider mode is explicit; canonical provider never falls back to fixtures; configured canonical address is retained in provenance | `tests/ts/rightsrail.test.ts`, `tests/ts/api-indexer.test.ts` | FIXED locally |
| SR-04 | Chronicle finality/execution confusion | Transaction journal separates finality from execution result and uses same-hash reconciliation | `packages/workflow/rightsrail_workflow/journal.py`, deployment tests | PASS |
| SR-05 | Chronicle timestamp determinism | Candidate `_now()` reads the GenLayer transaction datetime; malformed time fails closed | `tests/direct/test_timestamp_context.py` | FIXED locally; deployed V1 remains historical |
| SR-06 | Semantic result shopping | First successful adjudication is append-only and authoritative; malformed/disagreeing consensus is not a business result | `tests/adversarial/test_semantic_parser.py`, `tests/direct/test_replay_and_preconditions.py` | PASS |
| SR-07 | API test false confidence | API package test command now executes two real local-store tests | `apps/api/src/store.test.ts` | FIXED locally |
| SR-08 | Demo identity fabrication | Controlled fixture identities use explicit `CONTROLLED_LOCAL_*` labels, not wallet-looking placeholders | `apps/api/src/store.ts`, `apps/web/src/main.tsx` | FIXED locally |

## Unsupported claims intentionally rejected

- No all-four live qualification claim exists. The deployed chain remains at
  one frozen policy and zero request/evidence/adjudication/permit/settlement
  records.
- No external GEN delivery is claimed. `WITHDRAWAL_EMITTED` is not delivery
  confirmation.
- The candidate cash-exit path has direct RC5 coverage, but it is not hosted
  or deployed in this audit.
