"""Offline execution of actual RightsRail recovery method with a minimal GenLayer shim.

This does not replace real GenVM validation/consensus or EVM transfer tests.
"""
from __future__ import annotations

import importlib.util
import sys
import types
from datetime import UTC, datetime
from pathlib import Path

import pytest

CONTRACT_PATH = Path(__file__).parents[2] / "contracts" / "rightsrail.py"
REQ = "request-lost-001"
POLICY = "policy-001"
REQUESTER = "0x1111111111111111111111111111111111111111"
ISSUER = "0x2222222222222222222222222222222222222222"


class Address:
    def __init__(self, value):
        self.as_hex = str(value).lower()
        assert self.as_hex.startswith("0x") and len(self.as_hex) == 42


class Decorators:
    @staticmethod
    def view(fn):
        return fn

    @staticmethod
    def write(fn):
        return fn


Decorators.write.payable = lambda fn: fn


def _load_with_shim(monkeypatch):
    gl = types.ModuleType("genlayer")
    gl.u256 = int
    gl.Address = Address
    gl.storage = types.SimpleNamespace(TreeMap=dict, DynArray=list)
    gl.contract = types.SimpleNamespace(Contract=object)
    gl.public = Decorators
    gl.evm = types.SimpleNamespace(contract_interface=lambda x: x)
    gl.vm = types.SimpleNamespace(UserError=ValueError, Return=object)
    gl.message = types.SimpleNamespace(
        sender_address=Address(REQUESTER),
        value=0,
        raw={"datetime": "2026-10-10T00:00:00Z"},
    )
    monkeypatch.setitem(sys.modules, "genlayer", gl)
    spec = importlib.util.spec_from_file_location("rightsrail_offline_recovery", CONTRACT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    contract = module.RightsRail()
    for name in (
        "policy_records", "policy_versions", "request_records", "request_digests",
        "evidence_records", "evidence_by_request", "evidence_auth_records",
        "evidence_auth_latest", "evidence_auth_attempts", "adjudication_records",
        "adjudication_by_request", "permit_records", "permit_by_request",
        "settlement_records", "settlement_by_request", "withdrawal_records",
        "withdrawal_by_settlement", "claimable_by_address", "refundable_by_address",
    ):
        setattr(contract, name, {})
    for name in (
        "policy_ids", "request_ids", "evidence_ids", "evidence_auth_ids", "adjudication_ids",
        "permit_ids", "settlement_ids", "withdrawal_ids", "audit_records",
    ):
        setattr(contract, name, [])
    contract._save(contract.policy_records, POLICY, {
        "policy_id": POLICY, "version": 1, "required_fee_wei": 10,
    })
    contract._save(contract.request_records, REQ, {
        "request_id": REQ, "policy_id": POLICY, "policy_version": 1,
        "requester": REQUESTER, "state": module.REQUEST_SUBMITTED,
        "required_fee": 10, "escrowed_value": 10, "escrow_received": 10,
        "escrow_consumed": 0, "entitlement_type": "", "entitlement_recipient": "",
        "entitlement_amount": 0, "settlement_id": "", "settled_at": 0,
        "created_at": 1791590400, "generation": 0,
    })
    contract.total_escrow_received = 10
    contract.total_escrowed = 10
    return module, gl, contract


def _set_time(gl, ts):
    gl.message.raw["datetime"] = datetime.fromtimestamp(ts, tz=UTC).isoformat()


def test_uncommitted_escrow_only_requester_after_grace_period(monkeypatch):
    m, gl, c = _load_with_shim(monkeypatch)
    created = c._request(REQ)["created_at"]
    _set_time(gl, created + m.MIN_UNADJUDICATED_REFUND_DELAY_SECONDS - 1)
    with pytest.raises(ValueError, match="grace period"):
        c.refund_unadjudicated_request(REQ)
    _set_time(gl, created + m.MIN_UNADJUDICATED_REFUND_DELAY_SECONDS)
    gl.message.sender_address = Address(ISSUER)
    with pytest.raises(ValueError, match="only the original requester"):
        c.refund_unadjudicated_request(REQ)
    gl.message.sender_address = Address(REQUESTER)
    assert c.refund_unadjudicated_request(REQ) == "REFUND_ALLOCATED"
    settlement_id = c.get_settlement_ids(0, 64)[0]
    settlement = c.get_settlement(settlement_id)
    assert settlement["result"] == "CANCELLED_UNADJUDICATED"
    assert settlement["adjudication_id"] == ""
    assert settlement["permit_id"] == ""
    assert c.get_request(REQ)["state"] == "SETTLED"
    assert c.get_refundable(Address(REQUESTER)) == 10
    assert c.get_accounting_status()["total_escrowed"] == 0
    assert c.get_accounting_status()["conservation_rhs"] == 10
    assert c.get_permit_ids(0, 64) == []
    with pytest.raises(ValueError, match="pre-adjudication"):
        c.refund_unadjudicated_request(REQ)


def test_terminal_auth_failure_can_refund_immediately_and_cannot_reauthenticate(monkeypatch):
    m, gl, c = _load_with_shim(monkeypatch)
    request = c._request(REQ)
    request["state"] = m.REQUEST_EVIDENCE_COMMITTED
    c._save(c.request_records, REQ, request)
    evidence_id = "evidence-001"
    c._save(c.evidence_records, evidence_id, {"evidence_id": evidence_id, "request_id": REQ})
    c.evidence_by_request[REQ] = evidence_id
    auth_id = "evidence-001|0"
    c._save(c.evidence_auth_records, auth_id, {"status": m.AUTHENTICATION_FAILED})
    c.evidence_auth_latest[evidence_id] = auth_id
    _set_time(gl, request["created_at"] + 1)
    assert c.refund_unadjudicated_request(REQ) == "REFUND_ALLOCATED"
    with pytest.raises(ValueError, match="authentication requires EVIDENCE_COMMITTED"):
        c.authenticate_evidence(evidence_id)
    with pytest.raises(ValueError, match="adjudication requires EVIDENCE_COMMITTED"):
        c.adjudicate_usage(REQ)
    with pytest.raises(ValueError, match="settlement requires terminal adjudication"):
        c.settle_request(REQ)


def test_adjudicated_request_never_uses_recovery(monkeypatch):
    m, gl, c = _load_with_shim(monkeypatch)
    request = c._request(REQ)
    request["state"] = m.REQUEST_ADJUDICATED
    c._save(c.request_records, REQ, request)
    _set_time(gl, request["created_at"] + 10 * 86400)
    with pytest.raises(ValueError, match="pre-adjudication"):
        c.refund_unadjudicated_request(REQ)


def test_future_timestamp_rejected_even_after_auth_failure(monkeypatch):
    m, gl, c = _load_with_shim(monkeypatch)
    _set_time(gl, c._request(REQ)["created_at"] - 1)
    with pytest.raises(ValueError, match="transaction time precedes"):
        c.refund_unadjudicated_request(REQ)


def test_recovered_entitlement_uses_existing_claimant_only_withdrawal(monkeypatch):
    m, gl, c = _load_with_shim(monkeypatch)
    created = c._request(REQ)["created_at"]
    _set_time(gl, created + m.MIN_UNADJUDICATED_REFUND_DELAY_SECONDS)
    assert c.refund_unadjudicated_request(REQ) == "REFUND_ALLOCATED"
    sid = c.get_settlement_ids(0, 64)[0]
    gl.message.sender_address = Address(ISSUER)
    with pytest.raises(ValueError, match="only the frozen entitlement recipient"):
        c.withdraw_refund(sid)
    gl.message.sender_address = Address(REQUESTER)
    c.balance = 10
    emitted = []

    class StubNativeRecipient:
        def __init__(self, recipient):
            self.recipient = recipient

        def emit_transfer(self, *, value):
            emitted.append((self.recipient.as_hex, value))

    monkeypatch.setattr(m, "NativeRecipient", StubNativeRecipient)
    wid = c.withdraw_refund(sid)
    assert emitted == [(REQUESTER, 10)]
    assert c.get_withdrawal(wid)["delivery_confirmation"] == "NOT_AVAILABLE"
    assert c.get_accounting_status()["total_withdrawal_emitted"] == 10
    assert c.get_accounting_status()["total_refundable_outstanding"] == 0
    assert c.get_accounting_status()["conservation_rhs"] == 10
    with pytest.raises(ValueError, match="already been consumed"):
        c.withdraw_refund(sid)
