"""Direct qualification of canonical entitlement allocation without transfers."""

from __future__ import annotations

import json

import pytest

from tests.direct.test_multimodal_consensus_cases import (
    PROPOSED_BYTES,
    PROPOSED_SHA,
    PROPOSED_URL,
    REFERENCE_BYTES,
    REFERENCE_URL,
    _address,
    _mock_image,
    _prepare_case,
    _vector,
)


@pytest.mark.parametrize(
    ("vector", "expected", "entitlement_type"),
    [
        (_vector(), "PERMITTED", "PAYOUT_ALLOCATED"),
        (
            _vector(prohibited_context_present=True, endorsement_implied=True),
            "DENIED",
            "REFUND_ALLOCATED",
        ),
        (_vector(evidence_sufficient=False), "INCONCLUSIVE", "REFUND_ALLOCATED"),
        (_vector(asset_match=False), "NOT_APPLICABLE", "REFUND_ALLOCATED"),
    ],
)
def test_settlement_allocates_exactly_one_internal_entitlement(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
    direct_charlie,
    vector,
    expected,
    entitlement_type,
) -> None:
    contract = direct_deploy("contracts/rightsrail.py")
    _prepare_case(
        direct_vm,
        contract,
        direct_alice,
        direct_bob,
        direct_charlie,
        proposed_sha=PROPOSED_SHA,
        proposed_url=PROPOSED_URL,
        fee=10,
    )
    _mock_image(direct_vm, REFERENCE_URL, REFERENCE_BYTES)
    _mock_image(direct_vm, PROPOSED_URL, PROPOSED_BYTES)
    assert contract.authenticate_evidence("evidence-001") == "AUTHENTICATED"
    assert direct_vm.run_validator() is True
    direct_vm.mock_llm(".*", json.dumps(vector))
    assert contract.adjudicate_usage("request-001") == expected
    assert direct_vm.run_validator() is True

    direct_vm.sender = direct_charlie
    assert contract.settle_request("request-001") == entitlement_type

    request = contract.get_request("request-001")
    settlement = contract.get_settlement(contract.get_settlement_ids(0, 64)[0])
    accounting = contract.get_accounting_status()
    assert request["escrow_received"] == 10
    assert request["escrowed_value"] == 0
    assert request["escrow_consumed"] == 10
    assert request["entitlement_type"] == entitlement_type
    assert request["entitlement_amount"] == 10
    assert request["settlement_id"] == settlement["settlement_id"]
    assert settlement["settlement_type"] == entitlement_type
    assert settlement["escrow_consumed"] == 10
    assert accounting["total_escrow_received"] == 10
    assert accounting["total_escrowed"] == 0
    assert accounting["conservation_rhs"] == 10
    assert len(contract.get_settlement_ids(0, 64)) == 1
    assert len(contract.get_permit_ids(0, 64)) == (1 if expected == "PERMITTED" else 0)

    if expected == "PERMITTED":
        assert contract.get_claimable(_address(direct_charlie)) == 10
        assert contract.get_refundable(_address(direct_bob)) == 0
        assert accounting["total_payout_allocated"] == 10
        assert accounting["total_refund_allocated"] == 0
    else:
        assert contract.get_claimable(_address(direct_charlie)) == 0
        assert contract.get_refundable(_address(direct_bob)) == 10
        assert accounting["total_payout_allocated"] == 0
        assert accounting["total_refund_allocated"] == 10

    with direct_vm.expect_revert("settlement requires terminal adjudication"):
        contract.settle_request("request-001")


def test_zero_fee_permitted_allocates_zero_without_underflow(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
    direct_charlie,
) -> None:
    contract = direct_deploy("contracts/rightsrail.py")
    _prepare_case(
        direct_vm,
        contract,
        direct_alice,
        direct_bob,
        direct_charlie,
        proposed_sha=PROPOSED_SHA,
        proposed_url=PROPOSED_URL,
        fee=0,
    )
    _mock_image(direct_vm, REFERENCE_URL, REFERENCE_BYTES)
    _mock_image(direct_vm, PROPOSED_URL, PROPOSED_BYTES)
    assert contract.authenticate_evidence("evidence-001") == "AUTHENTICATED"
    assert direct_vm.run_validator() is True
    direct_vm.mock_llm(".*", json.dumps(_vector()))
    assert contract.adjudicate_usage("request-001") == "PERMITTED"
    assert direct_vm.run_validator() is True
    direct_vm.sender = direct_charlie
    assert contract.settle_request("request-001") == "PAYOUT_ALLOCATED"
    assert contract.get_claimable(_address(direct_charlie)) == 0
    assert contract.get_accounting_status() == {
        "total_escrow_received": 0,
        "total_escrowed": 0,
        "total_payout_allocated": 0,
        "total_refund_allocated": 0,
        "total_claimable_outstanding": 0,
        "total_refundable_outstanding": 0,
        "total_withdrawal_emitted": 0,
        "conservation_rhs": 0,
    }


