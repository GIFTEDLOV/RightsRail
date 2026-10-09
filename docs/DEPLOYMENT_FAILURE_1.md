# RightsRail Deployment Attempt 1 — Failure Forensics

This document records the single authorized RightsRail deployment attempt. It
is historical provenance only. No retry was made during this investigation.

## Identity and outcome

| Field | Value |
|---|---|
| Network | Studio-dev |
| Chain ID | `61997` |
| RPC | `https://studio-dev.genlayer.com/api` |
| Sender | `0x33653e6e86807e41682d3346cdf648d6653384b1` |
| Transaction | `0x6d1f81af7fe4872be8eeceb29a2331a082e6a822a6b912a99d2155b9a76d664e` |
| Status | `FINALIZED` |
| Execution | `FINISHED_WITH_ERROR` |
| Consensus result | `MAJORITY_AGREE` |
| Broadcast count | `1` |
| Canonical contract | None |

The receipt has `contractAddress: null`. The transaction payload contains a
candidate address (`0xA333Ae3DCa972f6aDebb93e9FDCBBbb30A47bC5A`), but read-only
verification returned `eth_getCode = 0x` and
`gen_getContractSchema = Contract ... not found`. It is not a deployed
RightsRail contract.

The immutable transaction record remains at
`docs/provenance/live-transactions/rightsrail-deployment.json`. The complete
read-only diagnostic response is preserved at
`docs/provenance/live-transactions/rightsrail-deployment-forensics.json`.

## Exact failure

The deepest exposed execution payload is present in the leader receipt and
the agreeing validator receipts:

```text
status:  contract_error
raw:     Am91dF9vZiByZWNlaXB0IG5vbmRldF9vdXRwdXQ=
payload: out_of receipt nondet_output
```

Base64 decoding the raw value yields `out_of_receipt_nondet_output`.

No deeper Python exception, `UserError`, VM error, traceback, stderr, or
runner-specific error was exposed. The leader and agreeing validators report
empty stdout/stderr and null `raw_error`, `error_code`, and
`error_description`. The two idle validators report only the secondary
consensus cancellation `CONSENSUS_VALIDATOR_QUORUM_REACHED` after quorum.

The transaction-specific debug RPC `gen_dbg_traceTransaction` was also
queried read-only and returned JSON-RPC `-32601 Method not found`. No separate
GenVM/Consensus log endpoint exposed a deeper exception for this transaction;
the embedded receipt, consensus history, fee-accounting report, and receipt
logs are the authoritative diagnostics available from Studio-dev here.

The transaction’s embedded fee accounting identifies the underlying cause:

| Fee-accounting field | Value |
|---|---:|
| Requested `feeValue` | `76548000002588` wei |
| Per-round execution budget | `76548000000000` |
| GenVM execution consumed | `74500000000000` |
| Chargeable deployment receipt | `78628000000000` |
| Budget overrun | `2080000000000` |
| `executionBudgetExceeded` | `true` |
| `budgetExhaustionReason` | `ExecutionBudgetExceeded` |
| Suggested fee preset in payload | `94353600002588` wei |

The hosted execution entered GenVM preparation and execution, and its manager
reported a successful run attempt. The failure occurred while the deployment
proposal receipt was being charged/materialized with an execution budget below
the chargeable receipt requirement. This is not a business verdict and did
not create contract state.

## Deployment-payload audit

| Field | Verified value |
|---|---|
| Source bytes in payload | `58413` |
| Source SHA-256 | `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B` |
| Source parity with local attempt source | Exact |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| User value | `0` |
| Constructor calldata | Base64 `Bg==`, raw byte `[6]`, decoded `{}` |
| Constructor signature | `def __init__(self) -> None` |
| Constructor arguments | `args=[]`, `kwargs={}` |
| Constructor arguments valid | Yes |

The exact payload source was base64-decoded from `eth_getTransactionByHash`
and hashed independently. It is byte-for-byte equal to the local contract.
The frozen ABI hash is `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB`.

## Local initialization reproduction

