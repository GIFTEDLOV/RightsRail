from __future__ import annotations

import unittest

from rightsrail_genlayer import (
    ConsensusReject,
    SemanticContext,
    leader_fn,
    parse_adjudication_calldata,
    validator_fn,
)
from rightsrail_policy_engine import (
    SEMANTIC_KEYS,
    SemanticSchemaError,
    parse_semantic_json,
    parse_semantic_vector,
)

from tests.test_fixtures import build_state


class _VM:
    def __init__(self, calldata: dict[str, object]) -> None:
        self.calldata = calldata

    def Return(self, value: object) -> object:
        return value


class _GL:
    def __init__(self, calldata: dict[str, object]) -> None:
        self.vm = _VM(calldata)


def _vector() -> dict[str, bool]:
    return {key: True for key in SEMANTIC_KEYS}


def _call() -> dict[str, object]:
    return {
        "request_id": "request-001",
        "policy_id": "policy-fictional-001",
        "policy_version": 1,
        "evidence_id": "evidence-001",
        "generation": 0,
    }


class SemanticParserAdversarialTests(unittest.TestCase):
    def test_exactly_seven_booleans_are_accepted(self) -> None:
        parsed = parse_semantic_vector(_vector())
        self.assertEqual(parsed.as_dict(), _vector())

    def test_missing_extra_and_non_boolean_values_are_rejected(self) -> None:
        for payload in (
            {key: True for key in SEMANTIC_KEYS[:-1]},
            {**_vector(), "confidence": True},
            {**_vector(), "asset_match": "true"},
            {**_vector(), "asset_match": 1},
            {**_vector(), "asset_match": None},
            "PERMITTED",
            [_vector()],
        ):
            with self.subTest(payload=payload):
                with self.assertRaises(SemanticSchemaError):
                    parse_semantic_vector(payload)

    def test_non_string_hostile_mapping_key_is_still_a_schema_error(self) -> None:
        payload: dict[object, object] = _vector()
        payload[7] = True
        with self.assertRaises(SemanticSchemaError):
            parse_semantic_vector(payload)

    def test_json_duplicate_keys_and_prose_are_rejected(self) -> None:
        duplicate = '{"asset_match":true,"asset_match":false}'
        with self.assertRaises(SemanticSchemaError):
            parse_semantic_json(duplicate)
        with self.assertRaises(SemanticSchemaError):
            parse_semantic_json("PERMITTED")
        with self.assertRaises(SemanticSchemaError):
            parse_semantic_json('{"asset_match":NaN}')

    def test_calldata_cannot_supply_semantic_vector(self) -> None:
        bad = {**_call(), "asset_match": True}
        with self.assertRaises(ConsensusReject):
            parse_adjudication_calldata(bad)

    def test_leader_requires_gl_vm_return_and_strict_output(self) -> None:
        class NoReturn:
            calldata = _call()

        context_loader = lambda _: object()
        with self.assertRaises(ConsensusReject):
            leader_fn(NoReturn(), lambda _: _vector(), context_loader)

        with self.assertRaises(ConsensusReject):
            leader_fn(_GL(_call()), lambda _: {**_vector(), "confidence": 0.9}, context_loader)

    def test_validator_rejects_malformed_leader_and_independent_disagreement(self) -> None:
        context_loader = lambda _: object()
        with self.assertRaises(ConsensusReject):
            validator_fn(_GL(_call()), "PERMITTED", lambda _: _vector(), context_loader)

        leader_result = _vector()
        different = {**_vector(), "endorsement_implied": False}
        with self.assertRaises(ConsensusReject):
            validator_fn(_GL(_call()), leader_result, lambda _: different, context_loader)

    def test_validator_compares_only_the_exact_boolean_vector(self) -> None:
        state = build_state()
        context = SemanticContext(
            policy=state.policies["policy-fictional-001"],
            request=state.requests["request-001"],
            evidence=state.evidence["evidence-001"],
            reference_image_source="fixture://protected/original.png",
            proposed_image_source="fixture://proposed/use.png",
            public_evidence_url="https://example.test/article",
        )
        context_loader = lambda _: context
        result = validator_fn(_GL(_call()), _vector(), lambda _: _vector(), context_loader)
        self.assertEqual(result, {"accepted": True})


if __name__ == "__main__":
    unittest.main()
