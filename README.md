# RightsRail

RightsRail is a GenLayer Intelligent Contract application for semantic usage-rights enforcement for AI and digital media.

It lets an issuer register and freeze a usage permission policy for a digital asset. A requester submits a proposed use and bound evidence. GenLayer validators independently evaluate only bounded semantic questions and return the exact seven-boolean `RIGHTSRAIL_USAGE_V1` vector. A deterministic policy engine then decides whether a permit can exist.

RightsRail does not determine legal copyright ownership or legal infringement. It enforces only the frozen permission policy registered by the issuer.

## Phase 2 status

This repository contains the local runtime foundation only:

- a real GenLayer contract at `contracts/rightsrail.py` using the proven local `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` dialect;
- actual `gl.Contract`, public view/write/payable methods, TreeMap/DynArray storage, `gl.vm.run_nondet`, `gl.vm.Return`, and deterministic native-value settlement calls;
- strict seven-boolean semantic parsing, independent validator evaluation, two-image evidence bounds, authenticated URL/media bindings, append-only records, and frozen-policy state transitions;
- deterministic `INCONCLUSIVE`, `NOT_APPLICABLE`, `PERMITTED`, and `DENIED` precedence;
- generated ABI/schema at `artifacts/rightsrail.abi.json`;
- direct, adversarial, property, mutation, and integration tests;
- pinned project-local development tools and Phase 2 audit documentation.

No deployment, GEN spending, GitHub repository, remote push, faucet use, Vercel project, or polished frontend is part of this phase.

## Run locally

```powershell
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\ruff.exe check .
.venv\Scripts\mypy.exe
.venv\Scripts\python.exe -m compileall -q contracts packages tests
```

The contract-specific commands pin the proven cached validation bundle:

```powershell
$env:PATH = "C:\Users\DELL\.beacon-v8-v06-rc2\Scripts;" + $env:PATH
$env:GENVM_VERSION = "v0.2.16"
genvm-lint lint contracts/rightsrail.py --json
genvm-lint validate contracts/rightsrail.py --json
genvm-lint typecheck contracts/rightsrail.py --json --all
genvm-lint schema contracts/rightsrail.py -o artifacts/rightsrail.abi.json --json
```

The exact commands are also available under `tools/` and `package.json`.

## Core sequence

```text
deterministic facts -> bounded semantic vector -> deterministic policy -> settlement
```

The first canonical adjudication is authoritative. Malformed model output is a consensus rejection/rotation condition, never a business verdict.

## Runtime note

The installed `genvm-lint` bundle validates and typechecks the contract successfully. The installed Windows `gltest` direct runner currently fails before contract execution while decoding its file-descriptor calldata, including against known-good local reference contracts. This is recorded in `docs/PHASE2_AUDIT.md`; it is not hidden as a passing runtime execution test.
