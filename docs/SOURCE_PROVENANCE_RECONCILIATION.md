# RightsRail source provenance reconciliation

Date: 2026-10-11

## Decision

For the deployed RightsRail successor at
`0xfB3335350b0e02ceFb384753990E9B377B4BCB1F`, the authoritative source is
the UTF-8 `contracts/rightsrail.py` in this repository with SHA-256:

```text
E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE
```

That hash matches the source returned by the read-only Studio-dev
`getContractCode` call. The corresponding deployed ABI is:

```text
010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B
```

The deployed contract reports version `2.3.0`, 35 public methods (23 reads and
12 writes), and does not expose `get_audit_events`.

## Conflicting historical hashes

| Artifact | Hash / identity | Meaning | Authority |
| --- | --- | --- | --- |
| `contracts/rightsrail.py` | `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE` | Current local V2.3 source and exact deployed source | Authoritative for the current V2.3 deployment |
| Studio-dev `getContractCode` | `E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE` | Read-only canonical source parity | Authoritative on-chain evidence |
| `artifacts/rightsrail.abi.json` | `010C074E7FA8892AEFB26C443F62DFAA4E379897DFE950A93927F9E9E081CF3B` | Official V2.3 ABI artifact | Authoritative for the current local client surface |
| `package_source_sha256` in `SUBMISSION_STATUS.json` | `651CA9042885F01D4EF0A6C67E8A5AEF54957AB11C5860FAD260872BD8640B5D` | Earlier submission-package snapshot | Historical package provenance only; not deployed-source proof |
| V1 deployment | source `C312E73F...`, ABI `E1314699...`, address `0x984b...` | Immutable previous contract | Separate historical deployment; not V2.3 |

The `651CA...` value is retained because it documents the earlier package
artifact. It must not replace the exact deployed V2.3 hash without a byte-level
source explanation and a new deployment.

## Retrieved deployed-source artifact

`rightsrail_deployed.py` is preserved as a raw retrieval artifact. It is not a
canonical source file: it is UTF-16LE with a PowerShell `Result:` wrapper and
extra trailing blank lines. Its raw file hash is:

```text
6DC777E8029CE49ADEBEF7822C67CA7EBEFAD0CC25FA87FC0C5C7FF70CD0B535
```

After removing the wrapper, normalizing CRLF to LF, and restoring the single
source-file trailing newline, the bytes are exactly equal to
`contracts/rightsrail.py` and hash to `E22EF2CC...`. This confirms the
retrieval artifact is corroborating evidence, not a competing V2.4 source.
Because the raw artifact is UTF-16LE rather than a source file, it is explicitly
excluded from Ruff's Python discovery; it remains preserved for provenance.

## V2.4 candidate status

No V2.4 source or ABI containing `get_audit_events(start, limit)` is present in
the current workspace, Git history, local branches, or the available RightsRail
source archives inspected for this run. The deployed Studio-dev schema also
does not contain that method.

Accordingly, the V2.4 candidate has **not** been integrated and the
`packages/genlayer-client` surface has deliberately not been changed. Adding a
typed method or ABI entry without the exact candidate source and generated ABI
would fabricate a client capability and break deployed source/schema parity.

To continue V2.4 integration, provide the exact candidate archive or local
path plus its intended source and ABI hashes. No private key or wallet
credential is required for that handoff.
