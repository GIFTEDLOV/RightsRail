# RightsRail V2.4 Studionet release report

**Run date:** 2026-10-16

**Status: NO-GO.** The local candidate and repository gates pass. Studionet deployment and live qualification remain blocked by target-runtime incompatibility and the absence of a supported fee quote. No contract transaction was signed or broadcast.

## Candidate and network

- Source: `contracts/rightsrail_v24.py` — SHA-256 `5C99DEB31EB29B171B94F343950CBFF5204945D02160B2ADA3D742A1FFC6D321`.
- Generated ABI: `artifacts/rightsrail-v24.abi.json` — SHA-256 `11548EA63B1C365C7985BE8C748109C4B7F4A33A1A55DE8394EF1CE90E6BE4EA`.
- RC5 schema: 36 methods, 24 reads, 12 writes. `get_audit_events(start, limit)` is read-only.
- Built-in network alias: `studionet`; RPC `https://studio.genlayer.com/api`; chain ID `61999`.
- Consensus main: `0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575`; consensus data: `0x88B0F18613Db92Bf970FfE264E02496e20a74D16`. CLI and SDK definitions agree; no custom RPC was used.
- Configured signer `firewall-only`: 5 GEN; latest and pending nonce are both 8. Its Studionet deployment history contains one different source hash (`942980C7BE82BBBC264A3774D0AE130253B6B386E69CF88BD7EF7F752559A114`); no exact V2.4 deployment was found.
- Historical Studio-dev address `0xA6150b95E0464e708834BC8f13DC48De10039550` has no code on Studionet and was not reused.

## Blocking evidence

1. **The Studionet runtime cannot load the candidate's EVM delivery interface.** The exact candidate's read-only `gen_getContractSchemaForCode` call returned `VM_ERROR invalid_contract`. A header-only in-memory diagnostic using the current documented Python runner reached source line 376 and failed with `AttributeError: module 'genlayer' has no attribute 'evm'` at `@gl.evm.contract_interface`. The candidate file was not changed. RightsRail uses that interface for its external GEN delivery path. Current GenLayer documentation states that hosted Studio has no EVM layer or ghost contracts; external EVM message delivery therefore cannot be qualified on this target. See [Value Transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers) and [Messages](https://docs.genlayer.com/developers/intelligent-contracts/features/messages).

2. **No supported Studionet fee estimate is available in the installed tooling.** The installed GenLayer CLI `0.40.0-rc.3` ran `genlayer estimate-fees --json` and received RPC `-32601 Method not found: sim_getFeeConfig`; no quote was returned. Installed `genlayer-js 1.1.8` exposes no `estimateTransactionFees` method. `eth_gasPrice` returned zero, but that is not treated as a protocol-fee quote. The release scripts now require an explicit SDK estimate marked gasless before signing and fail closed if it is unavailable.

These preconditions failed before deployment. There is no Studionet deployment address, deployment transaction ID, receipt, or execution result. The deployment journal records zero broadcasts and no signature.

## Qualification

Cases A–D were not run on Studionet because there is no verified deployed address and the target lacks the required EVM delivery interface. No consensus results, transaction IDs, receipts, state transitions, settlements, final readbacks, fee/refund accounting, GEN costs, or external delivery confirmations are claimed. The qualification workflow now includes the expected withdrawal checks, but they have no on-chain evidence in this run.

## Local verification

- Candidate verifier: PASS; exact pinned source/ABI hashes and schema shape.
- GenVM v0.6.0-rc5 validation: PASS; 36 methods.
- GenVM v0.6.0-rc5 typecheck: PASS; zero diagnostics.
- GenVM v0.6.0-rc5 generated schema: exact match to the checked-in ABI.
- GenVM lint: five visible E010 reachability warnings; no other warning codes.
- Python pytest: 87 passed, plus 18 subtests.
- Python unittest: 32 passed.
- TypeScript/API tests: 14 passed.
- JavaScript deployment and workflow tests: 21 passed, including fee-estimate fail-closed checks.
- Ruff, mypy (13 files), Python compileall, TypeScript typecheck, and production web/API build: PASS.
- Browser E2E: 28 passed. Playwright now starts API and Vite independently from their package working directories, which fixed the Windows server startup/cleanup issue.

The recurring Windows temporary-file failure came from the pinned gltest direct loader: it duplicated a temporary message file onto stdin, then attempted to unlink it while Windows still held the file open. The test compatibility fixture defers cleanup until the isolated GLSim process exits, redirects simulator output to a file, and isolates temporary files. The full pytest run passes with this fix; V2.3 contract source remains unchanged.

## Release and repository state

- Clean candidate package: `RightsRail_V2.4_STUDIONET_SUBMISSION.zip`. Its contents and member hashes are recorded in `provenance/rightsrail-v24-studionet-archive-manifest.json`. The package is explicitly NO-GO and is not a submission-ready release.
- The older `RightsRail_V2.4_SCHEMA_VERIFIED_CANDIDATE.zip` and Studio-dev/Bradbury history are preserved separately.
- Current branch: `main`. No Git remote is configured, so push and hosted CI/release status cannot be verified.
- No mainnet deployment, Portal submission, publish, tag, or external delivery was performed.

## Remaining gates

1. A supported Studionet runtime/toolchain must expose the EVM interface needed by RightsRail delivery.
2. A supported Studionet-compatible fee quote must return; deployment must use that exact quote or a quote-confirmed gasless mode.
3. Deploy once, then verify final status, successful execution result, receipt, source/schema identity, and initial state.
4. Run Cases A–D with consensus and verify every receipt, transition, settlement, accounting result, and delivery readback.
5. Configure a verified Git remote before any push or hosted CI/release confirmation.

Official references: [GenLayer skills](https://github.com/genlayerlabs/skills), [network configuration](https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration), [networks](https://docs.genlayer.com/developers/networks), [GenLayer CLI](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-cli), [fee policy](https://docs.genlayer.com/developers/decentralized-applications/fees-and-transaction-kit), and [fee outcomes](https://docs.genlayer.com/developers/decentralized-applications/fee-outcomes-and-debugging).
