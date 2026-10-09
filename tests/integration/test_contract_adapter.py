from __future__ import annotations

import unittest

from rightsrail_genlayer import ConsensusReject, SemanticContext, leader_fn, validator_fn

from tests.adversarial.test_semantic_parser import _GL, _call, _vector
from tests.test_fixtures import build_state


def _context() -> SemanticContext:
    state = build_state()
    return SemanticContext(
        policy=state.policies["policy-fictional-001"],
        request=state.requests["request-001"],
        evidence=state.evidence["evidence-001"],
        reference_image_source="fixture://protected/original.png",
        proposed_image_source="fixture://proposed/use.png",
        public_evidence_url="https://example.test/article",
    )


class ContractAdapterTests(unittest.TestCase):
    def test_adjudicate_mutates_only_after_leader_and_validator_accept(self) -> None:
        def context_loader(_: object) -> SemanticContext:
            return _context()

        def evaluator(_: object) -> dict[str, bool]:
            return _vector()

        leader_result = leader_fn(_GL(_call()), evaluator, context_loader)
        accepted = validator_fn(
            _GL(_call()), leader_result, evaluator, context_loader
        )
        self.assertEqual(accepted, {"accepted": True})

    def test_validator_rejection_leaves_canonical_state_unchanged(self) -> None:
        calls = 0

        def rotating_evaluator(_: object) -> dict[str, bool]:
            nonlocal calls
            calls += 1
            result = _vector()
            if calls == 2:
                result["endorsement_implied"] = False
            return result

        with self.assertRaises(ConsensusReject):
            def context_loader(_: object) -> SemanticContext:
                return _context()

            leader_result = leader_fn(_GL(_call()), rotating_evaluator, context_loader)
            validator_fn(
                _GL(_call()),
                leader_result,
                rotating_evaluator,
                context_loader,
            )
        self.assertEqual(calls, 2)


if __name__ == "__main__":
    unittest.main()
