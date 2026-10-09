# RightsRail Phase 4A — Predeployment Audit

**Status:** preparation only. No deployment, signing, broadcast, contract write,
funding, faucet use, or GEN spending was performed.

**Audit date:** 2026-10-09

## Frozen artifacts

The source and generated ABI were verified before and after the local release
suite. Both remain byte-for-byte unchanged.

| Artifact | Value |
| --- | --- |
| Contract | `contracts/rightsrail.py` |
| Contract bytes | `58,413` |
| Contract SHA-256 | `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B` |
| ABI | `artifacts/rightsrail.abi.json` |
| ABI SHA-256 | `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB` |
| Dependency header | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| GenVM | `v0.6.0-rc5` |
| Semantic schema | `RIGHTSRAIL_USAGE_V1` |
| Public methods | `30` (`21` reads, `9` writes) |

The exact semantic keys are:

`asset_match`, `purpose_within_scope`, `prohibited_context_present`,
`transformation_within_scope`, `attribution_satisfied`, `endorsement_implied`,
`evidence_sufficient`.

Read methods:

`contract_info`, `get_accounting_status`, `get_adjudication`,
`get_adjudication_ids`, `get_claimable`, `get_evidence`, `get_evidence_ids`,
`get_permit`, `get_permit_ids`, `get_permit_status`, `get_policy`,
`get_policy_ids`, `get_policy_version`, `get_refundable`, `get_request`,
`get_request_ids`, `get_semantic_keys`, `get_semantic_schema`, `get_settlement`,
`get_settlement_ids`, `get_status`.

Write methods:

`adjudicate_usage`, `authenticate_evidence`, `close_policy`, `commit_evidence`,
`create_policy`, `freeze_policy`, `settle_request`, `submit_usage_request`,
`update_policy_draft`.

## Local engineering gate

`pnpm install --frozen-lockfile` completed successfully.

| Gate | Result |
| --- | --- |
| Ruff `0.16.10` | PASS |
| mypy `2.4.0` | PASS — 13 source files |
| Python compile | PASS |
| Python tests | PASS — 57 tests, 18 subtests |
| GenVM lint | PASS through project wrapper; 5 expected E010 reachability warnings |
| GenVM validate | PASS — 30 methods, 21 views, 9 writes, zero constructor parameters |
| GenVM typecheck | PASS — zero diagnostics |
| Schema generation | PASS — frozen ABI hash restored |
| TypeScript typecheck | PASS |
| TypeScript tests | PASS — 10 tests |
| Browser E2E | PASS — 24 tests across 390, 768, 1280, and 1440 viewports |
| Production frontend/API build | PASS |
| Route inventory | PASS through TypeScript test suite |
| Fixture/canonical separation | PASS through provider/API tests |
| Secret scan | PASS — no private-key, mnemonic, API-key, or secret-key assignments found |

The root `pnpm run test:pytest` entry point is not usable on this Windows
machine because `pytest` is not on the shell PATH. The same project-local
environment passed using:

```text
.venv\Scripts\python.exe -m pytest -q
```

This is a tooling PATH issue, not a test failure.

## Studio-dev read-only qualification

| Item | Result |
| --- | --- |
| RPC | `https://studio-dev.genlayer.com/api` reachable |
| Chain ID | `61997` (`0xf22d`) |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| SDK family | `genlayer-js 2.0.0-rc.1` in the known-good CharterLock Studio-dev client |
| Python SDK | `genlayer-py 0.19.0rc2` |
| CLI | `0.40.0-rc.3` |
| GenVM linter | `0.11.1rc2` |
| Studio-dev block observed | `0x6ac8d96b` at the final read-only check |

Direct read-only RPC calls returned the expected chain ID and an enabled fee
configuration. The current default fee configuration reported:

```json
{
  "leaderTimeunitsAllocation": "100",
  "validatorTimeunitsAllocation": "200",
  "appealRounds": "0",
  "executionBudgetPerRound": "76548000000000",
  "rotations": ["0"],
  "maxPriceGenPerTimeUnit": "2",
  "storageFeeMaxGasPrice": "300000000",
  "receiptFeeMaxGasPrice": "300000000",
  "feeValue": "76548000002588"
}
```

The hosted zero-write `gen_getContractSchemaForCode` check succeeded through
the known-good JS RC client. It recognized the frozen source as a contract with
30 methods: 21 reads and 9 writes. No transaction request was signed or sent.

## Deployer and funding status

Under the revised Phase 4B authorization, the already configured and
Studio-dev-tested account was selected for preparation only. No private key,
mnemonic, password, or keystore secret was read or recorded.

