# RightsRail Qualification Validity Failure

Status: read-only forensic closure. No Case A transaction was broadcast in this investigation.

This document is a historical V1 record. The local successor candidate no
longer uses the wall-clock `_now()` implementation described below; it parses
the deterministic GenLayer transaction datetime and records separate candidate
hashes in `docs/RELEASE_GATE.md`. The deployed V1 and this failure record are
unchanged.

## Canonical policy

| Field | Canonical value |
| --- | --- |
| Contract | `0x984b996079d2591976FcfFb62d0506DF02E0396A` |
| Chain | Studio-dev, `61997` |
| Policy ID | `policy-lumen-finch-001` |
| State | `FROZEN` |
| Version | `1` |
| Policy digest | `000eb5c5c730c5b3d739f254255ba6b050c59288b87f4f1fb07887e430046fae` |
| Required fee | `10` wei |
| Settlement recipient | `0x33653e6e86807e41682d3346cdf648d6653384b1` |
| `valid_from` | `1767225600` |
| `valid_until` | `0` (no expiry) |
| `created_at` | `1791590810` |
| `frozen_at` | `1791590981` |

Policy creation and freeze are preserved in the live qualification journal:

- create: `0x4f440697e0aacc8bd046a136be176c755cb5a3f005cae31bc02e151847259715`
- freeze: `0xea385f9581088e9c49278c7b8e1980cf1948e386510422fc23f145b7c35bb989`

The canonical state remains one frozen policy and zero requests, evidence,
adjudications, permits, or settlements.

## Time normalization

RightsRail stores Unix seconds. The contract's `_now()` is:

```python
int(datetime.now(UTC).timestamp())
```

The request guard is:

```python
if now < policy["valid_from"] or (
    policy["valid_until"] != 0 and now > policy["valid_until"]
):
    _fail("policy is outside its validity window")
```

The latest read-only Studio-dev block returned:

- raw timestamp: `0x6ac9df7b`
- normalized timestamp: `1791614843` seconds
- UTC: `2026-10-10T06:47:23Z`

The local system snapshot during this investigation was
`2026-10-10T07:51:00.6795388+01:00` (`1791615060` Unix seconds).

Normalized comparison:

| Value | Unix seconds | UTC |
| --- | ---: | --- |
| `valid_from` | `1767225600` | `2026-01-01T00:00:00Z` |
| `valid_until` | `0` | no expiry sentinel |
| chain `now` | `1791614843` | `2026-10-10T06:47:23Z` |

Therefore the policy is already active and has no expiry. It is not a
seconds/milliseconds conversion error, a future `valid_from`, or an expired
policy.

## Creation-input reconstruction

The successful create transaction journal records the exact inputs:

- `valid_from = 1767225600`
- `valid_until = 0`
- transaction nonce: `23`
- user value: `0`

The RightsRail qualification runner supplies these as explicit Unix-second
fixture integers. They do not come from `Date.now()`, local wall-clock time,
or a millisecond conversion. The source was therefore a hard-coded fixture
timestamp in seconds (`A_POLICY_INPUT_BUG` rejected).

## Read-only simulation result

The exact Case A `submit_usage_request` write specification was simulated with:

- request ID: `request-live-case-a`
- policy ID: `policy-lumen-finch-001`
- policy version: `1`
- proposed asset SHA-256: `4a6b49323fb5bc1e64a47129e73311ea3a6255300e77c76b94af19968d2d1627`
- proposed bytes: `1842`
- user value: `10` wei
- method kwargs: `{}`

The SDK call was read-only. Studio-dev returned:

```text
sim_estimateTransactionFees: execution failed
GenVM result: [EXPECTED] policy is outside its validity window
```

The receipt-level diagnostic also showed `user_value=10` and RPC value
encoding `0xa`. The failure occurs at the validity-window guard before the
contract evaluates `gl.message.value`. No Case A request was created.

The public runner recorded the same result as
`FEE_ESTIMATION_FAILURE_BEFORE_BROADCAST`; the canonical request count remains
zero.

## Root-cause classification

Primary classification: **F_SIMULATOR_TIMESTAMP_BUG**.

Evidence:

1. Canonical storage says `valid_from` is in the past and `valid_until=0`.
2. The latest Studio-dev chain timestamp is in the active interval.
3. The contract guard is seconds-based and logically accepts that normalized
   chain value.
4. The exact read-only Studio-dev fee simulation nevertheless fails inside
   that guard.
5. The simulation response exposes the contract error but no canonical
   simulator timestamp. Therefore the exact hidden simulator clock cannot be
   numerically recovered from the available response; the observed behavior
   proves a time-context divergence, not an expiry.

This is not classified as `D_LOCAL_TIME_CHAIN_TIME_MISMATCH` as the primary
category because the failing observation is the Studio-dev simulation context,
not the local machine clock. The contract's use of `datetime.now(UTC)` is the
boundary that permits that context divergence.

## Comparison with known projects

- ClearLC stores Unix-second values and its Studio-dev qualification runner
  reads `eth_getBlockByNumber("latest")`, then derives deadlines from that
  chain timestamp. Its contract also uses UTC `datetime.now(...).timestamp()`.
- Firewall does not read an internal clock for its frozen timestamp; the
  caller supplies an integer `frozen_at`, and permit status receives an
  explicit integer `now`.
- CharterLock parses the GenLayer transaction datetime from
  `gl.message.raw["datetime"]` and converts it to Unix seconds inside
  `_now_seconds()`.

