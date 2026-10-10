# Release runbook

This phase is local-only. Do not deploy, spend GEN, push to GitHub, create a remote repository, use a faucet, broadcast transactions, or create a Vercel project.

## Phase 2.5 gates

1. Use the isolated pinned development environment from `requirements-dev.txt`.
2. Run pytest, including direct, adversarial, property, mutation, and integration suites.
3. Run Ruff, mypy, and Python compilation.
4. Run `genvm-lint lint`, `validate`, `typecheck --all`, and `schema` with `GENVM_VERSION=v0.6.0-rc5`.
5. Compare the generated ABI method surface with `docs/PHASE2_AUDIT.md`.
6. Verify the exact semantic schema and deterministic precedence tests.
7. Verify one-state-too-early, replay, evidence immutability, permit binding, and settlement tests.
8. Run the RC5 direct execution tests with controlled two-image mocks and explicit validator replay. The test-only adapter must remain isolated from contract code.
9. Verify settlement allocation and conservation invariants. `settle_request` must not emit an external transfer. For the deployed V1 candidate, stop at entitlement allocation. For any successor with pull withdrawal methods, separately reconcile `WITHDRAWAL_EMITTED` against external delivery; never call an emitted message delivered.
10. Obtain explicit approval for any future deployment or GEN spend.

## Artifact recording

Record the contract SHA-256, ABI SHA-256, pinned dependency header, GenVM validation bundle, schema version, and test command outputs in provenance. Keep canonical contract state separate from indexer/read models.

## Production requirements not claimed by Phase 2.5

- external media/context capture service with durable receipts;
- hosted write/transaction execution and receipt qualification;
- crash-safe journal and idempotent entitlement/delivery reconciliation worker;
- operational monitoring separating consensus rotation, evidence failure, business result, and transfer execution;
- adversarial model/prompt regression corpus;
- final deployment review and explicit economic sign-off.
