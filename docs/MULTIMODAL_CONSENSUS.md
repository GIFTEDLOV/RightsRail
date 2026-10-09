# Multimodal consensus

## Canonical question

The leader and each validator load the same frozen policy, request, authenticated evidence, and context binding. The evaluator receives no caller-provided semantic vector and no unbounded media collection.

The semantic input is bounded to:

1. protected/reference image;
2. proposed-use artifact or captured webpage screenshot;
3. optional public context text, plus an optional already-bound screenshot digest.

The prompt asks only the seven `RIGHTSRAIL_USAGE_V1` questions. It explicitly excludes ownership, law, damages, fees, recipient, refund, legal advice, invented facts, and final policy verdicts.

## Leader

`leader_fn` revalidates the loaded evidence context, fetches the two bound images, builds the bounded policy-relative prompt, evaluates the model, strictly parses the exact object, and returns only normalized seven-boolean data through `gl.vm.Return` via `gl.vm.run_nondet`.

## Validator

`validator_fn` requires the leader result to be a `gl.vm.Return`. It strictly parses the leader payload, independently performs the same semantic evaluation with the same canonical context, strictly parses its own result, and compares only the seven booleans. Any malformed payload or disagreement returns validator rejection/rotation.

## Post-consensus

The contract strictly parses the consensus result again before deriving a deterministic result or writing an adjudication. It increments generation exactly once. No malformed or unavailable semantic evaluation can create a verdict, permit, or settlement.

## Evidence changes

If a bound source changes between authentication and adjudication, deterministic revalidation rejects consensus. Transport failure, invalid content, and authentication mismatch remain infrastructure/evidence statuses; only a valid semantic vector can set `evidence_sufficient=false`.
