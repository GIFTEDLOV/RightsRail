# Frontend and contract parity

## Current truth boundary

The web application defaults to `CONTROLLED_LOCAL`. It renders reproducible
fixtures and labels them as noncanonical. `GENLAYER_CANONICAL` is an explicit
provider mode and never falls back to local fixtures. The deployed V1 address
is not activated in the local app because the read adapter and live
qualification are incomplete.

## Audit findings

| ID | Severity | Affected file / method | Evidence / reproducer | Resolution | Status |
| --- | --- | --- | --- | --- | --- |
| PAR-001 | HIGH | `packages/indexer/src/index.ts::provenance` | Canonical provider provenance always returned `contractAddress: null` even when constructed with an address | Preserve and expose the configured canonical address; add TypeScript regression | FIXED locally |
| PAR-002 | MEDIUM | API test command | `pnpm --filter @rightsrail/api test` collected no tests | Added package-local Vitest config and two real store tests | FIXED locally |
| PAR-003 | MEDIUM | local identity rendering | Demo creator/requester placeholders looked like real addresses and one contained mojibake | Replace with explicit `CONTROLLED_LOCAL_*` identities | FIXED locally |
| PAR-004 | CRITICAL | future live writes | No current UI control can safely execute an on-chain write and read back execution status | Keep writes disabled; typed client models the journal but canonical adapter remains unavailable | BLOCKED pending live qualification authorization and adapter completion |

## Required live parity trace

```text
UI intent
→ validated typed write specification
→ precondition read
→ exact user value and fee estimate
→ wallet signer
→ transaction journal
→ same-hash reconciliation
→ FINISHED_WITH_RETURN
→ canonical readback
→ UI state with provenance
```

No local fixture may satisfy the final two steps for a canonical mode. Permit,
settlement, and delivery states must be read from the deployed contract.
