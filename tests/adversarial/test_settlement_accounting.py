"""Adversarial tests for one-shot entitlement accounting."""

from __future__ import annotations

from dataclasses import replace

import pytest
from rightsrail_domain import InvariantViolation, StateTransitionError
from rightsrail_policy_engine import PolicyResult

from tests.test_fixtures import build_state, compliant_vector


def _settleable_state() -> object:
    state = build_state()
    state.record_adjudication(
        request_id="request-001",
        evidence_id="evidence-001",
        semantic_output=compliant_vector(),
        generation=1,
    )
    return state


def test_reusing_consumed_escrow_or_allocating_a_second_entitlement_is_rejected() -> None:
    state = _settleable_state()
    request = state.requests["request-001"]
    state.requests["request-001"] = replace(
        request,
        escrow_consumed=1,
        entitlement_type="REFUND_ALLOCATED",
        entitlement_recipient=request.requester,
        entitlement_amount=1,
    )
    with pytest.raises(StateTransitionError):
        state.settle(request_id="request-001")
    assert state.settlements == {}
    assert state.permits == {}


def test_frozen_fee_mutation_is_killed_by_request_binding() -> None:
    state = _settleable_state()
    policy = state.policies["policy-fictional-001"]
    state.policies[policy.policy_id] = replace(policy, required_fee_wei=11)
    with pytest.raises(InvariantViolation):
        state.settle(request_id="request-001")
    assert state.settlements == {}
    assert state.requests["request-001"].escrow_consumed == 0


@pytest.mark.parametrize(
    "field",
    [
        "prohibited_context_present",
        "endorsement_implied",
        "evidence_sufficient",
        "asset_match",
    ],
)
def test_non_permitted_outcomes_have_refund_only(field: str) -> None:
    state = build_state()
    vector = compliant_vector()
    vector[field] = False if field in {"evidence_sufficient", "asset_match"} else True
    adjudication = state.record_adjudication(
        request_id="request-001",
        evidence_id="evidence-001",
        semantic_output=vector,
        generation=1,
    )
    settlement = state.settle(request_id="request-001")
    if field == "evidence_sufficient":
        assert adjudication.result == PolicyResult.INCONCLUSIVE.value
    elif field == "asset_match":
        assert adjudication.result == PolicyResult.NOT_APPLICABLE.value
    else:
        assert adjudication.result == PolicyResult.DENIED.value
    assert settlement.status == "REFUND_ALLOCATED"
    assert state.permits == {}
    assert state.claimable_by_address == {}
    assert state.refundable_by_address["requester-001"] == 10
    request = state.requests["request-001"]
    assert request.escrowed_value == 0
    assert request.escrow_received == request.escrow_consumed
