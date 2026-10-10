"""Regression coverage for deterministic GenLayer transaction timestamps."""

from __future__ import annotations

import hashlib

from tests.direct.test_multimodal_consensus_cases import (
    REFERENCE_BYTES,
    REFERENCE_SHA,
    REFERENCE_URL,
    _address,
)

LICENSE_TEXT = "Commercial editorial/web use; attribution required."
LICENSE_SHA = hashlib.sha256(LICENSE_TEXT.encode()).hexdigest()


def _create_and_freeze(
    contract, direct_vm, issuer, policy_id: str, valid_from: int, valid_until: int
) -> None:
    direct_vm.sender = issuer
    contract.create_policy(
        policy_id,
        REFERENCE_SHA,
        len(REFERENCE_BYTES),
        "image/png",
        REFERENCE_URL,
        LICENSE_SHA,
        len(LICENSE_TEXT.encode()),
        LICENSE_TEXT,
        ["commercial editorial"],
        ["gambling promotion"],
        ["newsletter"],
        ["betting advertisement"],
        ["cropping allowed"],
        "visible attribution required",
        "synthetic endorsement prohibited",
        valid_from,
        valid_until,
        10,
        _address(issuer),
    )
    contract.freeze_policy(policy_id)


def _submit(contract, direct_vm, requester, policy_id: str, request_id: str) -> None:
    direct_vm.sender = requester
    direct_vm.value = 10
    contract.submit_usage_request(
        request_id,
        policy_id,
        1,
        "commercial editorial newsletter",
        "newsletter",
        "independent article",
        REFERENCE_SHA,
        len(REFERENCE_BYTES),
        "image/png",
        "",
        "Image courtesy of issuer",
    )


def test_policy_window_uses_transaction_datetime_not_host_wall_clock(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
) -> None:
    contract = direct_deploy("contracts/rightsrail.py")

    direct_vm.warp("2025-12-31T23:59:59Z")
    _create_and_freeze(contract, direct_vm, direct_alice, "policy-future", 1767225600, 0)
    assert contract.get_policy("policy-future")["created_at"] == 1767225599
    with direct_vm.expect_revert("policy is outside its validity window"):
        _submit(contract, direct_vm, direct_bob, "policy-future", "request-too-early")

    direct_vm.warp("2026-01-01T00:00:00Z")
    _submit(contract, direct_vm, direct_bob, "policy-future", "request-active")
    assert contract.get_request("request-active")["created_at"] == 1767225600


def test_policy_window_rejects_expired_interval_and_accepts_zero_sentinel(
    direct_deploy,
    direct_vm,
    direct_alice,
    direct_bob,
) -> None:
    contract = direct_deploy("contracts/rightsrail.py")

    direct_vm.warp("2026-01-01T00:00:00Z")
    _create_and_freeze(contract, direct_vm, direct_alice, "policy-expiring", 1767225600, 1767312000)
    direct_vm.warp("2026-01-02T00:00:01Z")
    with direct_vm.expect_revert("policy is outside its validity window"):
        _submit(contract, direct_vm, direct_bob, "policy-expiring", "request-expired")

    direct_vm.warp("1970-01-01T00:00:00Z")
    _create_and_freeze(contract, direct_vm, direct_alice, "policy-unbounded", 0, 0)
    _submit(contract, direct_vm, direct_bob, "policy-unbounded", "request-unbounded")
    assert contract.get_request("request-unbounded")["created_at"] == 0
