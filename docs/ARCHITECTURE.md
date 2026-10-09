# RightsRail architecture

## Boundary

RightsRail enforces a frozen issuer policy. It does not determine copyright ownership, title, legal infringement, or any other legal conclusion. The product answer is narrower: does a proposed use satisfy the permission policy that was registered and frozen for this asset version?

## Monorepo boundaries

- `contracts/rightsrail.py` is the GenLayer-facing public contract adapter.
- `packages/domain` owns canonical records, state transitions, append-only history, permit binding, and settlement intent.
- `packages/shared` owns canonical serialization and SHA-256 helpers.
- `packages/evidence` owns evidence-binding validation without storing large media blobs.
- `packages/media-analysis` is the bounded multimodal boundary: at most a protected/reference image and a proposed-use artifact or webpage screenshot.
- `packages/policy-engine` parses the exact semantic vector and applies the deterministic result policy.
- `packages/genlayer-client` contains the custom leader/validator consensus seam.
- `packages/indexer` will create read models only; it cannot become a second source of truth.
- `packages/workflow` will own crash-safe orchestration and journal replay.
- `apps/web` and `apps/api` are phase-two product shells.

## Adjudication flow

1. An issuer creates a `DRAFT` policy and may edit it only while draft.
2. The issuer freezes the policy. The version and all permission fields become immutable.
3. A requester submits a request against the exact frozen policy version and escrows the exact required fee.
4. Evidence is authenticated and committed once. The record binds both asset digests, byte length, media/source/authority digests, schema version, request, and policy version.
5. Anyone may trigger adjudication. The contract validates calldata and loads state-bound context before semantic work.
6. The leader and validators independently produce exactly seven booleans. Any malformed output is consensus rejection/rotation, not a business result.
7. The first canonical semantic result is authoritative. The deterministic policy engine maps it to `PERMITTED`, `DENIED`, `INCONCLUSIVE`, or `NOT_APPLICABLE`.
8. Only `PERMITTED` creates a permit and transfer intent. All other results create a refund intent and no permit.

## Canonical state versus read models

Canonical records are append-only or immutable after their transition. Read models may be rebuilt from the journal and canonical records. They must not fabricate missing adjudications, collapse historical outcomes, or replace a first result with a later result. `finality` means the adjudication is canonical; it does not mean an external transfer or indexer execution succeeded.

## Money boundary

Phase 1 records deterministic settlement intent and exact amounts. It does not perform unsafe money movement. A production adapter must journal the precondition audit one state earlier, execute idempotently, and distinguish protocol finality from execution success.
