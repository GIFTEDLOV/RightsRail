"""Direct, deterministic checks on the deployable GenLayer contract surface."""

from __future__ import annotations

import ast
from pathlib import Path

CONTRACT = Path(__file__).parents[2] / "contracts" / "rightsrail.py"


def _source() -> str:
    return CONTRACT.read_text(encoding="utf-8")


def test_contract_has_pinned_header_and_blank_line() -> None:
    lines = _source().splitlines()
    assert lines[0] == (
        '# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }'
    )
    assert lines[1] == ""


def test_contract_uses_real_storage_and_consensus_primitives() -> None:
    source = _source()
    tree = ast.parse(source)
    contract_class = next(
        node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "RightsRail"
    )
    annotations = {
        node.target.id
        for node in contract_class.body
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name)
    }
    assert {
        "policy_records",
        "request_records",
        "evidence_records",
        "adjudication_records",
    } <= annotations
    assert {"permit_records", "settlement_records", "audit_records", "sequence"} <= annotations
    assert "gl.vm.run_nondet_default" in source
    assert "isinstance(leaders_result, gl.vm.Return)" in source
    assert "_semantic_tuple(leader) == _semantic_tuple(own)" in source
    assert "from genlayer import *" not in source
    assert "gl.public.view" in source
    assert "gl.public.write" in source
    assert "gl.public.write.payable" in source


def test_no_caller_semantic_vector_or_verdict_is_in_the_public_source() -> None:
    source = _source()
    assert "semantic_vector" in source  # persisted canonical output, not calldata
    assert "caller_semantic" not in source
    assert "caller_verdict" not in source
    assert "semantic_output" not in source
    assert "verdict:" not in source


def test_settlement_is_after_adjudication_and_permit_binding_is_explicit() -> None:
    source = _source()
    assert 'if request["state"] != REQUEST_ADJUDICATED' in source
    assert 'if adjudication["result"] not in RESULTS' in source
    assert '"permit_binding_hash"' in source
    assert '"request_digest": request["request_digest"]' in source
    assert '"settlement_recipient": policy["settlement_recipient"]' in source
    assert 'if amount > 0:' in source
