"""Focused offline regression for the separate V2.4 audit-read candidate."""

from __future__ import annotations

from pathlib import Path

from tests.adversarial import test_unadjudicated_escrow_recovery as recovery

CANDIDATE_PATH = Path(__file__).parents[1] / "contracts" / "rightsrail_v24.py"


def test_v24_get_audit_events_reads_existing_records_in_pages(monkeypatch) -> None:
    original_path = recovery.CONTRACT_PATH
    recovery.CONTRACT_PATH = CANDIDATE_PATH
    try:
        _, _, contract = recovery._load_with_shim(monkeypatch)
    finally:
        recovery.CONTRACT_PATH = original_path

    contract.audit_records.extend(
        [
            '{"sequence":1,"action":"policy:create"}',
            '{"sequence":2,"action":"policy:freeze"}',
            '{"sequence":3,"action":"request:submit"}',
        ]
    )

    assert contract.get_audit_events(0, 2) == contract.audit_records[:2]
    assert contract.get_audit_events(2, 2) == contract.audit_records[2:]
    assert contract.get_audit_events(3, 2) == []
