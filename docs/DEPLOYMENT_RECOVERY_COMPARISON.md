# RightsRail deployment recovery comparison

This is a read-only recovery record. RightsRail was not redeployed, and no
transaction was signed or broadcast in this phase.

## Finding

RightsRail attempt #1 used the raw Studio-dev fee floor as its complete
per-round execution budget:

```text
executionBudgetPerRound = 76548000000000
feeValue                 = 76548000002588
rotations                = [0]
```

The immutable receipt records a chargeable deployment receipt of
`78628000000000` and an overrun of `2080000000000`. The deployment failed
with `out_of_receipt_nondet_output` / `ExecutionBudgetExceeded`.

The installed `genlayer-js 2.0.0-rc.1` SDK was queried read-only against the
same Studio-dev RPC. Its `estimateTransactionFees()` result was:

```text
executionBudgetPerRound = 25000000000000000
feeValue                 = 100000000000010352
rotations                = [3]
leader                   = 100
validator                = 200
```

That exact profile is also recorded by successful Firewall, ClearLC, and
CharterLock Studio-dev deployments. It is the corrected source of deployment
fees; no percentage uplift was invented.

## Previous-project evidence

### Firewall

No executable broadcast script is present in the current Firewall tree. The
successful serialized request is preserved in
`C:\Users\DELL\Firewall\provenance\live-qualification.json`, including the
`deployment_5_live` record. It used the same runner and chain and recorded a
fresh `genlayer-py v0.19.0rc2` Studio-dev estimate with:

```text
feeValue                 = 100000000000010352
executionBudgetPerRound = 25000000000000000
rotations                = [3]
leader                   = 100
validator                = 200
userValue                = 0
```

The record verifies that the serialized fee object and distribution were
present before signing. The old default CLI path is separately recorded as
unsafe because it omitted `feeValue`.

### ClearLC

The actual executable workflow is
`C:\Users\DELL\ClearLC\scripts\qualify-studio-dev.ts`.

Relevant calls are:

- `feeInput()` preserves `distribution`, `messageAllocations`, and `feeValue`;
- `estimateDeployFees()` calls `client.estimateTransactionFees()`;
- deployment calls `client.deployContract({ account, code, fees })`;
- the journal is written before submission and finalization is checked.

The pinned SDK is `genlayer-js 2.0.0-rc.1`. The successful deployment profile
is preserved in `C:\Users\DELL\ClearLC\artifacts\deployment-3-fee-profile.json`
and matches Firewall exactly. There is no manual percentage headroom in the
executable workflow; the SDK estimate supplies the explicit profile.

### CharterLock

`C:\Users\DELL\CharterLock\scripts\deploy_preflight.py` is intentionally
dry-run-only and refuses non-dry-run execution. The successful deployment
request is preserved in
`C:\Users\DELL\CharterLock\docs\provenance\STUDIO_DEV_DEPLOYMENT.json`.
It records the same `100000000000010352` fee, `25000000000000000` budget,
rotations `[3]`, and explicit distribution. Its successful deployment path is
provenance, not a reusable executable script.

### LicenseProof

No local LicenseProof workspace was found. The two exact chain transactions
were inspected from read-only account history:

| Attempt | Transaction | Source SHA-256 | Fee value | Budget | Result |
|---|---|---|---:|---:|---|
| 1 | `0xa1f901212fc261aeeddc05f32c1b08ee3365cb5a251217c43183524e9e2794a5` | `77FB66904787BAAB72210276F29D6C0CC29831E2D243CECAD5C2EB249146C0C4` | `76548000002588` | `76548000000000` | `FINISHED_WITH_ERROR`, `ExecutionBudgetExceeded` |
| 2 | `0xc1d73935470d50f78338aea2fe4c151f1d4baffd98f60575a5c95fb59c99a799` | same | `76548000002588` | `76548000000000` | `FINISHED_WITH_ERROR`, `ExecutionBudgetExceeded` |

Both payloads use the same legacy floor-style profile as RightsRail. The
deleted LicenseProof helper is unavailable, so its source-level script cannot
be claimed.

## Side-by-side matrix

`UNKNOWN` means the executable source was not preserved locally.

