# Studio-dev read-only integration gate

Date: 2026-10-11

This report records only read-only operations against the deployed V2.3
contract. No request, evidence, adjudication, settlement, withdrawal, or
other blockchain write was broadcast.

## Network and deployed schema

| Check | Result |
| --- | --- |
| RPC | `https://studio-dev.genlayer.com/api` |
| Chain ID | `61997` |
| Contract | `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F` |
| Deployed source SHA-256 | `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE` |
| Local source parity | PASS |
| Public methods | 35 |
| Reads / writes | 23 / 12 |
| `get_audit_events` | ABSENT |
| Semantic schema | `RIGHTSRAIL_USAGE_V1` |
| Semantic keys | exact seven-key list verified |
| Canonical status | one frozen policy; zero requests/evidence/adjudications/permits/settlements |
| Accounting | all zero |

The latest read-only block observed was `0x6acb2a07` with timestamp
`1791699463` (`2026-10-11T06:17:43Z`). This is a chain-time observation only;
it does not authorize a write.

The values `valid_from=1767225600` and `valid_until=0` belong to the separate
historical V1 policy `policy-lumen-finch-001` at
`0x984b996079d2591976FcfFb62d0506DF02E0396A`. The current V2.3 policy at the
address above is `policy-v23-lumen-finch-001` with
`valid_from=1791658016` and `valid_until=1794253616`.

For both policies, the current chain timestamp is not before `valid_from` and
does not exceed a nonzero `valid_until`. The V1 and V2.3 contracts nevertheless
produce the same validity error in the supported Studio-dev simulation path.

## Public evidence retrieval

All five controlled PNG fixtures were fetched as raw bytes and passed:

- HTTP 200;
- `image/png` content type;
- PNG signature `89504e470d0a1a0a`;
- exact manifest byte length; and
- exact manifest SHA-256.

The verified manifest is `provenance/media/live-png-manifest.json`. This proves
content integrity and availability, not ownership or legal authority.

## Case A fee-preflight reproduction

The exact V2.3 Case A payable specification was rerun:

- method: `submit_usage_request`;
- all 11 ABI arguments;
- `kwargs = {}`;
- user value: `10` wei (`0xa` in the RPC payload);
- explicit distribution and positive fee profile;
- calldata: 333 bytes, SHA-256
  `088a5ea348f44b06cdf04f55e3dd6ad34c656b5c6883b4e94b3f3be6c7bb17f8`.

Results:

| Read-only path | Result |
| --- | --- |
| `sim_estimateTransactionFees`, latest-nonfinal | HTTP 200 JSON-RPC error; execution result `ERROR` |
| `sim_call`, latest-nonfinal | HTTP 200 JSON-RPC error; execution result `ERROR` |
| `sim_call`, latest-finalized | HTTP 200 JSON-RPC error; execution result `ERROR` |

The deepest available execution result is:

```text
[EXPECTED] policy is outside its validity window
```

Canonical policy storage and the latest chain timestamp place the policy inside
its stored Unix-seconds window. The simulator response exposes no authoritative
execution datetime and the pinned SDK exposes no safe datetime override. The
result is therefore a runtime timestamp-context divergence. It is not evidence
that payable value was omitted, and no contract time check was weakened.

The raw sanitized artifact remains at
`docs/provenance/simulations/v23-case-a-simulation.json`; analysis is in
`docs/V23_SIMULATION_FORENSICS.md`.

## Integration claims and blockers

| Capability | Status | Why |
| --- | --- | --- |
| Public evidence fetching | PASS read-only |
| Deployed source/schema parity | PASS read-only |
| Fee estimation for payable request | BLOCKED by simulator execution failure |
| Validator consensus | NOT RUN; no authenticated evidence/request exists |
| Policy-window settlement | NOT RUN; no request/adjudication exists |
| GEN accounting | PASS read-only zero-state only; no delivery claim |
| V2.4 `get_audit_events` client integration | BLOCKED; candidate source/ABI unavailable |

## Local schema-tool limitation

The tracked V2.3 ABI remains hash-verified, and the project validation and
typecheck gates pass. A fresh local `genvm-lint schema` invocation could not
load the declared RC5 runner because that runner archive is absent from the
local GenVM cache (`E101`). This is a tooling-cache limitation, not evidence of
an ABI mismatch; the deployed Studio-dev schema was read successfully and
matches the tracked 35-method V2.3 ABI.

No semantic result, permit, settlement, payout, refund, or delivered payment
is claimed. A future live qualification requires a separately authorized write
plan after the exact simulator/runtime blocker is resolved.

## Local GLSim timestamp probe

The exact V2.3 source was exercised through an isolated localhost GLSim
attempt using the installed `genlayer_py` transaction path and the documented
`sim_config.genvm_datetime` mechanism. GLSim started, but exact deployment
stopped before contract initialization because the local RC5 runner tree does
not contain the source header's pinned `py-genlayer:5jyc...` runner. The probe
did not substitute another runner or modify the source. This is recorded in
`docs/LOCAL_GLSIM_TIMESTAMP_EVIDENCE.md` and the support reproduction at
`docs/provenance/GENLAYER_SUPPORT_V23_TIMESTAMP_REPRO.md`.

The direct RC5 timestamp-context suite remains passing for exact-start,
pre-start, post-expiry, and `0/0` windows. That local evidence does not clear
the hosted Studio-dev simulation gate.
