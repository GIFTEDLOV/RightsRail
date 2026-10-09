# Phase 2.5 — Studio-dev runtime qualification

This qualification is local-only. No deployment, faucet, broadcast, hosted
write, GitHub push, Vercel project, or GEN spend was performed.

## Compatibility matrix

| Project | Studio-dev evidence | Header/runtime family | Consensus shape |
|---|---|---|---|
| ClearLC | hosted schema and deployment lineage | `py-genlayer:5jyc...`, GenVM `v0.6.0-rc5` | `gl.vm.run_nondet_default`, `gl.vm.Return` |
| Firewall | hosted exact-source schema and deployment lineage | `py-genlayer:5jyc...`, GenVM v0.6 RC family | `gl.vm.run_nondet`, `gl.vm.Return` |
| CharterLock | hosted deployment lineage | `py-genlayer:latest`, older v0.6 RC family | `gl.vm.run_nondet`, `gl.vm.Return` |
| RightsRail before | hosted schema probe failed | `py-genlayer:1jb45...`, GenVM `v0.2.16` | incompatible with current Studio-dev |
| RightsRail after | hosted exact-source schema passed | `py-genlayer:5jyc...`, GenVM `v0.6.0-rc5` | RC5 `run_nondet_default`, strict Return path |

The source changes were limited to the proven current SDK namespace, storage
types, RC5 clock surface, nondeterministic primitive, and native transfer API.
No policy or trust-boundary rule was redesigned.

## Hosted zero-write evidence

The old exact source was submitted to `gen_getContractSchemaForCode` on
`https://studio-dev.genlayer.com/api` and returned HTTP 200 with JSON-RPC
`VM_ERROR: invalid_contract runner malformed`. This is authoritative evidence
that `1jb45...` is not current Studio-dev compatible.

The migrated exact source returned a schema successfully: 27 public methods,
18 read methods, and 9 write methods. This is authoritative schema evidence,
not deployment evidence. A legacy SDK probe observed `data="00"` without a
structured receipt; that value is supporting only. No safe no-wallet contract
address `gen_call` write simulation was exposed by the installed SDK, so no
such call was guessed.

## Trust and authority

- No global owner or issuer override exists after freeze.
- Callers provide facts and evidence bindings, never semantic booleans or a verdict.
- The leader strict-parses exactly the seven booleans before returning.
- The validator requires `gl.vm.Return`, strict-parses the leader result,
  independently evaluates the same canonical question, strict-parses its own
  result, and compares only the seven booleans.
- Post-consensus strict parsing happens again before generation/state mutation.
- Malformed model output, validator disagreement, fetch failure, invalid
  content, and authentication failure are not business results.

## Multimodal and evidence qualification

The direct RC5 suite exercised four cases with two bounded image inputs:

| Case | Result | Permit |
|---|---|---|
| compliant editorial use + attribution | `PERMITTED` | yes |
| betting context + implied endorsement | `DENIED` | no |
| insufficient semantic evidence | `INCONCLUSIVE` | no |
| unrelated proposed asset | `NOT_APPLICABLE` | no |

Each case authenticated reference/proposed bytes against SHA-256 and exact
length, then explicitly replayed the captured validator. The test-only direct
adapter deep-copies leader results because the gltest mock otherwise aliases a
dict that production calldata serialization would isolate.

## Economic qualification

Phase 2.5 qualified the frozen fee and recipient bindings. Phase 2.6 replaces
external transfer attempts with canonical internal entitlement allocation. The
new direct suite verifies exact payout/refund ledgers, zeroed request escrow,
one permit only on `PERMITTED`, conservation counters, zero-fee safety, and
second-settlement rejection. No model output controls value or recipient.

Withdrawal/delivery execution is intentionally not implemented. There is no
automatic retry because an unknown external delivery result could double-pay.

## Phase 2.6 accounting delta

The candidate now exposes 30 public methods: 21 reads and 9 writes. The three
additional reads are `get_claimable`, `get_refundable`, and
`get_accounting_status`. The RC5 runner/header and semantic consensus path are
unchanged. `settle_request` has no `emit_transfer` path. Canonical settlement
is `PAYOUT_ALLOCATED` or `REFUND_ALLOCATED`, with request-level escrow
consumption and aggregate conservation counters.

## One-state-too-early and replay

The deterministic suite covers draft-only edits, draft-only freeze,
frozen-only close/request, submitted-only evidence, authenticated evidence
before adjudication, terminal adjudication before settlement, generation
monotonicity, duplicate request digest, evidence overwrite, duplicate
adjudication, duplicate permit, duplicate settlement, and binding mismatches.

## Tooling record

- CLI: `0.40.0-rc.3`
- `genlayer-py`: `0.19.0rc2`
- `genlayer-test/gltest`: `0.30.0rc2`
- `genlayer-js`: `2.0.0-rc.1`
- `genvm-linter`: `0.11.1rc2`
- Pyright: `1.1.414`
- Python: `3.14.3`
- Node: `v24.14.0`
- pnpm: `11.0.9`
- GenVM: `v0.6.0-rc5`

The project-local direct runner uses `.genlayer-cache` to avoid the shared
Windows extraction-tree lock. The cache is ignored and is not protocol state.
Windows RC5 direct tests pass with that isolated cache; the same direct smoke,
multimodal, and economic suites also pass under WSL Ubuntu 24.04 (`8 passed`)
without any network write path.
