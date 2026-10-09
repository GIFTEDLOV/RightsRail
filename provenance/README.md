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
