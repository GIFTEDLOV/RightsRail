# RightsRail V2.4.1 submission details

## Submission summary

RightsRail is a GenLayer Intelligent Contract application that evaluates evidence-bound digital media uses against a frozen policy. Its deterministic policy engine maps independently evaluated semantic evidence to a permit or refund outcome, then accounts for entitlement allocation and claimant-authorized withdrawal.

The deployed candidate has passed four live Studionet qualification scenarios and on-chain delivery verification. Case A returned `PERMITTED`; Cases B, C, and D returned `DENIED`, `INCONCLUSIVE`, and `NOT_APPLICABLE`. All four settlements and native GEN transfers finalized with recipient balance readback. Eight unauthorized or duplicate withdrawal attempts were rejected without state changes.

## Canonical deployment

- Application: [https://rightsrail.vercel.app](https://rightsrail.vercel.app)
- Source repository: [https://github.com/GIFTEDLOV/RightsRail](https://github.com/GIFTEDLOV/RightsRail)
- Network: built-in GenLayer `studionet`, chain ID `61999`
- RPC: `https://studio.genlayer.com/api`
- Contract: `0xdDB18c41B3033Ec2daD038F9547baAB913BEA2Aa`
- Deployment receipt: [Studionet transaction](https://explorer-studio.genlayer.com/tx/0x0b85e7aa631ed07223e927b2f9310f67beced18be5265ef247c9a74699463951)
- Source SHA-256: `DA0828DD579AB0CAA6432AF713559D4E3B5E679444F71E7345C4FF8E0F21EC47`
- ABI SHA-256: `AB93A76683921294FAC694751CF877E0F195A69DC7659FB5F02D6D34BC099B61`
- ABI surface: 36 methods, 24 reads, 12 writes; read-only `get_audit_events(start, limit)`.

The active compatibility source is `contracts/rightsrail_studionet.py`. The original V2.4 candidate is preserved with SHA-256 `5C99DEB31EB29B171B94F343950CBFF5204945D02160B2ADA3D742A1FFC6D321`; its original ABI SHA-256 is `11548EA63B1C365C7985BE8C748109C4B7F4A33A1A55DE8394EF1CE90E6BE4EA`.

## Live qualification evidence

- Deployment journal: `docs/provenance/live-transactions/rightsrail-studionet-deployment.json`.
- Qualification journal: `docs/provenance/live-transactions/rightsrail-studionet-qualification.json` (full transaction IDs, receipts, readbacks, balances, evidence byte lengths and hashes, actors, accounting, and the eight security checks).
- Final Case A adjudication: [transaction](https://explorer-studio.genlayer.com/tx/0x90c5d7eade35ee07bd74c3c70ad355b85bb21317ee2b4e64640a1f3e943c7afc).
- Final Case B adjudication: [transaction](https://explorer-studio.genlayer.com/tx/0xa27db4226d3229b9f6adce4b170076637b406fcfe65e4ddf57d25b7ea88d4528). The earlier finalized consensus-failed attempt is preserved in the journal.
- Final Case C adjudication: [transaction](https://explorer-studio.genlayer.com/tx/0xe71821226c477509c7f7a10678844dc94e5421b8650b46cd3c10f309344e58b7).
- Final Case D adjudication: [transaction](https://explorer-studio.genlayer.com/tx/0x2264736592c13de10942fed243ff65447cffe6fafbba55f6d9f5529005588e77).
- Request escrow funding: [finalized transfer](https://explorer-studio.genlayer.com/tx/0x7ce1a616add8da991ebf8f20ae0ca2a41ffdd97cbf118cb4c04196df35097245), 40 attoGEN.
- Final accounting: 40 attoGEN received = 10 payout allocated + 30 refund allocated; all 40 withdrawn, 0 outstanding.

## Evidence provenance

Five publicly served image bodies were read as HTTPS resources and verified for HTTP 200, `image/png`, exact byte length, and SHA-256 before qualification:

| Evidence | Public URL | Bytes | SHA-256 |
|---|---|---:|---|
| Reference | [reference.png](https://rightsrail-evidence.vercel.app/reference.png) | 35,344 | `e0d804ab77a13f6f892b564f58656e72bf4daff123225b58cb637537b2aad0c8` |
| Case A | [proposed-editorial.png](https://rightsrail-evidence.vercel.app/proposed-editorial.png) | 52,132 | `da782460a0de765d49ebcbe4f116cfab0c42b42d3aea99e4bfc3763e5b63f223` |
| Case B | [proposed-betting.png](https://rightsrail-evidence.vercel.app/proposed-betting.png) | 48,481 | `bf7799c32a4d8a46f5def7c06e39e1926c2e49df2461b35ea6111026699fef89` |
| Case C | [proposed-missing-context.png](https://rightsrail-evidence.vercel.app/proposed-missing-context.png) | 32,221 | `a9f99ccd842e6ce2dd664d0aea21c94538a3eba40bf93040ab9fcb0158fe2584` |
| Case D | [unrelated.png](https://rightsrail-evidence.vercel.app/unrelated.png) | 41,410 | `5d6cfa94971725d3d367a2c18d8cababd31668b0f3d33ed6d96712d222fb993d` |

## Verification

The source repository contains the Python, TypeScript/API, deployment-policy, stable SDK, stable GenVM, RC5 GenVM, build, and browser verification results. The production application was also checked against real Studionet receipts for a successful transaction and a consensus failure. Current workflow status is visible at [GitHub Actions](https://github.com/GIFTEDLOV/RightsRail/actions).

The submission archive uses an explicit allowlist and its adjacent manifest records every member hash. No environment file, wallet secret, historical deployment file, or unrelated project is packaged. The Portal submission remains a separate action.
