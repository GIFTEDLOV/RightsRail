# Evidence model

Evidence is a committed binding, not a permanent media warehouse. Large image or webpage blobs should remain in an external content-addressed store; the contract stores the identifiers and digests needed to detect substitution.

## Required binding

Each evidence record contains:

- `evidence_id` and `request_id`;
- reference/protected asset SHA-256;
- proposed-use asset SHA-256;
- evidence content SHA-256;
- exact byte length;
- media type;
- source digest and authority digest;
- evidence schema version;
- explicit policy ID and policy version;
- authentication timestamp and immutable status;
- exactly two bounded image sources: reference asset and proposed artifact/screenshot;
- optional public evidence URL.

The request and policy remain the authority for the proposed asset and protected asset respectively. Evidence commit checks both bindings before state mutation.

## Authenticity and history

Evidence cannot be overwritten. A request accepts one committed evidence record in phase 1; a replacement is a new request, not an edit. The history and failed attempts remain observable through the journal in the production read model.

## Public URL inspection

Public URL inspection is optional. If used, retrieval metadata and content digest must be committed before semantic evaluation. A URL is not itself proof of authority or permanence. Retrieval failure is infrastructure failure and must not be turned into a business verdict.
