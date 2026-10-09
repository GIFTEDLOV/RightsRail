# RightsRail architecture

## Scope

RightsRail answers one narrow question: does a proposed use satisfy the permission policy registered and frozen by the issuer for a specific asset version? It does not determine copyright ownership, legal infringement, damages, or legal advice.

## Runtime boundary

`contracts/rightsrail.py` is a deployable GenLayer contract in the proven current Studio-dev RC5 dialect:

- dependency header: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`;
- canonical state: `TreeMap` and `DynArray` storage, never process-local dictionaries;
- reads: 18 `@gl.public.view` methods;
- writes: 9 methods, including one payable request method;
- semantic execution: `gl.vm.run_nondet_default`, leader output through `gl.vm.Return`, independent validator evaluation;
- settlement: deterministic post-consensus native-value transfer/refund path.

The pinned validation bundle is `GENVM_VERSION=v0.6.0-rc5`. The contract is validated with `genvm-lint`; project-level Python mypy intentionally covers the framework-neutral packages, while the GenLayer typechecker covers the contract dialect.

## Monorepo boundaries

- `contracts/rightsrail.py`: canonical on-chain state, runtime decorators, storage, consensus, and settlement.
- `packages/domain`: framework-neutral records and deterministic state-machine reference model.
- `packages/shared`: canonical serialization and SHA-256 helpers.
- `packages/evidence`: evidence-binding validation.
- `packages/media-analysis`: the bounded two-image semantic boundary.
- `packages/policy-engine`: exact parser and deterministic result derivation.
- `packages/genlayer-client`: leader/validator architecture seam and calldata parser.
- `packages/indexer`: future rebuildable read models only.
- `packages/workflow`: future crash-safe journal/retry orchestration.
- `apps/web`, `apps/api`: typed Phase 3 integration scaffolds; no polished product UI yet.

## Canonical flow

1. Create a `DRAFT` policy.
2. The issuer may update it only while draft.
3. The issuer freezes it. Frozen semantic and economic fields cannot change.
4. A requester submits against the exact frozen policy version and escrows the exact frozen fee.
5. Evidence is committed once and binds both images, optional public context, hashes, lengths, MIME types, source identifiers, request, policy, and version.
6. Authentication independently fetches/captures and validates the bindings.
7. Anyone triggers adjudication. The leader and validators independently produce exactly seven booleans.
8. Consensus output is strictly parsed again, then deterministic precedence derives the result.
9. Exactly one adjudication generation is persisted.
10. Exactly one settlement is allowed. Only `PERMITTED` creates a request-bound permit and licensing-fee transfer; all other results refund the requester and create no permit.

Canonical records and audit entries are append-only or transition-guarded. Read models are projections and never a second source of truth.