```text
ACCOUNT_NAME: firewall-only
ADDRESS: 0x33653e6e86807e41682d3346cdf648d6653384b1
ACCOUNT_STATUS: active, unlocked, Studio-dev chain 61997
LATEST_NONCE: 11
PENDING_NONCE: 11
BALANCE_WEI: 1299053337749989776
BALANCE_GEN: 1.299053337749989776
```

The latest and pending nonce agree. This snapshot is not deployment nonce
authorization. Both values must be read again immediately before any future
authorized broadcast.

## Future deployment request

The future request must be prepared through the proven JS SDK explicit-fee
path, not a CLI default path. This is a normalized template only; it has no
The sender is the selected existing account, but the nonce remains a runtime
placeholder and the request was not signed.

```json
{
  "chainId": 61997,
  "rpc": "https://studio-dev.genlayer.com/api",
  "sourceSha256": "C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B",
  "runner": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng",
  "sender": "0x33653e6e86807e41682d3346cdf648d6653384b1",
  "nonce": "<READ_IMMEDIATELY_BEFORE_SIGNING>",
  "userValue": "0",
  "fees": {
    "distribution": {
      "leaderTimeunitsAllocation": "100",
      "validatorTimeunitsAllocation": "200",
      "appealRounds": "0",
      "executionBudgetPerRound": "76548000000000",
      "executionConsumed": "0",
      "totalMessageFees": "0",
      "rotations": ["0"],
      "maxPriceGenPerTimeUnit": "2",
      "storageFeeMaxGasPrice": "300000000",
      "receiptFeeMaxGasPrice": "300000000"
    },
    "feeValue": "76548000002588"
  }
}
```

The fee value is positive and is approximately `0.000076548000002588 GEN`.
The exact fee configuration must be refreshed immediately before any future
deployment and qualification transaction. SDK defaults must not be used.

## Planned writes and economic qualification

The planned qualification minimum is:

```text
DEPLOYMENT_WRITES: 1
QUALIFICATION_WRITES: 22
TOTAL_PLANNED_WRITES: 23
```

The 22 qualification writes are one policy creation, one policy freeze, four
request submissions, four evidence commits, four evidence authentications,
four adjudications, and four settlements.

Using the current read-only fee value as a conservative baseline:

| Estimate | Wei | Approximate GEN |
| --- | ---: | ---: |
| Deployment | `76548000002588` | `0.000076548000002588` |
| 22 qualification writes | `1684056000056936` | `0.001684056000056936` |
| Baseline total | `1760604000059524` | `0.001760604000059524` |
| 25% safety buffer | `440151000014881` | `0.000440151000014881` |
| Required planning balance | `2200755000074405` | `0.002200755000074405` |

This is a planning estimate, not a guarantee of final execution cost. Each
future write, especially semantic adjudication, must be freshly estimated and
must use explicit fees.

The controlled policy uses a deliberately small nonzero fee of `10` wei. Four
requests therefore require `40` wei of total escrow. The contract requires
exact escrow equality with the frozen policy fee. No live escrow was sent.

With the current read-only balance, the planning requirement is already
covered:

```text
BALANCE_AVAILABLE: 1299053337749989776 wei
TOTAL_REQUIRED: 2200755000074405 wei
FUNDING_REQUIRED: NO
FUNDING_DEFICIT: 0 wei
```

## Controlled live qualification plan

The four cases use the original RightsRail fictional asset and one frozen
policy. They are plans only; none has been submitted.

| Case | Input | Expected result | Expected entitlement | Permit |
| --- | --- | --- | --- | --- |
| A | Same reference asset, editorial/newsletter use, allowed transformation, attribution present | `PERMITTED` | `PAYOUT_ALLOCATED` to frozen settlement recipient | Yes |
| B | Same reference asset, betting advertisement, implied endorsement | `DENIED` | `REFUND_ALLOCATED` to requester | No |
| C | Evidence missing or unusable for semantic evaluation | `INCONCLUSIVE` | `REFUND_ALLOCATED` to requester | No |
| D | Unrelated asset with sufficient evidence | `NOT_APPLICABLE` | `REFUND_ALLOCATED` to requester | No |

Canonical proof ends at entitlement allocation. The frozen contract has no
withdrawal implementation, so this plan makes no claim that an issuer or
requester has externally received GEN.

## Evidence hosting plan

The five project-created SVG fixtures were published to the evidence-only
static host `https://rightsrail-evidence.vercel.app`. The RightsRail
application was not deployed. Each public response returned HTTP 200 and
`image/svg+xml`; the downloaded bytes exactly matched the local fixture bytes
and SHA-256.

