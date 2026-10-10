# RightsRail — Intelligent Contract submission handoff (contract-only)

**Scope:** GenLayer standalone Intelligent Contract. A frontend is NOT a technical prerequisite for the contract to execute. Do not represent the separate controlled-local frontend as a live product.

**Status:** V2.3 SOURCE HARDENED AND DEPLOYED; **QUALIFICATION / SUBMISSION BLOCKED**. The historical V1 contract remains immutable and cannot serve as proof for this successor. The five PNG evidence URLs are now public and byte-verified. The authorized V2.3 run finalized policy creation and freezing, then stopped before the first request because Studio-dev fee simulation rejected the exact payable call.

## Candidate identity

- Contract: `contracts/rightsrail.py`; class `RightsRail`; version `2.3.0`.
- Pinned runner: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`.
- Package source SHA-256: `651CA9042885F01D4EF0A6C67E8A5AEF54957AB11C5860FAD260872BD8640B5D`.
- Deployed V2.3 source SHA-256: `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE`.
- Official GenVM ABI SHA-256: `010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B`; 35 public methods, 23 read / 12 write.
- Chain intended: GenLayer Studio-dev `61997`; RPC `https://studio-dev.genlayer.com/api`.
- Historical V1 deployed contract **(not this candidate)**: `0x984b996079d2591976FcfFb62d0506DF02E0396A`.
- V2.3 deployed contract: `0xfB3335350b0e02ceFb384753990E9B377B4BCB1F`; deployment transaction: `0xb72fcde704b994982892a88ef45d51bc2133625c80f5c405f1bf838cced83dde`; execution: `FINALIZED / FINISHED_WITH_RETURN`.
- GEN escrow: specified by a frozen policy; consensus derives PERMITTED / DENIED / INCONCLUSIVE / NOT_APPLICABLE from exactly seven booleans. Terminal PERMITTED allocates to the issuer-selected recipient; the other terminal results allocate a requester refund. Refund for unadjudicated requests is separately guarded by an invalid-evidence or seven-day grace condition. `emit_transfer` is not external delivery confirmation.

## Verification performed

- Python suite: **85 passed; 18 subtests**.
- Node/TypeScript/API/deployment verification: PASS; deployment runner tests **11 passed**, TypeScript tests **13 passed**, API tests **2 passed**.
- Official RC5 `genvm-lint validate`, `typecheck`, and `schema`: PASS. Lint emits only the known E010 nondeterministic-call diagnostics.
- Browser E2E: **28 passed**; production build: PASS; screenshot and no-console-error checks: PASS.
- V2.3 deployment: PASS, with read-only source/schema/empty-state reconciliation.
- Policy create and freeze: PASS; exact hashes are in the V2.3 qualification journal.
- Hosted live semantic qualification and independent recipient balance reconciliation are blocked by the exact pre-broadcast simulator failure documented in `docs/V23_QUALIFICATION_RUN_BLOCKER.md`.

## Fastest safe release sequence (no frontend work)

1. Resolve the Studio-dev timestamp-context/fee-simulation blocker without silently changing the frozen policy semantics.
2. Obtain separate explicit authorization for the remaining qualification writes. Re-read nonce, estimate each exact payable/nonpayable call, broadcast once, reconcile the same hash, and stop on any infrastructure failure.
3. Qualify at least the four result branches with independent creator/requester identities and actual validator evidence. Verify claimable/refundable liabilities, one-time withdrawals, and independently confirmed recipient value movement. `WITHDRAWAL_EMITTED` is not `DELIVERED`.
4. Publish the source-identical commit to the correct RightsRail GitHub repo and submit only after explicit publication authorization, exact-head CI, and canonical evidence are available.

**No frontend build/deployment is required in the contract-only release sequence.** The optional frontend can be addressed after Intelligent Contract submission if GenLayer's specific submission form permits a contract-only entry.

## Precise remaining external permissions/capabilities

This run did not publish GitHub/Vercel or submit the Portal. The signer was available for the single authorized deployment, but no qualification writes were authorized after the evidence-host blocker. Never reveal private keys or seed phrases in chat.
