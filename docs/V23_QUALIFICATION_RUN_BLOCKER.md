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
