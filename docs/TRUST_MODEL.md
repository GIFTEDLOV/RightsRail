# Trust model

## What RightsRail claims

RightsRail claims only that a proposed use was evaluated against a frozen permission policy and that the deterministic policy outcome was recorded. It does not claim to know who legally owns an asset or whether a use is legally infringing.

## Trust boundaries

The deterministic layer trusts hashes, exact byte lengths, media types, source identifiers, request/policy IDs, versions, timestamps, fee values, and state-transition preconditions.

The semantic layer is bounded to seven booleans:

1. `asset_match`
2. `purpose_within_scope`
3. `prohibited_context_present`
4. `transformation_within_scope`
5. `attribution_satisfied`
6. `endorsement_implied`
7. `evidence_sufficient`

Nothing else from a model is consensus state. No confidence, prose, address, amount, arbitrary verdict, or explanation is accepted as semantic output.

## Issuer authority

There is no global owner override. An issuer can edit its own draft, freeze its own policy, and close its own frozen policy for future requests. After request/evidence commitment, adjudication does not need issuer cooperation. A frozen policy, evidence record, adverse result, and permit binding cannot be rewritten or deleted.

## Consensus safety

Leader and validator paths both require `gl.vm.Return`, strictly validate calldata and the seven-field output, and reject malformed data. Validators independently evaluate the same bound context and compare only the seven booleans. The first canonical result is authoritative; later attempts cannot shop for a better result.
