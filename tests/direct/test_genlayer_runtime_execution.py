"""Smoke tests against the installed Studio-dev RC5 direct harness."""

from __future__ import annotations

import os

CONTRACT_PATH = os.path.join("contracts", "rightsrail.py")


def test_rightsrail_deploys_and_exposes_reads(direct_deploy) -> None:
    contract = direct_deploy(CONTRACT_PATH)

    info = contract.contract_info()
    assert info["name"] == "RightsRail"
    assert info["semantic_schema"] == "RIGHTSRAIL_USAGE_V1"
    assert info["max_semantic_images"] == 2
    assert contract.get_semantic_keys() == [
        "asset_match",
        "purpose_within_scope",
        "prohibited_context_present",
        "transformation_within_scope",
        "attribution_satisfied",
        "endorsement_implied",
        "evidence_sufficient",
    ]
