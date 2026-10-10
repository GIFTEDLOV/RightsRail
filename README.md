# RightsRail

RightsRail is a GenLayer Intelligent Contract application for semantic usage-rights enforcement for AI and digital media.

It lets an issuer register and freeze a usage permission policy for a digital asset. A requester submits a proposed use and bound evidence. GenLayer validators independently evaluate only bounded semantic questions and return the exact seven-boolean `RIGHTSRAIL_USAGE_V1` vector. A deterministic policy engine then decides whether a permit can exist.

RightsRail does not determine legal copyright ownership or legal infringement. It enforces only the frozen permission policy registered by the issuer.

## Release status

The historical V1 deployment is immutable at
`0x984b996079d2591976FcfFb62d0506DF02E0396A` on Studio-dev. The included
product experience remains a **CONTROLLED LOCAL DEMO**: it does not activate
live reads, broadcast transactions, request a wallet signature, or silently
substitute fixtures for canonical data. A local successor candidate contains
timestamp and cash-exit hardening, but it is not deployed and must not be
described as the V1 contract.

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

The frozen V1 provenance remains:

- source SHA-256 `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B`;
- ABI SHA-256 `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB`;
- 30 public methods: 21 reads and 9 writes;
- Studio-dev RC5 runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`;
- strict seven-boolean semantic parsing, independent validator evaluation, bounded two-image evidence, and deterministic policy precedence.

The local successor candidate adds claimant-bound withdrawal methods and
transaction-datetime validity checks. It has 34 generated methods and new
source SHA-256 `CEC17DF5D0D096591706B9547349DC870CE20C9276C9BCA2B0270204FDD29F0F`
and ABI SHA-256
`E7FC1AB9E0EC3BC20BB06C992318F300000B1F617FA6F8977F0DEEF2B688F805`; it has
not been deployed.

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
