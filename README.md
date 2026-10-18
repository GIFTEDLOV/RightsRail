# RightsRail 2.4.1 — Studionet

**Status: GO — live deployment, four-case qualification, production application, repository CI, and release checks passed.**

RightsRail is live at [rightsrail.vercel.app](https://rightsrail.vercel.app). The public application reads canonical state from built-in GenLayer Studionet (chain 61999) at `0xdDB18c41B3033Ec2daD038F9547baAB913BEA2Aa`.

- Source: `contracts/rightsrail_studionet.py` — SHA-256 `DA0828DD579AB0CAA6432AF713559D4E3B5E679444F71E7345C4FF8E0F21EC47`
- Generated ABI: `artifacts/rightsrail-studionet.abi.json` — SHA-256 `AB93A76683921294FAC694751CF877E0F195A69DC7659FB5F02D6D34BC099B61`
- Schema: 36 methods (24 reads, 12 writes), including read-only `get_audit_events(start, limit)`
- Deployment: `0x0b85e7aa631ed07223e927b2f9310f67beced18be5265ef247c9a74699463951` — `FINALIZED / FINISHED_WITH_RETURN`
- Live results: A `PERMITTED`, B `DENIED`, C `INCONCLUSIVE`, D `NOT_APPLICABLE`; each settlement and native GEN transfer has a finalized receipt and recipient balance readback.

Submission evidence: [GitHub repository](https://github.com/GIFTEDLOV/RightsRail), [candidate manifest](provenance/studionet-candidate-manifest.json), [deployment journal](docs/provenance/live-transactions/rightsrail-studionet-deployment.json), [qualification journal](docs/provenance/live-transactions/rightsrail-studionet-qualification.json), [final report](FINAL_SUBMISSION_REPORT_V241.md), [submission status](SUBMISSION_STATUS_V241.json), [submission details](docs/SUBMISSION_DETAILS_V241.md), and [archive manifest](provenance/rightsrail-v241-studionet-archive-manifest.json).

The original V2.4 candidate, V2.3 source, and their historical records remain preserved separately below.

---

# RightsRail

RightsRail is a GenLayer Intelligent Contract application for semantic usage-rights enforcement for AI and digital media.

It lets an issuer register and freeze a usage permission policy for a digital asset. A requester submits a proposed use and bound evidence. GenLayer validators independently evaluate only bounded semantic questions and return the exact seven-boolean `RIGHTSRAIL_USAGE_V1` vector. A deterministic policy engine then decides whether a permit can exist.

RightsRail does not determine legal copyright ownership or legal infringement. It enforces only the frozen permission policy registered by the issuer.

## Release status

The historical V1 deployment is immutable at
`0x984b996079d2591976FcfFb62d0506DF02E0396A` on Studio-dev. The V2.3
successor is deployed separately at
`0xfB3335350b0e02ceFb384753990E9B377B4BCB1F`, but it has **zero qualification
records**. The included product experience remains a **CONTROLLED LOCAL DEMO**:
it does not silently substitute fixtures for canonical data. Live V2.3
qualification is stopped at the frozen policy because Studio-dev fee
simulation rejects the exact payable request before broadcast. The V2.3 PNG
evidence bundle is publicly served and byte-verified.

The product layer now includes:

- a typed client around the V2.3 35-method ABI and transaction journal;
- explicit `CONTROLLED_LOCAL` and `GENLAYER_CANONICAL` provider modes;
- a persistent JSON-backed local read model with reproducible four-case fixtures;
- a Node API with provenance metadata on every response;
- a rights-control web application on port 3001, including policy, request,
  evidence, adjudication, permit, settlement, activity, integration, and demo
  routes;
- original project-created SVG and deterministic PNG media fixtures under `apps/web/public/demo/`;
- responsive, keyboard-accessible evidence comparison and semantic matrix views;
- browser E2E and screenshot audit coverage.

The frozen V1 provenance remains:

- source SHA-256 `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B`;
- ABI SHA-256 `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB`;
- 30 public methods: 21 reads and 9 writes;
- Studio-dev RC5 runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`;
- strict seven-boolean semantic parsing, independent validator evaluation, bounded two-image evidence, and deterministic policy precedence.

The deployed V2.3 successor adds claimant-bound withdrawal methods and
transaction-datetime validity checks. Its source SHA-256 is
`E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE` and its
official ABI SHA-256 is
`010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B`.

The V2.3 deployment transaction is
`0xb72fcde704b994982892a88ef45d51bc2133625c80f5c405f1bf838cced83dde` and
finished with `FINALIZED / FINISHED_WITH_RETURN`. The authorized qualification
run finalized policy creation and freezing, then stopped before the first
request; see `docs/V23_QUALIFICATION_RUN_BLOCKER.md`.

No GitHub push, Portal submission, faucet use, or Vercel application deployment
was performed. The single authorized V2.3 deployment did consume its explicit
Studio-dev deployment fee; no qualification writes followed.

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