The RC5 direct harness test
`tests/direct/test_genlayer_runtime_execution.py` was run against the current
source with `GENVM_VERSION=v0.6.0-rc5`:

```text
1 passed
```

The `direct_deploy` fixture performs the normal loader path, calldata
round-trip, storage allocation, and `__init__` invocation with no constructor
arguments. Local deployment initialization therefore passes and does not
reproduce the hosted failure.

## Initialization and known-good comparison

RightsRail initialization assigns only scalar `gl.u256(0)` counters:

- `total_escrow_received`
- `total_escrowed`
- `total_payout_allocated`
- `total_refund_allocated`
- `total_withdrawal_emitted`
- `sequence`

The `TreeMap` and `DynArray` fields are declared as GenLayer storage fields and
are not replaced with process-local dictionaries. This matches the
deployment-sensitive storage pattern used by the locally successful
ClearLC/Firewall/CharterLock contracts. Local RC5 construction succeeds, and
the hosted receipt shows no storage-type or constructor exception. The
accounting initialization is therefore not supported as the failure cause.

## Shared-account nonce provenance

Read-only `sim_getTransactionsForAddress` resolved both nonce gaps:

| Nonce | Transaction | Purpose | Status |
|---:|---|---|---|
| 11 | `0xa1f901212fc261aeeddc05f32c1b08ee3365cb5a251217c43183524e9e2794a5` | `LicenseProof` deployment; source class/docstring identified from payload, source SHA `77FB66904787BAAB72210276F29D6C0CC29831E2D243CECAD5C2EB249146C0C4` | `FINALIZED / FINISHED_WITH_ERROR`, same `ExecutionBudgetExceeded` profile |
| 12 | `0xc1d73935470d50f78338aea2fe4c151f1d4baffd98f60575a5c95fb59c99a799` | Same `LicenseProof` deployment payload and source | `FINALIZED / FINISHED_WITH_ERROR`, same `ExecutionBudgetExceeded` profile |

RightsRail used nonce 13. The failed RightsRail transaction advanced the
shared account to nonce 14; no additional transactions were sent during this
forensics phase.

## Root-cause classification

**Primary category: E_DEPLOY_PAYLOAD_ERROR**

Root cause: the deployment request supplied an execution fee budget that was
lower than the chargeable deployment receipt requirement. The exact payload
itself records `executionBudgetExceeded: true` and a `2080000000000` budget
overrun. This explains the surfaced `out_of_receipt_nondet_output` error.

The evidence rejects:

- `A_SOURCE_INITIALIZATION_BUG`: local exact construction passes and no source
  exception is exposed.
- `B_CONSTRUCTOR_ARGUMENT_ERROR`: the zero-argument signature and encoded empty
  calldata are valid.
- `C_RUNTIME_API_INCOMPATIBILITY`: the runner entered GenVM execution and the
  source passed local RC5 initialization.
- `D_RUNNER_FAILURE`: no runner initialization error is reported; the runner
  is present in the exact payload and execution reached receipt creation.
- `F_HOSTED_STUDIO_DEV_INFRASTRUCTURE`: the transaction payload provides a
  deterministic, transaction-specific budget-overrun explanation.

## Source and ABI freeze

No contract source correction is required or authorized from this evidence.

| Artifact | Before | After | Changed |
|---|---|---|---|
| `contracts/rightsrail.py` | `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B` | Same | No |
| `artifacts/rightsrail.abi.json` | `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB` | Same | No |

The ABI file was restored from the pinned RC5 schema command after the direct
test harness cleared its local `artifacts` directory. Its frozen bytes now
match the declared ABI hash; no method or schema change was made.

## Authorization boundary

Forensics performed only read-only RPC calls and local execution. There were
zero blockchain writes and zero GEN spent during forensics. The failed
deployment itself remains one immutable historical attempt and is not being
reinterpreted as a successful deployment.

There is no redeployment authorization in this record. Any future attempt
requires a new explicit human authorization containing a freshly read nonce,
the unchanged exact source hash, the exact runner, and a newly prepared
positive `feeValue` whose execution budget covers the observed chargeable
receipt with an approved safety margin. No qualification write is authorized
by this document.
