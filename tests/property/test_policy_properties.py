"""Hypothesis properties for policy precedence and settlement invariants."""

from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st
from rightsrail_policy_engine import SEMANTIC_KEYS, PolicyResult, SemanticVector, evaluate_policy

from tests.test_fixtures import build_state


@st.composite
def semantic_vectors(draw: st.DrawFn) -> SemanticVector:
    values = {key: draw(st.booleans()) for key in SEMANTIC_KEYS}
    return SemanticVector(**values)


@given(semantic_vectors())
def test_permitted_is_only_reachable_from_all_permit_conditions(vector: SemanticVector) -> None:
    result = evaluate_policy(vector)
    if result is PolicyResult.PERMITTED:
        assert vector.evidence_sufficient
        assert vector.asset_match
        assert vector.purpose_within_scope
        assert not vector.prohibited_context_present
        assert vector.transformation_within_scope
        assert vector.attribution_satisfied
        assert not vector.endorsement_implied


@given(semantic_vectors())
def test_inconclusive_is_exactly_the_first_precedence_branch(vector: SemanticVector) -> None:
    assert (evaluate_policy(vector) is PolicyResult.INCONCLUSIVE) is (
        not vector.evidence_sufficient
    )


@given(semantic_vectors())
def test_no_non_permitted_result_can_create_a_permit(vector: SemanticVector) -> None:
    state = build_state()
    adjudication = state.record_adjudication(
        request_id="request-001",
        evidence_id="evidence-001",
        semantic_output=vector.as_dict(),
        generation=1,
    )
    state.settle(request_id="request-001")
    if adjudication.result != PolicyResult.PERMITTED.value:
        assert state.permits == {}
    else:
        assert len(state.permits) == 1


def test_settlement_and_permit_counts_are_bounded_by_one() -> None:
    state = build_state()
    state.record_adjudication(
        request_id="request-001",
        evidence_id="evidence-001",
        semantic_output={key: True for key in SEMANTIC_KEYS},
        generation=1,
    )
    state.settle(request_id="request-001")
    assert len(state.settlements) <= 1
    assert len(state.permits) <= 1
