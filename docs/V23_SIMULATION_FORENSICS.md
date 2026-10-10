# RightsRail V2.3 Case A simulation forensics

Status: **BLOCKED before the first request broadcast**.

This report records a read-only investigation of the deployed V2.3 contract.
It does not authorize, sign, or broadcast a request transaction.

## Exact deployed inputs

| Field | Value |
| --- | --- |
| Contract | `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F` |
| Chain | Studio-dev `61997` |
| Source SHA-256 | `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE` |
| ABI SHA-256 | `010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B` |
| Policy | `policy-v23-lumen-finch-001` |
| Policy state/version | `FROZEN` / `1` |
| Required user value | `10` wei |
| Request signer | `0x61f10cc252ed98ce7596c73fc557cca4cc600c82` |

The latest read-only block observed during this investigation was
`0x6aca9e8d`, timestamp `1791663757` (`2026-10-10T20:22:37Z`). Canonical
policy readback was:

```text
valid_from  = 1791658016
valid_until = 1794253616
created_at  = 1791661624
frozen_at   = 1791661669
```

The chain timestamp is inside the stored interval. The canonical contract
still reports one frozen policy and zero requests, evidence, adjudications,
permits, settlements, withdrawals, and escrow.

## Exact simulation result

The captured artifact is
`docs/provenance/simulations/v23-case-a-simulation.json`.

The exact Case A write specification used the V2.3 ABI's 11 positional
arguments, `kwargs = {}`, and `value = 10n`. The pinned SDK encoded it as:

```text
type: write
to: 0xfB3335350b0e02ceFb384753990E9B377B4BCB1F
from: 0x61F10Cc252eD98Ce7596c73fC557cCA4cc600c82
value: 0xa
calldata bytes: 333
calldata SHA-256: 088a5ea348f44b06cdf04f55e3dd6ad34c656b5c6883b4e94b3f3be6c7bb17f8
```

Both supported read-only paths were exercised:

| Path | State variant | Result |
| --- | --- | --- |
| `sim_estimateTransactionFees` | `latest-nonfinal` | HTTP 200 JSON-RPC error; execution result `ERROR` |
| `sim_call` | `latest-nonfinal` | HTTP 200 JSON-RPC error; execution result `ERROR` |
| `sim_call` | `latest-finalized` | HTTP 200 JSON-RPC error; execution result `ERROR` |

The deepest available execution payload decodes to:

```text
[EXPECTED] policy is outside its validity window
```

This is a contract execution failure, not a missing JSON-RPC parameter. The
same error from `sim_call` independently rules out a fee-estimator-only
failure. Switching from non-final to finalized state also produces the same
error, ruling out the selected state variant as the cure.

## SDK and payload audit

The installed pinned SDK is `genlayer-js 2.0.0-rc.1`. Its implementation:

- encodes the same `functionName`, `args`, and `kwargs` for simulation and fee
  estimation (`dist/index.js`, lines 1376 and 1590);
- converts the payable user value to RPC hex (`dist/index.js`, lines 1386-1389
  and 1602-1605);
- adds fee fields only to the fee-estimation request; and
- does not expose a transaction-datetime override in either request shape.

The captured estimate request contains `value = 0xa` and a complete fee
profile, including a positive `feeValue`, distribution, rotations, and an
execution budget. The simulator therefore receives the payable value and the
contract reaches its validity-window guard before it reaches the escrow-value
guard.

The response contains no authoritative simulator datetime. The request also
contains no datetime field that the runner can safely set through the pinned
SDK. The hidden execution datetime is consequently not claimed numerically.

## Source boundary and root cause

The frozen source reads the runtime context here:

```python
raw = str(gl.message.raw["datetime"])
parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
```

`submit_usage_request` then evaluates:

```python
if now < policy["valid_from"] or (
    policy["valid_until"] != 0 and now > policy["valid_until"]
):
    _fail("policy is outside its validity window")
```

The canonical chain clock is active, while both simulator execution paths
reject the active stored interval. The primary classification is therefore
`F_SIMULATOR_TIMESTAMP_CONTEXT_DIVERGENCE`.

This is not evidence of:

- omitted payable value;
- malformed argument types;
- stale fee data;
- an ABI mismatch;
- a state-variant mismatch; or
- a proof that the policy is expired.

No runner change can safely manufacture a datetime field that the pinned SDK
does not support. Broadcasting after this failed execution precondition would
be an unsafe bypass and is prohibited.

## Regression coverage and release decision

`tests/v23_case_a_simulation_forensics.test.mjs` asserts the captured raw
request/response evidence, exact `10` wei encoding, calldata parity, both
state variants, and the source validity guard. It is a regression against
mistaking this failure for a payable-value or fee-estimation defect.

The deployed contract and ABI remain unchanged. No request transaction was
broadcast. Live semantic qualification, withdrawal/delivery verification,
GitHub publication, Portal submission, and a release GO decision remain
blocked until a supported Studio-dev runtime path proves this exact request
active without bypassing the contract guard.

