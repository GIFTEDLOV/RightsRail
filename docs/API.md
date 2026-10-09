# RightsRail API

The local API listens on `127.0.0.1:3002`. Responses are JSON envelopes:

```json
{
  "data": {},
  "provenance": {
    "mode": "CONTROLLED_LOCAL",
    "canonical": false,
    "chainId": 61997,
    "contractAddress": null,
    "source": "controlled-fixture-store",
    "asOf": "..."
  }
}
```

Reads include status, policies, requests, evidence, adjudications, permits,
settlements, activity, accounting, and controlled demo bundles. Local-only
POSTs reset the reproducible fixture store or prepare a policy draft. They are
not GenLayer transactions.

`GENLAYER_CANONICAL` is an explicit provider mode. Without a configured
deployed address it returns a provider-unavailable error; the API does not
silently substitute the local store.