These comparisons confirm the established representation is Unix seconds.
They do not authorize changing the frozen RightsRail contract in this phase.

## Policy recoverability

`POLICY_1_RECOVERABLE = YES` as a policy-state determination:

- no policy mutation is required;
- the stored interval is active now;
- `valid_until=0` prevents expiry during qualification.

Operationally, qualification remains blocked. The earliest legitimate chain
resume time is already satisfied: `1791614843` or later. Do not resume until a
read-only Studio-dev simulation or an equivalent runtime qualification proves
that the execution context evaluates the same active interval. Waiting for the
chain to reach a future timestamp is not a remedy because the policy is already
active and unbounded.

No replacement policy is required or prepared in this phase. A replacement
would not fix the demonstrated simulator time-context defect and would require
new authorized writes.

Replacement fields: `N/A`.

## Shared-signer nonce drift

The local LicenseProof qualification ledger accounts for every nonce from 25
through 41. These are external shared-signer transactions, not RightsRail
writes:

| Nonce | Transaction | Project / purpose | Status |
| ---: | --- | --- | --- |
| 25 | `0xa12c9d49620dd5f3661f0af84347cda901851dd067259c1565f36bb996ba57f8` | LicenseProof Case A `adjudicate_component` | FINALIZED / SUCCESS |
| 26 | `0xe2434beb51e083e2553aea20815b6d9fc0fef774055b19d1323da99fe5fb1cff` | LicenseProof Case A `finalize_manifest` | FINALIZED / SUCCESS |
| 27 | `0x26e0b3d1cec20fb82b3a6d2155a08deb0d800b36d35de67372298beb0d744f36` | LicenseProof Case B `create_manifest` | FINALIZED / SUCCESS |
| 28 | `0xeabd2544d1c1e6810b9aaa9100ae591e5ab5c57972b81fea1595d6f1f2bdca75` | LicenseProof Case B `add_component` | FINALIZED / SUCCESS |
| 29 | `0xec221bae398e808a2e948641868aa3691bcc5c0bfd48d60db5c7d6477a11ab52` | LicenseProof Case B `commit_license_evidence` | FINALIZED / SUCCESS |
| 30 | `0xe865ce37234849180c56c8c22fc530032870a7652a2a1bb1b4bf4f4a20712099` | LicenseProof Case B `freeze_manifest` | FINALIZED / SUCCESS |
| 31 | `0xe780d38817fec450cce3163969aee4a3f5dfbfab04a5443abd7d57325ab542d6` | LicenseProof Case B `begin_component_review` | FINALIZED / SUCCESS |
| 32 | `0xbe6f18e0ab0d1df67f96c4762eeedc077cfb1816291b34bb7db57d5ae8ccf2c6` | LicenseProof Case B `adjudicate_component` | FINALIZED / SUCCESS |
| 33 | `0x3ae13a6913f9d458cddd302432431107866b91311e7d36c7cd6c0a74ab63dc2c` | LicenseProof Case B `finalize_manifest` | FINALIZED / SUCCESS |
| 34 | `0x7b9283b68e1c120ac38c7e4bee8c82b2ec99ba3294be11795e9e34d436ff5e3c` | LicenseProof Case C `create_manifest` | FINALIZED / SUCCESS |
| 35 | `0xe4aeed5db1d3acd02a7ed85769b2e6cd7d1b0d5fa3db2183a7cac26c63a067d8` | LicenseProof Case C `add_component` | FINALIZED / SUCCESS |
| 36 | `0xd3d1a911dc758a0c82ec4730e6f81179255ec5e65e1eaaca9811fc3502bd86bd` | LicenseProof Case C `commit_license_evidence` | FINALIZED / SUCCESS |
| 37 | `0x4fca2839d03cc05d3ccdb4f28106ca2e348409ca9486a9298f5c3ead0b86a96a` | LicenseProof Case C `freeze_manifest` | FINALIZED / SUCCESS |
| 38 | `0x807d8cedce9f559c1cb9c6b285aff61934e07f36e1aeaa852ff33edb866ad811` | LicenseProof Case C `begin_component_review` | FINALIZED / SUCCESS |
| 39 | `0x0d253e540f555a8282fb857dbc0906f2e5426d45940f493b4536a9211eb44c92` | LicenseProof Case C `adjudicate_component` | FINALIZED / UNDETERMINED / MAJORITY_DISAGREE |
| 40 | `0xe888d147a3b562f64813feb8cf73dbf48d4c5ddfa700eb6d7658b125a883254f` | LicenseProof Case C authorized adjudication retry | FINALIZED / SUCCESS |
| 41 | `0x8b31387ebcfaf6a57f2e9cd377af173627fd531ccdd454ed75100fc76072ae95` | LicenseProof Case C `finalize_manifest` | FINALIZED / SUCCESS |

The latest/pending signer nonce observed after the previous read-only recovery
was `42/42`. Before any future RightsRail write, latest and pending must be
read again immediately before construction and signing. A nonce change between
preparation and signing invalidates the prepared transaction; discard and
rebuild it.

## Authorization boundary

This investigation performed zero blockchain writes and spent zero GEN. It did
not create a replacement policy or broadcast Case A. The frozen contract and
ABI remain unchanged:

- contract SHA-256: `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B`
- ABI SHA-256: `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB`

Next authorization must explicitly choose one of the following:

1. authorize a runtime/simulator investigation or supported timestamp-context
   correction without changing the frozen contract; or
2. if a source change is later proven necessary, authorize a new candidate
   with a new source hash and separate deployment/qualification plan.

No qualification write is authorized by this document.
