# RightsRail indexer

`packages/indexer` defines the read-model boundary for a future deployment.
It normalizes policies, requests, evidence, adjudications, permits,
settlements, accounting snapshots, delivery records, and audit activity.

There are two explicit sources:

- `ControlledFixtureProvider`: persistent local qualification state,
  `canonical: false`.
- `GenLayerCanonicalProvider`: future contract read adapter,
  `canonical: true`; it fails explicitly until an address is configured.

There is no silent fallback. A canonical outage must appear as a canonical
provider error, not as plausible local records.

The future indexer should consume contract reads/events once an address exists,
rebuild projections from append-only state, preserve first canonical
adjudications, and attach parent settlement transactions, emitted messages,
external operations, recipient, and amount to delivery records.
