"""Exact, fail-closed parser for the only consensus semantic output."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Mapping

SEMANTIC_SCHEMA = "RIGHTSRAIL_USAGE_V1"
SEMANTIC_KEYS = (
    "asset_match",
    "purpose_within_scope",
    "prohibited_context_present",
    "transformation_within_scope",
    "attribution_satisfied",
    "endorsement_implied",
    "evidence_sufficient",
)


class SemanticSchemaError(ValueError):
    """Raised when a model result is not exactly the seven-boolean schema."""


@dataclass(frozen=True)
class SemanticVector:
    asset_match: bool
    purpose_within_scope: bool
    prohibited_context_present: bool
    transformation_within_scope: bool
    attribution_satisfied: bool
    endorsement_implied: bool
    evidence_sufficient: bool

    def as_dict(self) -> dict[str, bool]:
        return {key: getattr(self, key) for key in SEMANTIC_KEYS}

    def as_tuple(self) -> tuple[bool, ...]:
        return tuple(getattr(self, key) for key in SEMANTIC_KEYS)


def _reject_constant(value: str) -> None:
    raise SemanticSchemaError(f"non-standard JSON constant is not allowed: {value}")


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise SemanticSchemaError(f"duplicate semantic key: {key}")
        result[key] = value
    return result


def parse_semantic_vector(value: Any) -> SemanticVector:
    if not isinstance(value, Mapping):
        raise SemanticSchemaError("semantic output must be an object")

    actual_keys = set(value.keys())
    expected_keys = set(SEMANTIC_KEYS)
    if actual_keys != expected_keys or len(value) != len(SEMANTIC_KEYS):
        missing = sorted(expected_keys - actual_keys)
        extra = sorted(actual_keys - expected_keys, key=repr)
        raise SemanticSchemaError(f"semantic keys mismatch; missing={missing}, extra={extra}")

    for key in SEMANTIC_KEYS:
        if type(value[key]) is not bool:
            raise SemanticSchemaError(f"{key} must be a JSON boolean")

    return SemanticVector(**{key: value[key] for key in SEMANTIC_KEYS})


def parse_semantic_json(payload: str | bytes) -> SemanticVector:
    try:
        parsed = json.loads(
            payload,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_constant,
        )
    except (json.JSONDecodeError, TypeError) as exc:
        raise SemanticSchemaError("semantic output is not valid JSON") from exc
    return parse_semantic_vector(parsed)
