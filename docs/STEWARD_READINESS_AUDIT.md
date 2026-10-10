# RightsRail steward-readiness audit

Audit scope: V2.3 successor hardening against immutable deployed V1 history.
One authorized V2.3 deployment and the two policy lifecycle writes were
performed; no usage qualification or publication was completed by this audit.

## Baseline and truth boundary

- Historical deployment: `0x984b996079d2591976FcfFb62d0506DF02E0396A`, chain
  `61997`.
- Historical V1 source/ABI hashes are preserved in `README.md`,
  `docs/PREDEPLOY_AUDIT.md`, and transaction provenance.
- V1 canonical state remains one frozen policy and zero request, evidence,
  adjudication, permit, or settlement records.
- V2.3 is deployed at `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F` with one
  frozen policy, zero requests, evidence, adjudications, permits, settlements,
  withdrawals, and accounting allocations. The two audit events are the
  successful policy create and freeze transactions.
- V2.3 source SHA-256:
  `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE`.
- V2.3 official ABI SHA-256:
  `010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B`.

## Findings

| ID | Severity | Affected file / method | Evidence / reproducer | Resolution | Regression | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | CRITICAL | V1 settlement cash custody | `settle_request` allocates claimable/refundable balances but V1 has no withdrawal method | Added candidate pull withdrawals, exact liabilities, claimant binding, and no retry | RC5 economic mocks; distinct-actor domain tests | FIXED locally; V1 paid release BLOCKED |
| AUD-002 | HIGH | `_now`, validity guard | Studio-dev fee simulation rejected an active candidate policy window before the first request; canonical block time was active | Candidate reads `gl.message.raw["datetime"]`, parses UTC Unix seconds, and fails closed | timestamp direct tests; V2.3 fee-estimation journal | BLOCKED by hosted simulator context; no request broadcast |
| AUD-003 | HIGH | accounting conservation | Historical allocation counters did not expose current outstanding liabilities | Candidate adds outstanding claimable/refundable totals | settlement and withdrawal tests | FIXED locally |
| AUD-004 | HIGH | canonical provenance | Canonical provider discarded configured address | Provider now returns configured address and regression asserts it | `tests/ts/rightsrail.test.ts` | FIXED locally |
| AUD-005 | MEDIUM | semantic prompt boundary | Arbitrary policy/request/evidence text was adjacent to instructions | All model-input blocks are explicit untrusted-data delimiters; image text is declared non-instructional | adversarial source regression | FIXED locally |
| AUD-006 | MEDIUM | API test gate | API package test command collected zero tests | Added package-local Vitest config and real tests | `pnpm --filter @rightsrail/api test` | FIXED locally |
| AUD-007 | MEDIUM | controlled identities | UI/store contained wallet-looking local placeholders | Replaced with `CONTROLLED_LOCAL_*` labels | placeholder scan + TS tests | FIXED locally |

## Trust and semantic consensus

The contract keeps deterministic facts outside semantic evaluation, bounds the
leader/validator question to the seven exact booleans, requires the leader
result through `gl.vm.Return`, independently evaluates in the validator, and
parses again after consensus before deriving the deterministic result. The
precedence remains evidence sufficiency, asset applicability, then all five
permission conditions. Parser, duplicate-key, prose, Markdown, wrong-type,
validator disagreement, missing Return, and caller-vector tests pass locally.

Prompt data is explicitly delimited as untrusted. The evaluator is forbidden
from deciding ownership, law, fees, recipient, refunds, or the final result.
No administrator verdict path exists.

## Write lifecycle audit

The frozen V1 has nine writes. The local candidate adds the two withdrawal
writes listed separately.

| Write | Required prior state / caller | Payment / evidence | Mutation and replay rule |
| --- | --- | --- | --- |
| `create_policy` | New ID; issuer is caller | No payment | Creates DRAFT; duplicate ID rejected |
| `update_policy_draft` | DRAFT; issuer is caller | No payment | Edits allowlisted fields only; frozen/closed rejected |
| `freeze_policy` | DRAFT; issuer is caller | No payment | Transitions once to FROZEN; immutable afterward |
| `close_policy` | FROZEN; issuer is caller | No payment | Stops future requests; preserves history |
| `submit_usage_request` | FROZEN, active validity window | `msg.value` exactly frozen fee | Appends request; duplicate ID/digest and wrong value rejected |
| `commit_evidence` | Request `SUBMITTED`, no evidence yet | No payment | Binds immutable media/context facts; overwrite rejected |
| `authenticate_evidence` | Evidence committed | No payment; bounded fetch/consensus | Records append-only auth attempt; only transport failure may be retried |
| `adjudicate_usage` | Evidence committed and latest auth `AUTHENTICATED` | No payment; exact two-image context | First canonical adjudication only; generation increments once |
| `settle_request` | Terminal adjudication; exact request/policy/evidence/generation | No payment | Consumes escrow into exactly one payout/refund; duplicate rejected |
| candidate `withdraw_claimable` | `PAYOUT_ALLOCATED`; frozen recipient caller | No user amount/recipient | Emits exact amount once; V1 does not expose it |
| candidate `withdraw_refund` | `REFUND_ALLOCATED`; requester caller | No user amount/recipient | Emits exact amount once; V1 does not expose it |

There is no UI promise for cancellation, appeal, challenge, or abandoned
escrow because the frozen contract has no such write semantics. Closing a
policy is prospective only and cannot invalidate historical requests,
entitlements, or permits.

## Evidence and multimodal boundary

The semantic context fetches exactly two byte payloads: reference image and
proposed-use image. It verifies status, exact byte length, SHA-256, MIME-bound
source, authenticated request/policy binding, and optional context content or
screenshot digests before `gl.nondet.exec_prompt(prompt, images=[reference,
proposed])`. The direct RC5 harness executes this path with controlled bytes
and four semantic cases. Public URL authority remains separate from content
integrity; a digest proves bytes, not legal ownership.

## Historical project comparison

- ClearLC demonstrates the native recipient interface and exactly-once payout
  or refund accounting; the candidate uses the same RC5-compatible interface
  only after checking local runtime behavior.
- PAVEL establishes the one-state-too-early audit: adjudication cannot precede
  authenticated evidence.
- PALINODE establishes explicit canonical/fixture provenance and no silent
  fallback.
- CharterLock establishes transaction-datetime timestamp parsing.
- Firewall/ClearLC deployment machinery establishes explicit fee/distribution
  preparation; no new transaction is constructed here.

The product is differentiated from originality or similarity systems: the
same protected media can yield different outcomes because RightsRail evaluates
purpose, channel, prohibited context, transformation, attribution, and
endorsement relative to a frozen permission policy.

## Release decision

The local candidate is materially stronger, but the paid-product release is
not steward-ready while the deployed V1 remains allocation-only and the
successor has not been hosted/deployed and independently delivery-reconciled.
The correct next action is a separately authorized successor deployment and
small two-actor live qualification, not a silent mutation of V1.
