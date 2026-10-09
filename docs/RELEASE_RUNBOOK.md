# Release runbook

Phase 1 is local architecture and implementation foundation only. Do not deploy, spend GEN, push to GitHub, or create a remote repository.

## Required gates before any testnet work

1. Install the pinned development tools from `pyproject.toml` in an isolated environment.
2. Run unit, adversarial, property, mutation, integration, and browser suites.
3. Run lint and strict typecheck with zero unexplained findings.
4. Review contract ABI/public methods against the frozen schema and docs.
5. Run crash/replay tests for journal, settlement, and transfer-intent execution.
6. Run a local GenLayer runtime test proving leader/validator rejection and rotation behavior.
7. Run fixture tests for compliant, betting/endorsement adversarial, insufficient-evidence, and unrelated-asset cases.
8. Verify no owner override, caller semantic vector, evidence overwrite, result shopping, or permit transfer path exists.
9. Audit every money movement invariant and use exact-value, idempotent execution with precondition audit one state earlier.
10. Obtain explicit project approval for deployment and GEN spend.

## Production operational requirements

- pin contract and package versions;
- record contract SHA-256 and ABI artifact;
- publish semantic schema and evidence schema digests;
- keep canonical state separate from indexer/read models;
- monitor consensus rejection/rotation separately from business results;
- treat finality and execution success as separate status dimensions;
- rehearse rollback/stop-the-line procedures without deleting historical data.
