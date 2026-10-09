# Evidence model

Evidence is an immutable content binding, not a permanent media warehouse. Large blobs remain external; the contract stores identifiers, digests, lengths, MIME values, and authentication attempts.

## Binding fields

An evidence record binds:

- `evidence_id`, `request_id`, `policy_id`, and `policy_version`;
- reference source, SHA-256, exact byte length, and MIME;
- proposed-use source, SHA-256, exact byte length, and MIME;
- optional public context URL, content digest, and screenshot digest;
- attribution text and an authority digest over the committed source identifiers;
- schema version, immutable status, and commit timestamp.

The request supplies the proposed asset digest. The frozen policy supplies the protected asset digest. Commit rejects either mismatch and rejects evidence overwrite.

## Two-image boundary

An adjudication can pass at most two image bodies to the semantic evaluator:

1. the protected/reference asset;
2. the proposed-use artifact, or a captured webpage screenshot.

Public context is separate text evidence, with an optional screenshot digest. It cannot add an unbounded third image to the semantic prompt.

## Authentication pipeline

```text
public source URL
  -> fetch or capture
  -> exact bytes/content and MIME/length checks
  -> SHA-256 comparison
  -> immutable authentication attempt
  -> semantic adjudication only when AUTHENTICATED
```

The pipeline distinguishes `FETCH_FAILED`, `INVALID_CONTENT`, `AUTHENTICATION_FAILED`, and `EVIDENCE_INSUFFICIENT`. Transport failure is not a business verdict. The semantic `evidence_sufficient=false` value is available only to a valid consensus evaluation that determines the authenticated evidence is insufficient for the semantic questions.

## History

Evidence is committed once per request. Authentication attempts are append-only. Only a transport failure may be retried, and each attempt receives a distinct ID. No method overwrites evidence, replaces a source, or deletes an adverse history entry.
