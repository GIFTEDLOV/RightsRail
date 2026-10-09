# Release runbook

This phase is local-only. Do not deploy, spend GEN, push to GitHub, create a remote repository, use a faucet, broadcast transactions, or create a Vercel project.

## Phase 2 gates

1. Use the isolated pinned development environment from `requirements-dev.txt`.
2. Run pytest, including direct, adversarial, property, mutation, and integration suites.
3. Run Ruff, mypy, and Python compilation.
4. Run `genvm-lint lint`, `validate`, `typecheck --all`, and `schema` with `GENVM_VERSION=v0.2.16`.
5. Compare the generated ABI method surface with `docs/PHASE2_AUDIT.md`.
6. Verify the exact semantic schema and deterministic precedence tests.
7. Verify one-state-too-early, replay, evidence immutability, permit binding, and settlement tests.
8. Run a real GenVM execution test in a fixed compatible harness. The current Windows `gltest 0.30.0rc2` file-descriptor decoder is a blocker; do not treat its failure as a business result.
9. Before any deployment approval, add crash-safe journal replay and end-to-end native-value transfer/refund execution tests.
10. Obtain explicit approval for any future deployment or GEN spend.

## Artifact recording

Record the contract SHA-256, ABI SHA-256, pinned dependency header, GenVM validation bundle, schema version, and test command outputs in provenance. Keep canonical contract state separate from indexer/read models.

## Production requirements not claimed by Phase 2

- external media/context capture service with durable receipts;
- a compatible Studio-dev or local GenVM execution harness;
- crash-safe journal and idempotent transfer/refund worker;
- operational monitoring separating consensus rotation, evidence failure, business result, and transfer execution;
- adversarial model/prompt regression corpus;
- final deployment review and explicit economic sign-off.
