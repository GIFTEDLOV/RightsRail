"""Run without GenLayer test harness to protect source and CI reproducibility."""

import hashlib
import unittest
from pathlib import Path

from tools.verify_genvm_ci import is_only_expected_reachability_warnings

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_CANDIDATE_SHA = "E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE"


class ReleasePortabilityTests(unittest.TestCase):
    def test_deployable_contract_has_exact_lf_bytes(self):
        source = (ROOT / "contracts/rightsrail.py").read_bytes()
        self.assertNotIn(b"\r\n", source)
        self.assertEqual(hashlib.sha256(source).hexdigest().upper(), EXPECTED_CANDIDATE_SHA)

    def test_lint_only_allows_known_reachability_warning(self):
        self.assertTrue(is_only_expected_reachability_warnings({"warnings": [{"code": "E010"}]}))
        self.assertFalse(
            is_only_expected_reachability_warnings(
                {"warnings": [{"code": "E010"}, {"code": "E999"}]}
            )
        )
        self.assertFalse(
            is_only_expected_reachability_warnings(
                {"warnings": [{"code": "E010"}], "errors": [{"code": "fatal"}]}
            )
        )
        self.assertFalse(is_only_expected_reachability_warnings({"warnings": []}))
        self.assertFalse(is_only_expected_reachability_warnings("invalid-json"))


if __name__ == "__main__":
    unittest.main()
