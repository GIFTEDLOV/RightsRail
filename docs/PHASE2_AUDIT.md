# Phase 2 audit

## Trust boundary

Deterministic state binds IDs, senders, versions, hashes, byte lengths, MIME values, URLs/sources, timestamps, fee values, and transitions. GenLayer consensus handles only the seven semantic booleans. The deterministic policy engine owns the four business results.

## Authority

There is no global owner override. Issuers can edit only their own `DRAFT`, freeze it, and close it for future requests. They cannot mutate frozen policy, evidence, adjudication, permits, or settlement history. Anyone may authenticate evidence, adjudicate, and settle after preconditions pass.

## Semantic parser

`RIGHTSRAIL_USAGE_V1` is exactly seven booleans. Duplicate keys, extra/missing keys, wrong types, prose, markdown, multiple objects, non-standard JSON, nested values, and malformed UTF-8 are rejected. No confidence, prose, address, payment, or arbitrary verdict is accepted.

## Leader validation

The leader loads state-bound evidence, limits semantic media to two images, builds the bounded policy-relative prompt, evaluates, and strict-parses before return. It cannot write a result directly.

## Validator validation

The validator requires `gl.vm.Return`, strict-parses leader output, independently evaluates the same semantic context, strict-parses its own output, and compares only the seven boolean tuple. Malformed output and disagreement reject/rotate consensus.

## Multimodal binding

The reference and proposed sources bind SHA-256, exact length, MIME, source identifier, request ID, policy ID, and policy version. Optional context text/screenshot binds URL and content/screenshot digests. Re-fetch mismatch rejects consensus. No arbitrary unlimited media is passed.

## Evidence authentication

The pipeline is URL -> fetch/capture -> exact byte/content check -> digest comparison -> immutable authentication attempt -> semantic evaluation. It distinguishes `FETCH_FAILED`, `INVALID_CONTENT`, `AUTHENTICATION_FAILED`, and `EVIDENCE_INSUFFICIENT`. Only an authenticated semantic evaluation may produce the last one.

## Policy precedence

`evidence_sufficient=false` is always `INCONCLUSIVE`; otherwise `asset_match=false` is `NOT_APPLICABLE`; otherwise all five permission conditions must pass for `PERMITTED`; all remaining vectors are `DENIED`. Tests cover precedence pairs and every permit condition.

## Payment invariants

The request escrow must equal the frozen fee. `PERMITTED` creates one bound permit and transfers the exact fee to the frozen recipient. Every other terminal result creates no permit and refunds the original requester. The contract rejects wrong recipient/request/version/evidence/generation, duplicate settlement, duplicate permit, and settlement before adjudication. RC5 direct tests qualify these calls with a native-transfer mock; direct gltest does not roll back storage after a deliberately failing mocked transfer, so transaction-level failure atomicity remains a release blocker.

## Replay

Duplicate request digests, evidence, adjudications, permit identities, settlements, refunds, payouts, and generations are rejected. First canonical adjudication is authoritative; there is no result-shopping path.

## One-state-too-early

Every write has an explicit previous-state guard: draft-only edit, draft-only freeze, frozen-only close, frozen-only request, submitted-only evidence, committed/authenticated evidence before adjudication, and adjudicated-only settlement. Tests exercise each operation one state too early.

## Infrastructure/business separation

Malformed model output, missing return wrapper, validator disagreement, fetch failure, invalid content, authentication mismatch, and unavailable runtime are not `INCONCLUSIVE`, `DENIED`, `PERMITTED`, or `NOT_APPLICABLE`. They do not increment generation or create permits. They remain consensus, evidence, or runtime failures for retry/rotation handling.

## Validation record

- Contract: `contracts/rightsrail.py`.
- ABI: `artifacts/rightsrail.abi.json`.
- Public methods: 27 total, 18 reads, 9 writes.
- Runtime header: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`.
- Validation bundle: `GENVM_VERSION=v0.6.0-rc5`, `py-genlayer 0.19.0rc2`, `genlayer-test 0.30.0rc2`, `genvm-linter 0.11.1rc2`, `genlayer CLI 0.40.0-rc.3`.
- Hosted exact-source schema: pass, 27 methods (18 views, 9 writes).
- Local validation/typecheck/schema: pass. Static lint: pass with known RC5 E010 warnings for valid `gl.nondet` helper reachability.
- Final command matrix and direct case counts: `docs/PHASE2_5_AUDIT.md`.
