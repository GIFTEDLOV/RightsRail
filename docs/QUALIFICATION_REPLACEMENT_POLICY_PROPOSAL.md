# Qualification Replacement Policy Proposal

Status: **OFF-CHAIN PREPARATION ONLY**. No policy was created, frozen, or
broadcast by this proposal.

## Why this proposal exists

The frozen `policy-lumen-finch-001` is active under canonical Studio-dev time,
but the read-only `submit_usage_request` simulation fails inside RightsRail's
validity guard. The exact simulator clock is not exposed. This candidate keeps
the rights semantics unchanged and removes only the temporal lower-bound
dependency that the simulator cannot currently validate.

The existing policy remains historical and visible. It is not edited or
replaced automatically.

## Candidate

| Field | Candidate value |
| --- | --- |
| Policy ID | `policy-lumen-finch-qualification-002` |
| Asset source | `https://rightsrail-evidence.vercel.app/reference.svg` |
| Asset SHA-256 | `0fac13cbd9597297d4de5f4b656a9dc97cf6b2d43a866347b5c14ef5de57d3ef` |
| Asset bytes | `1325` |
| Asset MIME | `image/svg+xml` |
| License text | `Commercial editorial/web use; attribution required.` |
| License text SHA-256 | `01e9d1cf3aef0839bdb2686808945626425baea5fe6183158032ef87494cb037` |
| Required fee | `10` wei |
| Settlement recipient | `0x33653e6e86807e41682d3346cdf648d6653384b1` |
| `valid_from` | `0` Unix seconds |
| `valid_until` | `0` (no expiry) |
| Candidate policy digest | `214a949d35aec64e1a4096495187d97efaa98a246ea52883bdbca6527b019af5` |

The candidate preserves:

- commercial editorial, technology newsletter, and web article purposes;
- article, editorial web, and newsletter channels;
- cropping and color changes;
- mandatory visible attribution;
- prohibitions on gambling promotion, betting advertisement, impersonation,
  and synthetic endorsement.

`valid_from=0` is accepted by the frozen contract's policy-field validator and
is the smallest off-chain candidate that remains active even if the simulator
uses an undocumented pre-2026 execution timestamp. This is a proposal, not a
claim that the simulator issue is fixed.

## Required authorization before any use

Explicit approval is required before:

1. a read-only simulation of the candidate's create call is treated as
   sufficient evidence;
2. `create_policy` is broadcast;
3. `freeze_policy` is broadcast;
4. any qualification request is submitted against the candidate.

The original authorized 20-write continuation cannot be reused automatically
for a different policy. A replacement policy would require a new, explicit
qualification authorization and a fresh nonce/fee preflight.

## Economic and delivery boundary

The candidate uses the same `10` wei escrow and frozen settlement recipient.
RightsRail settlement remains internal entitlement allocation. Withdrawal and
external GEN delivery are not implemented; no funds may be described as
delivered.
