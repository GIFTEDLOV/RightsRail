# RightsRail V2.4.1 — final Studionet submission report

**Status: GO — required repository, contract, live qualification, application, and packaging gates passed.**

## Candidate and deployment

- Network: built-in `studionet`, chain ID `61999`, RPC `https://studio.genlayer.com/api`.
- Contract: [`0xdDB18c41B3033Ec2daD038F9547baAB913BEA2Aa`](https://explorer-studio.genlayer.com/address/0xdDB18c41B3033Ec2daD038F9547baAB913BEA2Aa).
- Source: `contracts/rightsrail_studionet.py`, SHA-256 `DA0828DD579AB0CAA6432AF713559D4E3B5E679444F71E7345C4FF8E0F21EC47`.
- Generated ABI: `artifacts/rightsrail-studionet.abi.json`, SHA-256 `AB93A76683921294FAC694751CF877E0F195A69DC7659FB5F02D6D34BC099B61`.
- Schema: 36 methods, 24 reads, 12 writes; `get_audit_events(start, limit)` is read-only.
- Preserved V2.4 baseline: `contracts/rightsrail_v24.py` SHA-256 `5C99DEB31EB29B171B94F343950CBFF5204945D02160B2ADA3D742A1FFC6D321`; `artifacts/rightsrail-v24.abi.json` SHA-256 `11548EA63B1C365C7985BE8C748109C4B7F4A33A1A55DE8394EF1CE90E6BE4EA`.
- Deployment transaction: [`0x0b85e7aa631ed07223e927b2f9310f67beced18be5265ef247c9a74699463951`](https://explorer-studio.genlayer.com/tx/0x0b85e7aa631ed07223e927b2f9310f67beced18be5265ef247c9a74699463951), `FINALIZED / FINISHED_WITH_RETURN`. One deployment was broadcast. Receipt, address, deployed source hash, 36/24/12 schema parity, contract metadata, and all-zero initial state are recorded in the deployment journal.
- Studionet's documented built-in gasless profile was used (`feeValue: 0`); the unsupported `sim_getFeeConfig` path was not used. The 40 attoGEN transferred for qualification was request escrow, not a network fee.

## Live qualification

The live workflow broadcast 35 contract writes. Case B's first adjudication finalized with a consensus failure and no state change; the same input was transparently retried once and finalized as `DENIED`. No result shopping occurred. Eight unauthorized or duplicate withdrawal attempts finalized as expected execution errors, each with unchanged settlement/accounting state.

| Case | Consensus result | Settlement | Adjudication | Settlement tx | Withdrawal tx | Finalized delivery child | Recipient balance change |
|---|---|---|---|---|---|---|---:|
| A | `PERMITTED` | `PAYOUT_ALLOCATED` | `0x90c5d7eade35ee07bd74c3c70ad355b85bb21317ee2b4e64640a1f3e943c7afc` | `0x0f4370ddad5f7b30d19a3132236214bc1301eda3431c900ea74b13b803799dd5` | `0x1ed53154afe02636609329b97e0403955e022531f22962c7c74e53d598420b72` | `0xaec803568440fc693442573de2b4765457bd91a668e118952cacc4e5ff23a873` | +10 attoGEN to issuer |
| B | `DENIED` | `REFUND_ALLOCATED` | `0xa27db4226d3229b9f6adce4b170076637b406fcfe65e4ddf57d25b7ea88d4528` | `0x6b3fd04e535ca5822112d4bc32aaa1c0cfea05b9e4d95db5d726e6b9cf155ab8` | `0x574a57db560ec6dc26e3362e6a7a3026d34ad30c5e0b2edf378f849524d88022` | `0xc820edc1dd87d617f814abe82720e84e618faeea63d71fb09aff77b2c8a0de67` | +10 attoGEN to requester |
| C | `INCONCLUSIVE` | `REFUND_ALLOCATED` | `0xe71821226c477509c7f7a10678844dc94e5421b8650b46cd3c10f309344e58b7` | `0x8022ad8f302a7e7be517aac893756d128cbea5e5d8eea8b06bf8a9ee2bf0fe12` | `0x926541d6b322c9380300d4cdd101808b39f25c3d5155bedc953fbf7035503bd3` | `0x38a1d1c73f8e18a10237c726a94907d1c8d8967ad83897bb987d58b39c5a9399` | +10 attoGEN to requester |
| D | `NOT_APPLICABLE` | `REFUND_ALLOCATED` | `0x2264736592c13de10942fed243ff65447cffe6fafbba55f6d9f5529005588e77` | `0x1f77a220ad597fe3d6e9dc623d01800e1918ea3440e8ede00a95696595dfd434` | `0x51bb7570c6523333f512d5f4d9140aea0e91af8d49de2cc57f28d22ca6bde4a2` | `0xba90355dc4fafd264e3af1c03b86b45b69c5234c932240c92ff1221751e89c62` | +10 attoGEN to requester |

Each withdrawal emitted a native GEN transfer. The child transaction finalized, credited value, and its recipient balance delta was read back; the contract's `NOT_AVAILABLE` delivery field alone was not treated as proof. All 8 withdrawal authorization and duplicate-protection checks passed.

The issuer (`0x33653E6e86807e41682D3346CDf648D6653384B1`), requester (`0x61F10Cc252eD98Ce7596c73fC557cCA4cc600c82`), and operator (`0x0291E33706B7CaE6AD332A28f66E7f3E6F634d58`) used distinct addresses; actor roles and the negative-attempt callers are recorded in the qualification journal.

Final accounting: 40 attoGEN escrow received, 10 payout allocated, 30 refunds allocated, 40 withdrawal emitted, 0 escrowed or outstanding, and conservation total 40. The separate requester funding transfer of 40 attoGEN finalized and was balance-verified: [`0x7ce1a616add8da991ebf8f20ae0ca2a41ffdd97cbf118cb4c04196df35097245`](https://explorer-studio.genlayer.com/tx/0x7ce1a616add8da991ebf8f20ae0ca2a41ffdd97cbf118cb4c04196df35097245).

Reference and proposed evidence for all four cases were served over public HTTPS and verified against exact MIME type, byte length, and SHA-256 before use. The qualification journal contains the hashes, evidence/authentication records, every parent and child receipt, all eight protection transactions, actor identities, state transitions, and final canonical readbacks. The first Case B consensus-failed transaction is [`0x88b45ad94f384756e7edb0733c9d70dde04a02b43f773e46f84b5700821e5892`](https://explorer-studio.genlayer.com/tx/0x88b45ad94f384756e7edb0733c9d70dde04a02b43f773e46f84b5700821e5892).

## Application and checks

- Production application: [https://rightsrail.vercel.app](https://rightsrail.vercel.app), Vercel production deployment `dpl_AKkJTc1QE7uEstSvckNzX3s1W42Y`.
- Public `/api/status` verified canonical mode, chain 61999, contract address, source/ABI identities, and live 1/4/4/4/1/4 record counts.
- Hosted browser verification passed against the production URL: canonical demo cards, successful receipt recovery, consensus-failure display, and no browser console errors.
- Local gates passed: pytest `87 passed, 18 subtests`; unittest `32 passed`; TypeScript/API `18 passed`; deployment policy `21 passed`; stable workflow `2 passed`; browser E2E `32 passed`; Ruff; mypy (13 source files); Python compile; TypeScript typecheck; production build.
- GenVM RC5 V2.4 validation/typecheck and generated schema comparison passed against the pinned baseline. Lint reported only the known `E010` nondeterministic-reachability warnings. Stable GenVM validation/typecheck/schema comparison passed with zero diagnostics and exact deployed ABI parity. The isolated stable SDK suite passed 6 tests.
- GitHub Actions passed on source revision `72aec9b61e9863df21ec34c34d3db712e4729658`; see [run 39132942743](https://github.com/GIFTEDLOV/RightsRail/actions/runs/39132942743). Repository CI gates publication on the full workflow passing for the release package commit; see [current checks](https://github.com/GIFTEDLOV/RightsRail/actions).
- Build note: Vite reports one 529 KB minified JavaScript chunk; production build and hosted browser checks passed.

## Submission files

- [GitHub repository](https://github.com/GIFTEDLOV/RightsRail)
- [Submission details](docs/SUBMISSION_DETAILS_V241.md)
- [Deployment journal](docs/provenance/live-transactions/rightsrail-studionet-deployment.json)
- [Qualification journal and receipts](docs/provenance/live-transactions/rightsrail-studionet-qualification.json)
- [Candidate and deployment provenance](provenance/studionet-candidate-manifest.json)
- [Submission archive](RightsRail_V2.4.1_STUDIONET_SUBMISSION.zip)
- [Archive integrity manifest](provenance/rightsrail-v241-studionet-archive-manifest.json)

The Portal was not submitted through. This report records the verified deployment and prepares the exact evidence for submission.