| Project / attempt | Result | Runner | Deployment script | Estimator | Raw estimate | Budget used | Headroom | Fee value | Distribution | Nondeterministic cost handling | Execution |
|---|---|---|---|---|---:|---:|---|---:|---|---|---|
| Firewall successful deployment | success | `py-genlayer:5jyc...` | absent; provenance | `genlayer-py v0.19.0rc2` / `sim_getFeeConfig` | `100000000000010352` | `25000000000000000` | proven profile | `100000000000010352` | `100/200`, `[3]` | serialized profile verified | `FINISHED_WITH_RETURN` |
| ClearLC successful deployment | success | `py-genlayer:5jyc...` | `scripts/qualify-studio-dev.ts` | `genlayer-js 2.0.0-rc.1` `estimateTransactionFees()` | `100000000000010352` | `25000000000000000` | SDK profile | `100000000000010352` | `100/200`, `[3]` | explicit distribution passed | `FINISHED_WITH_RETURN` |
| CharterLock successful deployment | success | `py-genlayer:5jyc...` | absent; provenance | recorded Studio-dev profile | `100000000000010352` | `25000000000000000` | proven profile | `100000000000010352` | `100/200`, `[3]` | explicit distribution recorded | `FINISHED_WITH_RETURN` |
| LicenseProof attempt 1 | failure | `py-genlayer:5jyc...` | unavailable | unknown; floor pattern | `76548000002588` | `76548000000000` | none above receipt | `76548000002588` | `100/200`, `[0]` | receipt cost omitted | `FINISHED_WITH_ERROR` |
| LicenseProof attempt 2 | failure | `py-genlayer:5jyc...` | unavailable | unknown; same pattern | `76548000002588` | `76548000000000` | none above receipt | `76548000002588` | `100/200`, `[0]` | receipt cost omitted | `FINISHED_WITH_ERROR` |
| RightsRail attempt 1 | failure | `py-genlayer:5jyc...` | absent; journal/payload | legacy floor/reconstruction | `76548000002588` | `76548000000000` | none above receipt | `76548000002588` | `100/200`, `[0]` | overrun `2080000000000` | `FINISHED_WITH_ERROR` |

## Root cause classification

Primary category: **D — outdated helper copied from another project**.

At the tooling level, RightsRail used the older `sim_getFeeConfig` budget floor
directly and rebuilt a small positive `feeValue` from it. The same payload-level
pattern appears in both LicenseProof failures. This bypassed the proven RC SDK
`estimateTransactionFees()` profile, which includes the explicit deployment
distribution required by current Studio-dev.

The earlier deployment forensic classification `E_DEPLOY_PAYLOAD_ERROR`
remains historically correct at the transaction layer. This document adds the
tooling-level cause proven by comparison.

## Corrected rule

For every future deployment preparation:

1. call the installed RC `genlayer-js` `client.estimateTransactionFees()`;
2. pass its explicit `distribution` and `feeValue` as one pair;
3. require the result to match the proven Studio-dev profile used by successful
   deployments;
4. require `executionBudgetPerRound > 78628000000000`;
5. fail closed if the fresh estimate exceeds the proven profile instead of
   guessing a multiplier;
6. re-read latest and pending nonce and require equality before signing.

The implementation is in `tools/deployment_fee_policy.mjs` and
`tools/prepare_rightsrail_deployment.mjs`. The latter performs only read-only
SDK/RPC calls and writes unsigned metadata; it never invokes `deployContract`.

## Attempt #2 unsigned preparation

The read-only preparation produced:

```text
chainId                  61997
sender                   0x33653e6e86807e41682d3346cdf648d6653384b1
nonce                    14
latest/pending           14 / 14
runner                   py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
userValue                0
feeValue                 100000000000010352
executionBudgetPerRound  25000000000000000
distribution             leader 100, validator 200, rotations [3]
source SHA-256            C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B
ABI SHA-256               E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB
signed                    false
broadcast                 false
```

The machine-readable record is
`docs/provenance/rightsrail-deployment-attempt-2-prepared.json`. Its nonce is
a snapshot only; an authorized process must read it again immediately before
signing.

Unchanged from attempt #1: source, ABI, runner, chain, sender, constructor
args/kwargs, and `userValue=0`. Changed: nonce (`13` to `14`), execution
budget, fee value, and the explicit distribution profile (`[0]` to `[3]`).

## Boundary

No contract source or ABI file was changed. No deployment retry was made. No
signing, broadcast, funding, qualification write, or GEN spending occurred.
Attempt #2 requires a new explicit human authorization containing fresh account
state, fresh fee output, and the exact source/ABI hashes.
