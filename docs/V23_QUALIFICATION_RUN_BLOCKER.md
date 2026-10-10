# RightsRail V2.3 qualification run blocker

Date: 2026-10-10  
Network: GenLayer Studio-dev, chain `61997`  
Contract: `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F`

## Outcome

The authorized V2.3 run stopped after the two policy writes. Both writes were
reconciled against their exact hashes and finalized successfully:

| Step | Transaction | Result |
| --- | --- | --- |
| `create_policy` | `0xc2146e5b63248820fa520008f27581877358cb77c86410ebdcaa211fcb735b94` | `FINALIZED / FINISHED_WITH_RETURN` |
| `freeze_policy` | `0xf1b4106147bc3f7c4e45ac0f68958b84b65e3600fa2fb5c8b4ab6f1bfa77f001` | `FINALIZED / FINISHED_WITH_RETURN` |

No Case A request transaction was broadcast. The canonical V2.3 state is one
frozen policy and zero requests, evidence records, authentications,
adjudications, permits, settlements, withdrawals, and escrow allocations.

## Exact stop

The first Case A `submit_usage_request` fee-estimation call failed before
signing or broadcast:

```text
GenLayer RPC error (sim_estimateTransactionFees): execution failed;
InvalidInputRpcError: Missing or invalid parameters.
```

The runner constructed the V2.3 ABI call with all 11 positional arguments,
empty kwargs, and `value = 10` wei. The deployed ABI marks this method payable,
and the frozen policy requires exactly 10 wei. Therefore this stop is not an
authorized attempt to send zero value, substitute a fee, or bypass the
contract guard.

The exact attempted call was:

- method: `submit_usage_request`
- request ID: `v23-request-case-a`
- policy ID: `policy-v23-lumen-finch-001`
- policy version: `1`
- proposed MIME: `image/png`
- proposed bytes: `52132`
- public evidence URL: empty string (as permitted by the contract)
- user value: `10` wei
- kwargs: `{}`

The contract's validity guard reads `gl.message.raw["datetime"]` and compares
Unix seconds. The policy readback is active for the latest chain timestamp:
`valid_from = chain_now - 3600` and `valid_until = chain_now + 30 days`.
The read-only simulator nevertheless rejects the exact payable request during
execution. This is consistent with the previously documented Studio-dev
simulation timestamp-context divergence. The underlying simulator timestamp
was not exposed in the error response, so no numeric hidden clock is claimed.

## V2.3 exact-path forensic confirmation

The read-only artifact `docs/provenance/simulations/v23-case-a-simulation.json`
captures the raw RPC request and response for the same concrete write object.
It proves:

- `sim_estimateTransactionFees` received `value = 0xa` (10 wei), all encoded
  arguments, a 333-byte calldata payload, and a complete explicit fee profile;
- `sim_call` received the identical sender, recipient, calldata digest, and
  value without fees;
- `sim_call` with `transaction_hash_variant = latest-finalized` failed with the
  same decoded execution result as `latest-nonfinal`; and
- each response was HTTP 200 with JSON-RPC `execution failed`, receipt result
  `ERROR`, and decoded GenVM result `[EXPECTED] policy is outside its validity
  window`.

This rules out a missing payable value, malformed ABI argument, fee-estimator-
only defect, and latest-state selection issue. The pinned
`genlayer-js 2.0.0-rc.1` implementation encodes the same write inputs for
`simulateWriteContract` and `estimateTransactionFeesForWrite`; it exposes no
supported transaction-datetime override for this call shape. The simulator's
actual datetime is not present in the raw response, so no hidden timestamp is
invented.

The primary blocker is therefore **simulator timestamp-context divergence at
contract execution**. The canonical latest block observed in the follow-up
investigation was `0x6aca9e8d`, timestamp `1791663757`, while the stored policy
window was `1791658016..1794253616`; the chain time was inside the window.
Both simulation variants still failed at the contract guard. The exact
evidence and regression test are documented in
`docs/V23_SIMULATION_FORENSICS.md` and
`tests/v23_case_a_simulation_forensics.test.mjs`.

## Safety result

- No result was assigned to Case A.
- No evidence was committed.
- No semantic adjudication ran.
- No settlement or withdrawal ran.
- No transaction retry or rebroadcast occurred.
- No automatic replacement policy was created.
- No GEN was spent by this stopped qualification attempt beyond the two
  authorized policy transactions already recorded above.

The run journal is
`docs/provenance/live-transactions/rightsrail-v23-live-qualification.json`.
It records `STOPPED_FIRST_FAILURE`, the two successful hashes, and the
pre-broadcast fee-estimation failure.

## Local runner correction

The runner had two local defects that were fixed without changing the contract
or ABI:

1. policy digest journaling attempted to serialize `required_fee_wei` as a
   JavaScript `BigInt`; canonical JSON handling now converts BigInts to decimal
   strings;
2. pre-broadcast fee-estimation failures are now persisted with an explicit
   failure stage before the runner exits.

The runner now also simulates the exact payable Case A write object before fee
estimation and fails closed with
`SIMULATION_EXECUTION_FAILURE_BEFORE_FEE_ESTIMATION` when contract execution
rejects it. It does not add a timestamp, bypass the guard, or broadcast a
transaction after this failure.

Regression coverage: `tests/qualification_runner_utils.test.mjs` and the
existing payable-value tests pass. These fixes do not solve the hosted
simulator timestamp divergence and must not be interpreted as permission to
resume writes.

## Release decision

**NO-GO.** The V2.3 deployment and public PNG evidence host are verified, but
live qualification is incomplete and external GEN delivery has not been
tested. GitHub publication, Portal submission, and any further qualification
writes require a separately authorized resolution of the simulator/runtime
timestamp context and a fresh preflight.
