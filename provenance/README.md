# Provenance

This directory stores fixture provenance, source references, and generated-artifact manifests. RightsRail stores immutable source identifiers and digests, not large media blobs.

Phase 2 runtime record:

- proven header: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`;
- validation bundle: `GENVM_VERSION=v0.2.16`;
- contract: `contracts/rightsrail.py`;
- generated schema: `artifacts/rightsrail.abi.json`;
- no deployment, transaction broadcast, faucet use, or GEN spend.

The final contract and ABI SHA-256 values are recorded in the Phase 2 handoff after the local commit. External image and web fixtures must be added with exact byte length, MIME, source identifier, request ID, policy ID/version, and SHA-256 before any future semantic execution test.
