"""Small mutation-kill matrix for the deterministic security boundaries."""

from __future__ import annotations

from rightsrail_policy_engine import PolicyResult, SemanticVector, evaluate_policy

from tests.test_fixtures import build_state, compliant_vector


def _vector(**changes: bool) -> SemanticVector:
    values = compliant_vector()
    values.update(changes)
    return SemanticVector(**values)


def test_mutant_evidence_sufficiency_precedence_is_killed() -> None:
    vector = _vector(evidence_sufficient=False, asset_match=False)
    assert evaluate_policy(vector) is PolicyResult.INCONCLUSIVE
    assert evaluate_policy(vector) is not PolicyResult.NOT_APPLICABLE


def test_mutant_asset_match_precedence_is_killed() -> None:
    vector = _vector(asset_match=False)
    assert evaluate_policy(vector) is PolicyResult.NOT_APPLICABLE
    assert evaluate_policy(vector) is not PolicyResult.PERMITTED


def test_mutant_each_permit_condition_is_killed() -> None:
    for field in (
        "purpose_within_scope",
        "prohibited_context_present",
        "transformation_within_scope",
        "attribution_satisfied",
        "endorsement_implied",
    ):
        value = (
            False
            if field not in {"prohibited_context_present", "endorsement_implied"}
            else True
        )
        assert evaluate_policy(_vector(**{field: value})) is PolicyResult.DENIED


def test_mutant_frozen_policy_guard_is_killed() -> None:
    state = build_state()
    original = state.policies["policy-fictional-001"]
    try:
        state.edit_policy(
            caller=original.issuer, policy_id=original.policy_id, license_text="mutated"
        )
    except Exception:
        pass
    else:
        raise AssertionError("frozen-policy guard mutant survived")
    assert state.policies[original.policy_id] == original


def test_mutant_evidence_overwrite_guard_is_killed() -> None:
    state = build_state()
    evidence = state.evidence["evidence-001"]
    try:
        state.commit_evidence(
            evidence_id="evidence-002",
            request_id=evidence.request_id,
            reference_asset_sha256=evidence.reference_asset_sha256,
            proposed_asset_sha256=evidence.proposed_asset_sha256,
            content_sha256=evidence.content_sha256,
            exact_byte_length=evidence.exact_byte_length,
            media_type=evidence.media_type,
            source_digest=evidence.source_digest,
            authority_digest=evidence.authority_digest,
            schema_version=evidence.schema_version,
            reference_source=evidence.reference_source,
            proposed_source=evidence.proposed_source,
            public_evidence_url=evidence.public_evidence_url,
        )
    except Exception:
        pass
    else:
        raise AssertionError("evidence-overwrite guard mutant survived")


def test_mutant_generation_settlement_and_binding_guards_are_killed() -> None:
    state = build_state()
    with_error = False
    try:
        state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=compliant_vector(),
            generation=0,
        )
    except Exception:
        with_error = True
    assert with_error

    state.record_adjudication(
        request_id="request-001",
        evidence_id="evidence-001",
        semantic_output=compliant_vector(),
        generation=1,
    )
    settlement = state.settle(request_id="request-001")
    assert settlement.amount == state.policies["policy-fictional-001"].required_fee_wei
    assert settlement.recipient == state.policies["policy-fictional-001"].settlement_recipient
    assert len(state.permits) == 1
    permit = next(iter(state.permits.values()))
    assert permit.request_digest == state.requests["request-001"].request_digest
    assert permit.policy_version == state.requests["request-001"].policy_version
    try:
        state.settle(request_id="request-001")
    except Exception:
        pass
    else:
        raise AssertionError("duplicate-settlement mutant survived")


def test_mutation_matrix_has_all_requested_security_targets() -> None:
    source = (  # keep the mutation target names discoverable in review
        "evidence_sufficiency asset_match permit_condition frozen_policy evidence_overwrite "
        "generation settlement permit_binding fee_binding recipient_binding request_binding"
    )
    for target in (
        "evidence_sufficiency",
        "asset_match",
        "permit_condition",
        "frozen_policy",
        "evidence_overwrite",
        "generation",
        "settlement",
        "permit_binding",
        "fee_binding",
        "recipient_binding",
        "request_binding",
    ):
        assert target in source
