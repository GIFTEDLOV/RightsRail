from __future__ import annotations

import unittest

from contracts.rightsrail import RightsRailContract
from rightsrail_genlayer import ConsensusReject

from tests.adversarial.test_semantic_parser import _GL, _call, _vector
from tests.test_fixtures import build_state


class ContractAdapterTests(unittest.TestCase):
    def test_adjudicate_mutates_only_after_leader_and_validator_accept(self) -> None:
        state = build_state()
        contract = RightsRailContract(state)
        adjudication = contract.adjudicate(_GL(_call()), lambda _: _vector())
        self.assertEqual(adjudication.result, "DENIED")
        self.assertEqual(len(state.adjudications), 1)

    def test_validator_rejection_leaves_canonical_state_unchanged(self) -> None:
        state = build_state()
        contract = RightsRailContract(state)
        calls = 0

        def rotating_evaluator(_: object) -> dict[str, bool]:
            nonlocal calls
            calls += 1
            result = _vector()
            if calls == 2:
                result["endorsement_implied"] = False
            return result

        with self.assertRaises(ConsensusReject):
            contract.adjudicate(_GL(_call()), rotating_evaluator)
        self.assertEqual(state.adjudications, {})
        self.assertEqual(state.settlements, {})


if __name__ == "__main__":
    unittest.main()
