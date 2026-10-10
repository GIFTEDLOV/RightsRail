# RightsRail Live Qualification Evidence

This bundle is prepared for a future Studio-dev qualification only. It does
not represent canonical contract state, and none of the V2.3 qualification
writes has been executed.

## Evidence host

Previously referenced evidence-only static host:

`https://rightsrail-evidence.vercel.app`

The five SVG files are original project-created controlled fixtures from the
historical local demo. The required V2.3 qualification boundary is PNG. The
local PNG renditions are recorded in
`provenance/media/png-evidence-manifest.json`, but the advertised public PNG
URLs currently return HTTP 404. They must not be used for live evidence
commits until a stable HTTPS host serves byte-identical content.

## Historical SVG reference table (not live V2.3 evidence)

| Case | Role | Public URL | MIME | Bytes | SHA-256 | Expected result |
| --- | --- | --- | --- | ---: | --- | --- |
| REFERENCE | Protected source asset | [reference.svg](https://rightsrail-evidence.vercel.app/reference.svg) | `image/svg+xml` | `1325` | `0FAC13CBD9597297D4DE5F4B656A9DC97CF6B2D43A866347B5C14EF5DE57D3EF` | Reference only |
| CASE_A | Proposed editorial/newsletter use | [proposed-editorial.svg](https://rightsrail-evidence.vercel.app/proposed-editorial.svg) | `image/svg+xml` | `1842` | `4A6B49323FB5BC1E64A47129E73311EA3A6255300E77C76B94AF19968D2D1627` | `PERMITTED` |
| CASE_B | Betting advertisement / implied endorsement | [proposed-betting.svg](https://rightsrail-evidence.vercel.app/proposed-betting.svg) | `image/svg+xml` | `1389` | `788338F4D84AC1A020B1774B6E06EEA1BB259F5E119E1D9235159654A5C98517` | `DENIED` |
| CASE_C | Insufficient context evidence | [proposed-missing-context.svg](https://rightsrail-evidence.vercel.app/proposed-missing-context.svg) | `image/svg+xml` | `1180` | `F70930915E70D3B23BE250E38F6D16FB68B006639E2967B2C3A0E701C38ACE69` | `INCONCLUSIVE` |
| CASE_D | Unrelated asset/context | [unrelated.svg](https://rightsrail-evidence.vercel.app/unrelated.svg) | `image/svg+xml` | `888` | `2CCF22846EE7DF949ED64A61F7775ECBAA0A8A2EE93DD4C5099E9A9117312D89` | `NOT_APPLICABLE` |

## Manifest

Historical manifest URL: [manifest.json](https://rightsrail-evidence.vercel.app/manifest.json)

```text
BYTES: 2351
SHA256: 7114DAD3B100993B17DEEA40EE3A7D048E75B27568EDAC8DA1C2DD53600205DA
MIME: application/json; charset=utf-8
HTTP: historical record only; do not treat as V2.3 PNG-host verification
```

The local source manifest is
`provenance/live_qualification_manifest.json`.

## Verification result

```text
ALL_HTTP_200: YES
ALL_PUBLIC_BYTES_MATCH: YES
ALL_PUBLIC_HASHES_MATCH: YES
```

The expected results are planning labels only. They are not permission to
retry or reinterpret a canonical result. The first successful canonical
adjudication is authoritative; infrastructure failure stops the qualification
and is not converted into a business result.
