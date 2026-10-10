# RightsRail Live Qualification Evidence

This bundle is prepared for Studio-dev qualification. It does not represent
semantic or settlement state. V2.3 policy creation and freezing have executed;
no request/evidence/adjudication/settlement/withdrawal write has executed.

## Evidence host

Previously referenced evidence-only static host:

`https://rightsrail-evidence.vercel.app`

The five PNG files are original project-created controlled fixtures. The
public PNG URLs below were fetched and verified as HTTP 200, `image/png`,
valid PNG bytes, with exact local/public byte lengths and SHA-256 hashes.

## Historical SVG reference table (not live V2.3 evidence)

| Case | Role | Public URL | MIME | Bytes | SHA-256 | Expected result |
| --- | --- | --- | --- | ---: | --- | --- |
| REFERENCE | Protected source asset | [reference.svg](https://rightsrail-evidence.vercel.app/reference.svg) | `image/svg+xml` | `1325` | `0FAC13CBD9597297D4DE5F4B656A9DC97CF6B2D43A866347B5C14EF5DE57D3EF` | Reference only |
| CASE_A | Proposed editorial/newsletter use | [proposed-editorial.svg](https://rightsrail-evidence.vercel.app/proposed-editorial.svg) | `image/svg+xml` | `1842` | `4A6B49323FB5BC1E64A47129E73311EA3A6255300E77C76B94AF19968D2D1627` | `PERMITTED` |
| CASE_B | Betting advertisement / implied endorsement | [proposed-betting.svg](https://rightsrail-evidence.vercel.app/proposed-betting.svg) | `image/svg+xml` | `1389` | `788338F4D84AC1A020B1774B6E06EEA1BB259F5E119E1D9235159654A5C98517` | `DENIED` |
| CASE_C | Insufficient context evidence | [proposed-missing-context.svg](https://rightsrail-evidence.vercel.app/proposed-missing-context.svg) | `image/svg+xml` | `1180` | `F70930915E70D3B23BE250E38F6D16FB68B006639E2967B2C3A0E701C38ACE69` | `INCONCLUSIVE` |
| CASE_D | Unrelated asset/context | [unrelated.svg](https://rightsrail-evidence.vercel.app/unrelated.svg) | `image/svg+xml` | `888` | `2CCF22846EE7DF949ED64A61F7775ECBAA0A8A2EE93DD4C5099E9A9117312D89` | `NOT_APPLICABLE` |

## Manifest

V2.3 PNG manifest: [manifest.json](https://rightsrail-evidence.vercel.app/manifest.json)

```text
BYTES: 2076
SHA256: A6AA797FE9439CDEF689F65F8F6BCFA98BB1EC0C502E6F59EE0B2F0083D9A863
MIME: application/json; charset=utf-8
HTTP: 200
```

The local source manifest is
`provenance/live_qualification_manifest.json`.

## Verification result

```text
ALL_PNG_HTTP_200: YES
ALL_PNG_PUBLIC_BYTES_MATCH: YES
ALL_PNG_PUBLIC_HASHES_MATCH: YES

Qualification status: STOPPED before Case A request broadcast because the
exact payable fee simulation returned `Missing or invalid parameters` while
the policy was active by canonical chain time. This is not a semantic result.
```

The expected results are planning labels only. They are not permission to
retry or reinterpret a canonical result. The first successful canonical
adjudication is authoritative; infrastructure failure stops the qualification
and is not converted into a business result.
