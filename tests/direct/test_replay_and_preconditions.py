"""Replay, duplication, and one-state-too-early tests for canonical state."""

from __future__ import annotations

import unittest

from rightsrail_domain import (
    AuthorizationError,
    InvariantViolation,
    RightsRailError,
    RightsRailState,
    StateTransitionError,
)

from tests.test_fixtures import (
    ASSET_SHA,
    ISSUER,
    LICENSE_SHA,
    NOW,
    RECIPIENT,
    build_state,
    compliant_vector,
)


class ReplayAndPreconditionTests(unittest.TestCase):
    def test_one_state_too_early_operations_are_rejected(self) -> None:
        state = RightsRailState()
        state.register_policy(
            policy_id="draft-early",
            issuer=ISSUER,
            asset_sha256=ASSET_SHA,
            asset_exact_bytes=1,
            asset_media_type="image/png",
            asset_source="fixture://asset",
            license_text_sha256=LICENSE_SHA,
            license_text_exact_bytes=1,
            license_text="v",
            allowed_purposes=("editorial",),
            prohibited_purposes=(),
            allowed_channels=("web",),
            prohibited_contexts=(),
            transformation_rules=("crop",),
            attribution_requirement="required",
            endorsement_rule="none",
            valid_from=NOW,
            valid_until=None,
            required_fee_wei=0,
            settlement_recipient=RECIPIENT,
        )
        with self.assertRaises(StateTransitionError):
            state.submit_request(
                request_id="too-early",
                policy_id="draft-early",
                policy_version=1,
                requester="requester-001",
                purpose_description="editorial",
                channel="web",
                context_description="context",
                proposed_asset_sha256=ASSET_SHA,
                proposed_asset_exact_bytes=1,
                proposed_media_type="image/png",
                public_evidence_url=None,
                attribution_text="required",
                escrowed_value=0,
            )

        state = build_state()
        with self.assertRaises(StateTransitionError):
            state.freeze_policy(caller=ISSUER, policy_id="policy-fictional-001")
        with self.assertRaises(StateTransitionError):
            state.edit_policy(
                caller=ISSUER, policy_id="policy-fictional-001", license_text="mutated"
            )

    def test_duplicate_request_digest_is_rejected(self) -> None:
        state = build_state()
        request = state.requests["request-001"]
        with self.assertRaises(StateTransitionError):
            state.submit_request(
                request_id="request-002",
                policy_id=request.policy_id,
                policy_version=request.policy_version,
                requester=request.requester,
                purpose_description=request.purpose_description,
                channel=request.channel,
                context_description=request.context_description,
                proposed_asset_sha256=request.proposed_asset_sha256,
                proposed_asset_exact_bytes=request.proposed_asset_exact_bytes,
                proposed_media_type=request.proposed_media_type,
                public_evidence_url=request.public_evidence_url,
                attribution_text=request.attribution_text,
                escrowed_value=request.escrowed_value,
            )

    def test_duplicate_evidence_adjudication_and_settlement_are_rejected(self) -> None:
        state = build_state()
        evidence = state.evidence["evidence-001"]
        with self.assertRaises(StateTransitionError):
            state.commit_evidence(
                evidence_id="evidence-002",
                request_id="request-001",
                reference_asset_sha256=evidence.reference_asset_sha256,
                proposed_asset_sha256=evidence.proposed_asset_sha256,
                content_sha256=evidence.content_sha256,
                exact_byte_length=evidence.exact_byte_length,
                media_type=evidence.media_type,
                source_digest=evidence.source_digest,
                authority_digest=evidence.authority_digest,
                schema_version=evidence.schema_version,
                reference_source=evidence.reference_source,
                proposed_source=evidence.proposed_source,
                public_evidence_url=evidence.public_evidence_url,
            )
        state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=compliant_vector(),
            generation=1,
        )
        state.settle(request_id="request-001")
        with self.assertRaises(StateTransitionError):
            state.record_adjudication(
                request_id="request-001",
                evidence_id="evidence-001",
                semantic_output=compliant_vector(),
                generation=2,
            )
        with self.assertRaises(StateTransitionError):
            state.settle(request_id="request-001")

    def test_generation_must_increment_once_and_wrong_evidence_request_is_rejected(self) -> None:
        state = build_state()
        with self.assertRaises(InvariantViolation):
            state.record_adjudication(
                request_id="request-001",
                evidence_id="evidence-001",
                semantic_output=compliant_vector(),
                generation=0,
            )

        with self.assertRaises(RightsRailError):
            state._evidence_for("request-001", "not-the-request-evidence")

    def test_wrong_issuer_cannot_close_or_edit(self) -> None:
        state = build_state()
        with self.assertRaises(AuthorizationError):
            state.close_policy(caller="attacker", policy_id="policy-fictional-001")
        with self.assertRaises(AuthorizationError):
            state.edit_policy(
                caller="attacker", policy_id="policy-fictional-001", license_text="mutated"
            )


if __name__ == "__main__":
    unittest.main()
