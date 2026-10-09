# Trust model

## Claim boundary

RightsRail enforces a frozen issuer policy. It does not claim legal ownership, legal infringement, damages, or an authoritative legal interpretation.

## Trust layers

1. Deterministic facts: identities, policy versions, timestamps, SHA-256 digests, exact byte lengths, MIME values, source identifiers, request IDs, evidence IDs, fee values, and state preconditions.
2. Authenticated evidence: at most a protected/reference image, a proposed-use image or webpage screenshot, and optional public context text/screenshot with exact bindings.
3. Bounded semantic consensus: exactly seven booleans, independently produced by leader and validator.
4. Deterministic policy: fixed precedence maps the vector to one of four results.
5. Deterministic settlement: fixed amount, recipient, request, policy version, generation, one-shot guard, and internal entitlement allocation.

## Authority

There is no global owner override. The issuer controls only its own draft, its freeze, and its close-for-future-requests operation. After request/evidence commitment, adjudication requires no issuer cooperation. The issuer cannot rewrite frozen policy, replace evidence, select booleans, select a verdict, suppress adjudication, or delete an adverse result.

Settlement consumes escrow exactly once into either a payout entitlement for the
frozen recipient or a refund entitlement for the requester. It does not claim
that an asynchronous external value message has completed.

## Consensus safety

The leader must return strict schema data before `gl.vm.Return`. The validator must receive the leader result through `gl.vm.Return`, strictly parse it, independently evaluate the same canonical question, strictly parse its own result, and compare only the seven normalized booleans. The post-consensus path parses once more before any adjudication write.

Malformed output, absent return wrapper, disagreement, and unavailable/changed evidence are consensus or infrastructure failures. None can create `INCONCLUSIVE`, `NOT_APPLICABLE`, `DENIED`, `PERMITTED`, an adjudication, a generation, or a permit.

## Phase 3 product boundary

The frontend is not a trust authority. It consumes typed provider envelopes,
shows canonical/local provenance, and renders the first provider result. The
controlled demo is a qualification fixture and is never labeled live,
canonical network state, or on-chain state.
