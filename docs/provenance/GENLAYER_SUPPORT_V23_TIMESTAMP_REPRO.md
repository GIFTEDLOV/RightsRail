# GenLayer support reproduction: V2.3 timestamp context

Date: 2026-10-11

This is a minimal, read-only reproduction for the Studio-dev validity-window
failure. No Studio-dev write, deployment, qualification, or GEN spend was
performed for this report.

## Frozen inputs

| Field | Value |
| --- | --- |
| Network | Studio-dev |
| Chain ID | `61997` |
| RPC | `https://studio-dev.genlayer.com/api` |
| Contract | `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F` |
| Source SHA-256 | `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE` |
| ABI SHA-256 | `010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B` |
| SDK used for the reproduction | `genlayer-js` from the pinned local SDK path; viem `2.56.9` in the error |
| Runner header | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |

## Canonical policy and chain time

The V2.3 policy at the contract above is:

```text
policy_id   = policy-v23-lumen-finch-001
state       = FROZEN
version     = 1
valid_from  = 1791658016
valid_until = 1794253616
created_at  = 1791661624
frozen_at   = 1791661669
required_fee_wei = 10
```

The read-only latest-block observation used for this report was:

```text
block timestamp raw = 0x6acb2e7c
chain timestamp     = 1791700604
UTC                 = 2026-10-11T06:36:44Z
```

All values are Unix seconds. The deterministic contract comparison is

```text
now < valid_from OR (valid_until != 0 AND now > valid_until)
```

For the values above, `1791658016 <= 1791700604 <= 1794253616`, so the policy
is active under the stored chain-time values.

The older V1 policy values `valid_from=1767225600` and `valid_until=0` belong
to a different historical contract at `0x984b...`, not to this V2.3 policy.
That V1 policy was also read-only simulated and produced the same validity
error.

## Exact reproducible write

The request is the exact V2.3 payable call:

```json
{
  "type": "write",
  "to": "0xfB3335350b0e02ceFb384753990E9B377B4BCB1F",
  "from": "0x61F10Cc252eD98Ce7596c73fC557cCA4cc600c82",
  "functionName": "submit_usage_request",
  "args": [
    "v23-request-case-a",
    "policy-v23-lumen-finch-001",
    "1",
    "Commercial technology newsletter editorial use",
    "newsletter",
    "Independent editorial article with no endorsement or recommendation.",
    "da782460a0de765d49ebcbe4f116cfab0c42b42d3aea99e4bfc3763e5b63f223",
    "52132",
    "image/png",
    "",
    "Image courtesy of Lumen Finch Studio"
  ],
  "kwargs": {},
  "value": "0xa",
  "transaction_hash_variant": "latest-nonfinal",
  "fees": {
    "distribution": {
      "leaderTimeunitsAllocation": "100",
      "validatorTimeunitsAllocation": "200",
      "appealRounds": "0",
      "executionBudgetPerRound": "25000000000000000",
      "executionConsumed": "0",
      "totalMessageFees": "0",
      "rotations": ["3"],
      "maxPriceGenPerTimeUnit": "2",
      "storageFeeMaxGasPrice": "300000000",
      "receiptFeeMaxGasPrice": "300000000"
    },
    "messageAllocations": [],
    "feeValue": "100000000000010352"
  },
  "calldata_bytes": 333,
  "calldata_sha256": "088a5ea348f44b06cdf04f55e3dd6ad34c656b5c6883b4e94b3f3be6c7bb17f8"
}
```

The raw sanitized JSON-RPC request/response, including the encoded calldata,
is preserved at
`docs/provenance/simulations/v23-case-a-simulation.json`.

The same concrete inputs were sent through:

```text
sim_estimateTransactionFees
sim_call, latest-nonfinal
sim_call, latest-finalized
```

Each HTTP response was 200 with a JSON-RPC execution error. The deepest
available execution result decodes to:

```text
[EXPECTED] policy is outside its validity window
```

No `datetime` or equivalent GenVM transaction context was present in any
Studio-dev simulation request or response. The installed SDK exposes no
documented datetime override; no undocumented RPC override was attempted.

## Local evidence

The repository test `tests/direct/test_timestamp_context.py` passes 2 tests
against the exact V2.3 source. It uses the documented direct VM timestamp
context and proves:

- one second before `valid_from` is rejected;
- exactly at `valid_from` is accepted;
- one second after a finite `valid_until` is rejected; and
- `valid_from=0, valid_until=0` is accepted at the Unix epoch.

An isolated GLSim probe was also run through the real `genlayer_py` write path
with `sim_config={"genvm_datetime":"2026-01-01T00:00:00Z"}` prepared for the
state-changing calls. It stopped before contract initialization because the
local RC5 bundle has no entry for the exact pinned runner hash:

```text
runner py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
not under ...\\trees-v2\\v0.6.0-rc5
```

The probe therefore provides a precise local GLSim tooling blocker, not a
semantic or timestamp pass. It did not substitute another runner or alter the
contract header.

## Support question

Please identify the supported Studio-dev/RC5 mechanism for supplying or
observing the GenVM transaction datetime used by `sim_call` and
`sim_estimateTransactionFees`. The canonical chain timestamp is inside the
stored V2.3 window, while both supported simulation variants execute the
contract as if the validity guard were outside that window.

The project remains **NO-GO** for qualification until the exact supported
Studio-dev timestamp context is available and the payable simulation succeeds.
