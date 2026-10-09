"""Shared deterministic fixtures for the phase-one test suite."""

from __future__ import annotations

from datetime import UTC, datetime

from rightsrail_domain import RightsRailState
from rightsrail_shared import sha256_text

ASSET_SHA = "a" * 64
OTHER_ASSET_SHA = "b" * 64
LICENSE_SHA = sha256_text("RightsRail fictional editorial license v1")
ISSUER = "issuer-001"
REQUESTER = "requester-001"
RECIPIENT = "settlement-001"
NOW = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def compliant_vector() -> dict[str, bool]:
    return {
        "asset_match": True,
        "purpose_within_scope": True,
        "prohibited_context_present": False,
        "transformation_within_scope": True,
        "attribution_satisfied": True,
        "endorsement_implied": False,
        "evidence_sufficient": True,
    }


def build_state(*, proposed_asset_sha256: str = ASSET_SHA) -> RightsRailState:
    state = RightsRailState(clock=lambda: NOW)
    state.register_policy(
        policy_id="policy-fictional-001",
        issuer=ISSUER,
        asset_sha256=ASSET_SHA,
        asset_exact_bytes=2048,
        asset_media_type="image/png",
        asset_source="fixture://protected/original.png",
        license_text_sha256=LICENSE_SHA,
        license_text_exact_bytes=35,
        license_text="Commercial editorial/web use; attribution required.",
        allowed_purposes=("commercial editorial", "web article"),
        prohibited_purposes=("gambling promotion",),
        allowed_channels=("newsletter", "article"),
        prohibited_contexts=("betting advertisement", "impersonation"),
        transformation_rules=("cropping allowed", "color changes allowed"),
        attribution_requirement="visible attribution required",
        endorsement_rule="synthetic endorsement prohibited",
        valid_from=NOW,
        valid_until=None,
        required_fee_wei=10,
        settlement_recipient=RECIPIENT,
    )
    state.freeze_policy(caller=ISSUER, policy_id="policy-fictional-001")
    state.submit_request(
        request_id="request-001",
        policy_id="policy-fictional-001",
        policy_version=1,
        requester=REQUESTER,
        purpose_description="commercial editorial newsletter article",
        channel="newsletter",
        context_description="independent editorial article with no endorsement",
        proposed_asset_sha256=proposed_asset_sha256,
        proposed_asset_exact_bytes=1500,
        proposed_media_type="image/png",
        public_evidence_url="https://example.test/article",
        attribution_text="Image courtesy of the issuer",
        escrowed_value=10,
    )
    state.commit_evidence(
        evidence_id="evidence-001",
        request_id="request-001",
        reference_asset_sha256=ASSET_SHA,
        proposed_asset_sha256=proposed_asset_sha256,
        content_sha256=sha256_text("fixture evidence page"),
        exact_byte_length=512,
        media_type="text/html",
        source_digest=sha256_text("fixture://protected/original.png|fixture://proposed/use.png"),
        authority_digest=sha256_text("authority:fixture"),
        schema_version="RIGHTSRAIL_EVIDENCE_V1",
        reference_source="fixture://protected/original.png",
        proposed_source="fixture://proposed/use.png",
        public_evidence_url="https://example.test/article",
    )
    return state