def test_permitted_entitlement_has_one_native_withdrawal_exit(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
    direct_charlie,
) -> None:
    contract = direct_deploy("contracts/rightsrail.py")
    _prepare_case(
        direct_vm,
        contract,
        direct_alice,
        direct_bob,
        direct_charlie,
        proposed_sha=PROPOSED_SHA,
        proposed_url=PROPOSED_URL,
        fee=10,
    )
    _mock_image(direct_vm, REFERENCE_URL, REFERENCE_BYTES)
    _mock_image(direct_vm, PROPOSED_URL, PROPOSED_BYTES)
    assert contract.authenticate_evidence("evidence-001") == "AUTHENTICATED"
    assert direct_vm.run_validator() is True
    direct_vm.mock_llm(".*", json.dumps(_vector()))
    assert contract.adjudicate_usage("request-001") == "PERMITTED"
    assert direct_vm.run_validator() is True
    direct_vm.sender = direct_charlie
    assert contract.settle_request("request-001") == "PAYOUT_ALLOCATED"
    settlement_id = contract.get_settlement_ids(0, 64)[0]

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("only the frozen entitlement recipient may withdraw"):
        contract.withdraw_claimable(settlement_id)

    direct_vm.sender = direct_charlie
    direct_vm.deal(direct_vm._contract_address, 10)
    withdrawal_id = contract.withdraw_claimable(settlement_id)
    assert withdrawal_id.startswith("withdraw-")
    withdrawal = contract.get_withdrawal(withdrawal_id)
    settlement = contract.get_settlement(settlement_id)
    accounting = contract.get_accounting_status()
    assert withdrawal["status"] == "WITHDRAWAL_EMITTED"
    assert withdrawal["amount"] == 10
    assert settlement["withdrawal_id"] == withdrawal_id
    assert settlement["delivery_status"] == "WITHDRAWAL_EMITTED"
    assert contract.get_claimable(_address(direct_charlie)) == 0
    assert accounting["total_claimable_outstanding"] == 0
    assert accounting["total_withdrawal_emitted"] == 10
    assert accounting["conservation_rhs"] == 10

    with direct_vm.expect_revert("settlement entitlement has already been consumed"):
        contract.withdraw_claimable(settlement_id)


def test_refund_entitlement_has_requester_only_withdrawal_exit(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
    direct_charlie,
) -> None:
    contract = direct_deploy("contracts/rightsrail.py")
    _prepare_case(
        direct_vm,
        contract,
        direct_alice,
        direct_bob,
        direct_charlie,
        proposed_sha=PROPOSED_SHA,
        proposed_url=PROPOSED_URL,
        fee=10,
    )
    _mock_image(direct_vm, REFERENCE_URL, REFERENCE_BYTES)
    _mock_image(direct_vm, PROPOSED_URL, PROPOSED_BYTES)
    assert contract.authenticate_evidence("evidence-001") == "AUTHENTICATED"
    assert direct_vm.run_validator() is True
    direct_vm.mock_llm(".*", json.dumps(_vector(prohibited_context_present=True)))
    assert contract.adjudicate_usage("request-001") == "DENIED"
    assert direct_vm.run_validator() is True
    direct_vm.sender = direct_charlie
    assert contract.settle_request("request-001") == "REFUND_ALLOCATED"
    settlement_id = contract.get_settlement_ids(0, 64)[0]

    with direct_vm.expect_revert("only the frozen entitlement recipient may withdraw"):
        contract.withdraw_refund(settlement_id)

    direct_vm.sender = direct_bob
    direct_vm.deal(direct_vm._contract_address, 10)
    withdrawal_id = contract.withdraw_refund(settlement_id)
    assert contract.get_withdrawal(withdrawal_id)["entitlement_type"] == "REFUND_ALLOCATED"
    assert contract.get_refundable(_address(direct_bob)) == 0
    assert contract.get_accounting_status()["total_refundable_outstanding"] == 0

    with direct_vm.expect_revert("settlement entitlement has already been consumed"):
        contract.withdraw_refund(settlement_id)
