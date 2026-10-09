"""Mocked native-value qualification without broadcasting or spending GEN."""

from __future__ import annotations

import importlib
import json

import pytest

from tests.direct.test_multimodal_consensus_cases import (
    PROPOSED_BYTES,
    PROPOSED_SHA,
    PROPOSED_URL,
    REFERENCE_BYTES,
    REFERENCE_URL,
    _mock_image,
    _prepare_case,
    _vector,
)


@pytest.mark.parametrize(
    ("vector", "expected", "recipient"),
    [
        (_vector(), "PERMITTED", "issuer_recipient"),
        (
            _vector(prohibited_context_present=True, endorsement_implied=True),
            "DENIED",
            "requester",
        ),
        (_vector(evidence_sufficient=False), "INCONCLUSIVE", "requester"),
        (_vector(asset_match=False), "NOT_APPLICABLE", "requester"),
    ],
)
def test_settlement_calls_the_frozen_value_binding_once(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
    direct_charlie,
    vector,
    expected,
    recipient,
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

    transfers: list[tuple[str, int]] = []
    contract_module = importlib.import_module("_contract_rightsrail")

    class FakePayable:
        def __init__(self, address):
            self.address = address

        def emit_transfer(self, *, value):
            transfers.append((self.address.as_hex, int(value)))

    contract_module._Payable = FakePayable
    direct_vm.sender = direct_charlie
    assert contract.settle_request("request-001") == (
        "TRANSFERRED" if expected == "PERMITTED" else "REFUNDED"
    )
    assert len(transfers) == 1
    assert transfers[0][1] == 10
    assert contract.get_request("request-001")["escrowed_value"] == 10
    assert len(contract.get_permit_ids(0, 64)) == (1 if expected == "PERMITTED" else 0)

    with direct_vm.expect_revert("settlement requires terminal adjudication"):
        contract.settle_request("request-001")
    assert len(transfers) == 1

    if expected == "PERMITTED":
        assert transfers[0][0].lower() == _address_hex(direct_charlie).lower()
    else:
        assert transfers[0][0].lower() == _address_hex(direct_bob).lower()


def _address_hex(value) -> str:
    if hasattr(value, "as_hex"):
        return value.as_hex
    import genlayer as gl

    return gl.Address(value).as_hex
