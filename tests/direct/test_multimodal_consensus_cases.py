"""Controlled RC5 direct-harness cases for the RightsRail trust boundary."""

from __future__ import annotations

import hashlib
import json
import re

import pytest

SEMANTIC_KEYS = (
    "asset_match",
    "purpose_within_scope",
    "prohibited_context_present",
    "transformation_within_scope",
    "attribution_satisfied",
    "endorsement_implied",
    "evidence_sufficient",
)
LICENSE_TEXT = "Commercial editorial/web use; attribution required."
LICENSE_SHA = hashlib.sha256(LICENSE_TEXT.encode()).hexdigest()
REFERENCE_BYTES = b"RightsRail fictional protected asset"
PROPOSED_BYTES = b"RightsRail fictional proposed editorial use"
OTHER_BYTES = b"RightsRail unrelated image"
REFERENCE_SHA = hashlib.sha256(REFERENCE_BYTES).hexdigest()
PROPOSED_SHA = hashlib.sha256(PROPOSED_BYTES).hexdigest()
OTHER_SHA = hashlib.sha256(OTHER_BYTES).hexdigest()
REFERENCE_URL = "https://rightsrail.test/reference.png"
PROPOSED_URL = "https://rightsrail.test/proposed.png"
OTHER_URL = "https://rightsrail.test/unrelated.png"


def _vector(**overrides: bool) -> dict[str, bool]:
    vector = {
        "asset_match": True,
        "purpose_within_scope": True,
        "prohibited_context_present": False,
        "transformation_within_scope": True,
        "attribution_satisfied": True,
        "endorsement_implied": False,
        "evidence_sufficient": True,
    }
    vector.update(overrides)
    return vector


def _authority_digest(reference: str, proposed: str) -> str:
    value = json.dumps(
        {
            "reference_source": reference,
            "proposed_source": proposed,
            "public_context_url": "",
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(value.encode()).hexdigest()


def _mock_image(direct_vm, url: str, body: bytes) -> None:
    direct_vm.mock_web(re.escape(url), {"status": 200, "body": body})


def _address(value):
    if hasattr(value, "as_hex"):
        return value
    import genlayer as gl

    return gl.Address(value)


def _prepare_case(
    direct_vm,
    contract,
    issuer,
    requester,
    recipient,
    *,
    proposed_sha,
    proposed_url,
    fee=0,
):
    direct_vm.sender = issuer
    contract.create_policy(
        "policy-fictional-001",
        REFERENCE_SHA,
        len(REFERENCE_BYTES),
        "image/png",
        REFERENCE_URL,
        LICENSE_SHA,
        len(LICENSE_TEXT.encode()),
        LICENSE_TEXT,
        ["commercial editorial", "web article"],
        ["gambling promotion"],
        ["newsletter", "article"],
        ["betting advertisement", "impersonation"],
        ["cropping allowed", "color changes allowed"],
        "visible attribution required",
        "synthetic endorsement prohibited",
        0,
        0,
        fee,
        _address(recipient),
    )
    contract.freeze_policy("policy-fictional-001")

    direct_vm.sender = requester
    direct_vm.value = fee
    contract.submit_usage_request(
        "request-001",
        "policy-fictional-001",
        1,
        "commercial editorial newsletter article",
        "newsletter",
        "independent editorial article with no endorsement",
        proposed_sha,
        len(PROPOSED_BYTES if proposed_sha == PROPOSED_SHA else OTHER_BYTES),
        "image/png",
        "",
        "Image courtesy of the issuer",
    )
    contract.commit_evidence(
        "evidence-001",
        "request-001",
        REFERENCE_URL,
        REFERENCE_SHA,
        len(REFERENCE_BYTES),
        "image/png",
        proposed_url,
        proposed_sha,
        len(PROPOSED_BYTES if proposed_sha == PROPOSED_SHA else OTHER_BYTES),
        "image/png",
        "",
        "",
        "",
        _authority_digest(REFERENCE_URL, proposed_url),
        "Image courtesy of the issuer",
    )


@pytest.mark.parametrize(
    ("case_name", "proposed_sha", "proposed_url", "proposed_body", "vector", "expected"),
    [
        ("A_COMPLIANT", PROPOSED_SHA, PROPOSED_URL, PROPOSED_BYTES, _vector(), "PERMITTED"),
        (
            "B_ADVERSARIAL",
            PROPOSED_SHA,
            PROPOSED_URL,
            PROPOSED_BYTES,
            _vector(prohibited_context_present=True, endorsement_implied=True),
            "DENIED",
        ),
        (
            "C_INSUFFICIENT",
            PROPOSED_SHA,
            PROPOSED_URL,
            PROPOSED_BYTES,
            _vector(evidence_sufficient=False),
            "INCONCLUSIVE",
        ),
        (
            "D_UNRELATED",
            OTHER_SHA,
            OTHER_URL,
            OTHER_BYTES,
            _vector(asset_match=False),
            "NOT_APPLICABLE",
        ),
    ],
)
def test_controlled_multimodal_consensus_cases(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
    direct_charlie,
    case_name,
    proposed_sha,
    proposed_url,
    proposed_body,
    vector,
    expected,
) -> None:
    del case_name
    contract = direct_deploy("contracts/rightsrail.py")
    _prepare_case(
        direct_vm,
        contract,
        direct_alice,
        direct_bob,
        direct_charlie,
        proposed_sha=proposed_sha,
        proposed_url=proposed_url,
    )
    _mock_image(direct_vm, REFERENCE_URL, REFERENCE_BYTES)
    _mock_image(direct_vm, proposed_url, proposed_body)
    assert contract.authenticate_evidence("evidence-001") == "AUTHENTICATED"
    entry = direct_vm._captured_validators[-1]
    assert "auth_id" not in entry[0]
    assert direct_vm.run_validator() is True

    direct_vm.mock_llm(".*", json.dumps(vector))
    result = contract.adjudicate_usage("request-001")
    assert result == expected
    assert direct_vm.run_validator() is True

    direct_vm.sender = direct_charlie
    settlement = contract.settle_request("request-001")
    assert settlement == (
        "PAYOUT_ALLOCATED" if expected == "PERMITTED" else "REFUND_ALLOCATED"
    )
    assert len(contract.get_permit_ids(0, 64)) == (1 if expected == "PERMITTED" else 0)
