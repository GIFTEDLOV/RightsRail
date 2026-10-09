# RightsRail API

The local API runs on port 3002 and serves a persistent JSON-backed controlled
fixture read model. Every response includes provenance metadata:
`mode`, `canonical`, `chainId`, `contractAddress`, `source`, and `asOf`.

The default mode is `CONTROLLED_LOCAL` with `canonical: false`. Setting
`RIGHTSRAIL_PROVIDER_MODE=GENLAYER_CANONICAL` selects the typed canonical
adapter, which currently returns an explicit unavailable response because the
contract is not deployed. It never falls back to fixtures.

The contract/domain state remains the source of truth. The local API is only a
product qualification projection, preserves historical fixture records, and
keeps entitlement allocation separate from future asynchronous delivery.
