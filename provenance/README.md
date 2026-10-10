# Provenance

This directory stores fixture provenance, source references, and generated-artifact manifests. RightsRail stores immutable source identifiers and digests, not large media blobs.

Phase 2.5 runtime record:

- proven header: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`;
- validation bundle: `GENVM_VERSION=v0.6.0-rc5`;
- contract: `contracts/rightsrail.py`;
- generated schema: `artifacts/rightsrail.abi.json`;
- no deployment, transaction broadcast, faucet use, or GEN spend.

The exact contract and ABI SHA-256 values are recorded in the Phase 2.5
handoff after the local commit. External image and web fixtures must be added
with exact byte length, MIME, source identifier, request ID, policy ID/version,
and SHA-256 before any future hosted semantic execution test.

Phase 2.6 candidate record:

- settlement: canonical internal entitlement allocation; no external transfer in `settle_request`;
- public surface: 30 methods, 21 reads, 9 writes;
- contract SHA-256: `C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B`;
- ABI SHA-256: `E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB`;
- conservation: received = escrowed + payout allocated + refund allocated - withdrawals emitted;
- deployed V1 withdrawals: not implemented; the local successor candidate has
  claimant-bound pull withdrawals with `WITHDRAWAL_EMITTED` status only;
  automatic retries remain disabled.
