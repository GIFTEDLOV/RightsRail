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

The request escrow must equal the frozen fee. `PERMITTED` creates one bound permit and transfers the exact fee to the frozen recipient. Every other terminal result creates no permit and refunds the original requester. The contract rejects wrong recipient/request/version/evidence/generation, duplicate settlement, duplicate permit, and settlement before adjudication. Full native-value execution is pending a working direct GenVM harness.

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
- Runtime header: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- Validation bundle: `GENVM_VERSION=v0.2.16`, `py-genlayer 0.19.0rc2`, `genlayer-test 0.30.0rc2`, `genvm-linter 0.11.0`.
- `genvm-lint lint`, `validate`, `typecheck --all`, and `schema`: pass.
- Project gates: pytest 40 passed with 18 property subtests; Ruff pass; mypy pass; Python compile pass.

The installed Windows `gltest` direct runner was also tested against known-good local contracts and fails before execution while decoding file-descriptor calldata. The repository therefore reports static contract-surface tests as direct checks and does not claim a false end-to-end GenVM execution pass.