| Fixture | Local source | Public URL | Bytes | SHA-256 | MIME |
| --- | --- | --- | ---: | --- | --- |
| Reference | `apps/web/public/demo/reference.svg` | `https://rightsrail-evidence.vercel.app/reference.svg` | `1325` | `0FAC13CBD9597297D4DE5F4B656A9DC97CF6B2D43A866347B5C14EF5DE57D3EF` | `image/svg+xml` |
| Case A | `apps/web/public/demo/proposed-editorial.svg` | `https://rightsrail-evidence.vercel.app/proposed-editorial.svg` | `1842` | `4A6B49323FB5BC1E64A47129E73311EA3A6255300E77C76B94AF19968D2D1627` | `image/svg+xml` |
| Case B | `apps/web/public/demo/proposed-betting.svg` | `https://rightsrail-evidence.vercel.app/proposed-betting.svg` | `1389` | `788338F4D84AC1A020B1774B6E06EEA1BB259F5E119E1D9235159654A5C98517` | `image/svg+xml` |
| Case C | `apps/web/public/demo/proposed-missing-context.svg` | `https://rightsrail-evidence.vercel.app/proposed-missing-context.svg` | `1180` | `F70930915E70D3B23BE250E38F6D16FB68B006639E2967B2C3A0E701C38ACE69` | `image/svg+xml` |
| Case D | `apps/web/public/demo/unrelated.svg` | `https://rightsrail-evidence.vercel.app/unrelated.svg` | `888` | `2CCF22846EE7DF949ED64A61F7775ECBAA0A8A2EE93DD4C5099E9A9117312D89` | `image/svg+xml` |

The published manifest is
`https://rightsrail-evidence.vercel.app/manifest.json`, with `2351` bytes and
SHA-256
`7114DAD3B100993B17DEEA40EE3A7D048E75B27568EDAC8DA1C2DD53600205DA`.
The complete table is recorded in
[`docs/LIVE_QUALIFICATION_EVIDENCE.md`](LIVE_QUALIFICATION_EVIDENCE.md).

## Result-shopping and reconciliation rules

The first successful canonical adjudication for a request is authoritative.
There is no semantic retry because a result is undesirable. `NO_MAJORITY`,
validator disagreement, infrastructure failure, and execution error remain
infrastructure outcomes; none may be reinterpreted as a business result.

The future deployment lifecycle is:

```text
PRECONDITION_READ
→ PREPARE_EXACT_REQUEST
→ VERIFY_SOURCE_HASH
→ VERIFY_RUNNER
→ VERIFY feeValue > 0
→ VERIFY_DISTRIBUTION
→ VERIFY_NONCE
→ SIGN
→ BROADCAST_EXACTLY_ONCE
→ PERSIST_EXACT_HASH
→ RECONCILE_SAME_HASH
→ WAIT_FINALITY
→ CHECK_EXECUTION_RESULT
→ REQUIRE FINISHED_WITH_RETURN
→ EXTRACT_CANONICAL_CONTRACT_ADDRESS
→ READ_CONTRACT_BACK
→ VERIFY 30 METHODS / SCHEMA / SEVEN KEYS / EMPTY INITIAL STATE
```

Finality alone is not deployment success. An unexplained nonce movement or
transaction-hash mismatch stops reconciliation.

## Canonical provider activation

The product remains `CONTROLLED_LOCAL` with `canonical: false` and an explicit
`CONTROLLED LOCAL QUALIFICATION` label. It must not be switched during this
phase.

After a successful deployment and canonical readback, the activation sequence
is:

1. Set `RIGHTSRAIL_PROVIDER_MODE=GENLAYER_CANONICAL`.
2. Configure the returned contract address, chain ID `61997`, and the exact
   Studio-dev RPC.
3. Require the canonical provider to have all three values before reads.
4. Read status, method/schema metadata, and empty initial state from the
   deployed address.
5. Keep the controlled fixture provider separately selectable; never silently
   fall back from canonical reads to fixtures.

## Known limitations and authorization boundary

- The selected account is an existing account named `firewall-only`; it is used
  only under the explicit revised Phase 4B preparation authorization.
- The evidence host is a separate evidence-only static project and does not
  represent a deployed RightsRail contract or canonical application.
- RightsRail has no deployed contract address.
- `genlayer-js 2.0.0-rc.1` is available in the known-good CharterLock client,
  not as a direct RightsRail dependency; the proven SDK path is documented and
  was used only for a zero-write schema request.
- The contract's withdrawal/delivery layer is not implemented; settlement is
  entitlement allocation only.
- This audit uses the current fee configuration as a planning baseline. Fresh
  fee estimation is required immediately before every future write.

The deployment authorization boundary is intentionally still closed. No
blockchain write occurred in Phase 4B.
