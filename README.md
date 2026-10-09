# RightsRail

RightsRail is a GenLayer Intelligent Contract application for semantic usage-rights enforcement for AI and digital media.

It lets an issuer register and freeze a usage permission policy for a digital asset. A requester submits a proposed use and bound evidence. GenLayer validators independently evaluate only bounded semantic questions and return the exact seven-boolean `RIGHTSRAIL_USAGE_V1` vector. A deterministic policy engine then decides whether a permit can exist.

RightsRail does not determine legal copyright ownership or legal infringement. It enforces only the frozen permission policy registered by the issuer.

## Phase 3 status

This repository contains a complete local product foundation around the frozen
contract candidate. It is intentionally **UNDEPLOYED** and the included
experience is a **CONTROLLED LOCAL DEMO**. It does not read live GenLayer state,
broadcast transactions, request a wallet signature, or silently substitute
fixtures for canonical data.

The product layer now includes:

- a typed client around the frozen 30-method ABI and transaction journal;
- explicit `CONTROLLED_LOCAL` and `GENLAYER_CANONICAL` provider modes;
- a persistent JSON-backed local read model with reproducible four-case fixtures;
- a Node API with provenance metadata on every response;
- a rights-control web application on port 3001, including policy, request,
  evidence, adjudication, permit, settlement, activity, integration, and demo
  routes;
- original project-created SVG media fixtures under `apps/web/public/demo/`;
- responsive, keyboard-accessible evidence comparison and semantic matrix views;
- browser E2E and screenshot audit coverage.

The frozen contract and ABI remain the Phase 2.6 candidate:

- a real GenLayer contract at `contracts/rightsrail.py` using the known-good Studio-dev RC5 `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` dialect;
- actual `gl.contract.Contract`, public view/write/payable methods, TreeMap/DynArray storage, `gl.vm.run_nondet_default`, `gl.vm.Return`, and deterministic entitlement settlement accounting;
- strict seven-boolean semantic parsing, independent validator evaluation, two-image evidence bounds, authenticated URL/media bindings, append-only records, and frozen-policy state transitions;
- deterministic `INCONCLUSIVE`, `NOT_APPLICABLE`, `PERMITTED`, and `DENIED` precedence;
- generated ABI/schema at `artifacts/rightsrail.abi.json`.

- a real GenLayer contract at `contracts/rightsrail.py` using the known-good Studio-dev RC5 `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` dialect;
- actual `gl.contract.Contract`, public view/write/payable methods, TreeMap/DynArray storage, `gl.vm.run_nondet_default`, `gl.vm.Return`, and deterministic entitlement settlement accounting;
- strict seven-boolean semantic parsing, independent validator evaluation, two-image evidence bounds, authenticated URL/media bindings, append-only records, and frozen-policy state transitions;
- deterministic `INCONCLUSIVE`, `NOT_APPLICABLE`, `PERMITTED`, and `DENIED` precedence;
- generated ABI/schema at `artifacts/rightsrail.abi.json`;
- direct RC5 execution tests using controlled media/LLM mocks, adversarial, property, mutation, and integration tests;
- pinned project-local development tools and Phase 2.5 runtime qualification documentation.

No deployment, GEN spending, GitHub repository, remote push, faucet use, or Vercel project is part of this phase.

## Run locally

```powershell
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\ruff.exe check .
.venv\Scripts\mypy.exe
.venv\Scripts\python.exe -m compileall -q contracts packages tests
pnpm install
pnpm run dev
```

Open `http://127.0.0.1:3001`. The API runs at `http://127.0.0.1:3002`.
Use `pnpm run test:ts`, `pnpm run test:browser`, and `pnpm run build` for the
local product gates. Playwright requires its local Chromium browser installed.

The contract-specific commands pin the proven cached validation bundle:

```powershell
$env:GENVM_VERSION = "v0.6.0-rc5"
genvm-lint lint contracts/rightsrail.py --json
genvm-lint validate contracts/rightsrail.py --json
genvm-lint typecheck contracts/rightsrail.py --json --all
genvm-lint schema contracts/rightsrail.py -o artifacts/rightsrail.abi.json --json
```

The exact commands are also available under `tools/` and `package.json`. RC5
reports the documented E010 nondeterministic-reachability warning for valid
`gl.nondet` helpers; hosted schema, contract validation, and typecheck are the
authoritative static gates.

## Core sequence

```text
deterministic facts -> bounded semantic vector -> deterministic policy -> settlement
```

The first canonical adjudication is authoritative. Malformed model output is a consensus rejection/rotation condition, never a business verdict.

## Runtime note

The old `1jb45...` runner is rejected by current Studio-dev with
`invalid_contract runner malformed`. The migrated `5jyc...` runner passes the
exact hosted source schema probe and local RC5 validation. Windows direct
execution works after a project-local extraction cache and narrow test-only
compatibility adapter; no chain write is performed. See
`docs/PHASE2_5_AUDIT.md` for raw qualification evidence and limitations.
