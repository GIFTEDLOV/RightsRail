from __future__ import annotations

import unittest

from rightsrail_domain import (
    AuthorizationError,
    PolicyState,
    RightsRailState,
    StateTransitionError,
)
from rightsrail_policy_engine import PolicyResult

from tests.test_fixtures import (
    ASSET_SHA,
    ISSUER,
    LICENSE_SHA,
    NOW,
    OTHER_ASSET_SHA,
    RECIPIENT,
    build_state,
    compliant_vector,
)


class RightsRailStateMachineTests(unittest.TestCase):
    def test_policy_is_editable_only_before_freeze_and_close_preserves_history(self) -> None:
        state = build_state()
        # The fixture is already frozen; an adversarial issuer cannot rewrite it.
        with self.assertRaises(StateTransitionError):
            state.edit_policy(
                caller=ISSUER, policy_id="policy-fictional-001", license_text="rewritten"
            )
        with self.assertRaises(AuthorizationError):
            state.close_policy(caller="attacker", policy_id="policy-fictional-001")
        state.close_policy(caller=ISSUER, policy_id="policy-fictional-001")
        self.assertEqual(state.policies["policy-fictional-001"].state, PolicyState.CLOSED)
        self.assertIn("request-001", state.requests)
        self.assertIn("evidence-001", state.evidence)
        self.assertGreaterEqual(len(state.journal), 5)

    def test_draft_edit_is_authorized_and_then_freeze_is_immutable(self) -> None:
        state = RightsRailState(clock=lambda: NOW)
        state.register_policy(
            policy_id="draft-001",
            issuer=ISSUER,
            asset_sha256=ASSET_SHA,
            asset_exact_bytes=1,
            asset_media_type="image/png",
            asset_source="fixture://asset",
            license_text_sha256=LICENSE_SHA,
            license_text_exact_bytes=1,
            license_text="v1",
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
        edited = state.edit_policy(
            caller=ISSUER,
            policy_id="draft-001",
            allowed_channels=("web", "newsletter"),
        )
        self.assertEqual(edited.allowed_channels, ("web", "newsletter"))
        state.freeze_policy(caller=ISSUER, policy_id="draft-001")
        with self.assertRaises(StateTransitionError):
            state.edit_policy(caller=ISSUER, policy_id="draft-001", allowed_channels=("private",))

    def test_compliant_case_is_permitted_and_issues_bound_permit(self) -> None:
        state = build_state()
        adjudication = state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=compliant_vector(),
            generation=1,
        )
        settlement = state.settle(request_id="request-001")
        self.assertEqual(adjudication.result, PolicyResult.PERMITTED.value)
        self.assertEqual(settlement.status, "PAYOUT_ALLOCATED")
        self.assertEqual(settlement.amount, 10)
        self.assertEqual(settlement.recipient, RECIPIENT)
        self.assertEqual(state.requests["request-001"].escrow_consumed, 10)
        self.assertEqual(state.requests["request-001"].entitlement_type, "PAYOUT_ALLOCATED")
        self.assertEqual(state.claimable_by_address[RECIPIENT], 10)
        self.assertEqual(state.total_escrow_received, 10)
        self.assertEqual(state.total_escrowed, 0)
        self.assertEqual(state.total_payout_allocated, 10)
        self.assertEqual(state.total_refund_allocated, 0)
        self.assertEqual(len(state.permits), 1)
        permit = next(iter(state.permits.values()))
        self.assertEqual(permit.policy_id, "policy-fictional-001")
        self.assertEqual(permit.request_digest, state.requests["request-001"].request_digest)
        self.assertEqual(permit.fee_paid, 10)

    def test_adversarial_case_is_denied_without_permit(self) -> None:
        state = build_state()
        vector = compliant_vector()
        vector.update(prohibited_context_present=True, endorsement_implied=True)
        adjudication = state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=vector,
            generation=1,
        )
        settlement = state.settle(request_id="request-001")
        self.assertEqual(adjudication.result, PolicyResult.DENIED.value)
        self.assertEqual(settlement.status, "REFUND_ALLOCATED")
        self.assertEqual(settlement.recipient, "requester-001")
        self.assertEqual(state.refundable_by_address["requester-001"], 10)
        self.assertEqual(state.total_escrowed, 0)
        self.assertEqual(state.total_refund_allocated, 10)
        self.assertEqual(state.permits, {})

    def test_inconclusive_takes_precedence_and_refunds(self) -> None:
        state = build_state()
        vector = compliant_vector()
        vector["evidence_sufficient"] = False
        adjudication = state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=vector,
            generation=1,
        )
        settlement = state.settle(request_id="request-001")
        self.assertEqual(adjudication.result, PolicyResult.INCONCLUSIVE.value)
        self.assertEqual(settlement.status, "REFUND_ALLOCATED")
        self.assertEqual(state.refundable_by_address["requester-001"], 10)
        self.assertEqual(state.permits, {})

    def test_unrelated_asset_is_not_applicable(self) -> None:
        state = build_state(proposed_asset_sha256=OTHER_ASSET_SHA)
        vector = compliant_vector()
        vector["asset_match"] = False
        adjudication = state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=vector,
            generation=1,
        )
        state.settle(request_id="request-001")
        self.assertEqual(adjudication.result, PolicyResult.NOT_APPLICABLE.value)
        self.assertEqual(state.permits, {})

    def test_two_independent_requests_conserve_payout_and_refund_entitlements(self) -> None:
        state = build_state()
        state.submit_request(
            request_id="request-002",
            policy_id="policy-fictional-001",
            policy_version=1,
            requester="requester-002",
            purpose_description="commercial editorial newsletter follow-up",
            channel="newsletter",
            context_description="independent editorial article with no endorsement",
            proposed_asset_sha256=ASSET_SHA,
            proposed_asset_exact_bytes=1500,
            proposed_media_type="image/png",
            public_evidence_url="https://example.test/article-2",
            attribution_text="Image courtesy of the issuer",
            escrowed_value=10,
        )
        state.commit_evidence(
            evidence_id="evidence-002",
            request_id="request-002",
            reference_asset_sha256=ASSET_SHA,
            proposed_asset_sha256=ASSET_SHA,
            content_sha256="c" * 64,
            exact_byte_length=512,
            media_type="text/html",
            source_digest="d" * 64,
            authority_digest="e" * 64,
            schema_version="RIGHTSRAIL_EVIDENCE_V1",
            reference_source="fixture://protected/original.png",
            proposed_source="fixture://proposed/use-2.png",
            public_evidence_url="https://example.test/article-2",
        )
        state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=compliant_vector(),
            generation=1,
        )
        denied = compliant_vector()
        denied["prohibited_context_present"] = True
        state.record_adjudication(
            request_id="request-002",
            evidence_id="evidence-002",
            semantic_output=denied,
            generation=1,
        )
        state.settle(request_id="request-001")
        state.settle(request_id="request-002")
        self.assertEqual(state.total_escrow_received, 20)
        self.assertEqual(state.total_escrowed, 0)
        self.assertEqual(state.total_payout_allocated, 10)
        self.assertEqual(state.total_refund_allocated, 10)
        self.assertEqual(state.claimable_by_address[RECIPIENT], 10)
        self.assertEqual(state.refundable_by_address["requester-002"], 10)
        self.assertEqual(
            state.total_escrow_received,
            state.total_escrowed + state.total_payout_allocated + state.total_refund_allocated,
        )

    def test_evidence_and_first_adjudication_are_append_only(self) -> None:
        state = build_state()
        with self.assertRaises(StateTransitionError):
            state.commit_evidence(
                evidence_id="evidence-002",
                request_id="request-001",
                reference_asset_sha256=ASSET_SHA,
                proposed_asset_sha256=ASSET_SHA,
                content_sha256="c" * 64,
                exact_byte_length=1,
                media_type="image/png",
                source_digest="d" * 64,
                authority_digest="e" * 64,
                schema_version="RIGHTSRAIL_EVIDENCE_V1",
                reference_source="fixture://protected/other.png",
                proposed_source="fixture://proposed/other.png",
                public_evidence_url=None,
            )
        state.record_adjudication(
            request_id="request-001",
            evidence_id="evidence-001",
            semantic_output=compliant_vector(),
            generation=1,
        )
        with self.assertRaises(StateTransitionError):
            state.record_adjudication(
                request_id="request-001",
                evidence_id="evidence-001",
                semantic_output={**compliant_vector(), "endorsement_implied": True},
                generation=1,
            )


if __name__ == "__main__":
    unittest.main()
