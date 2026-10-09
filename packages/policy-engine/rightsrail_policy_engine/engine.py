"""Deterministic result policy. No semantic reasoning belongs in this module."""

from __future__ import annotations

from enum import StrEnum

from .semantic import SemanticVector


class PolicyResult(StrEnum):
    PERMITTED = "PERMITTED"
    DENIED = "DENIED"
    INCONCLUSIVE = "INCONCLUSIVE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


def evaluate_policy(vector: SemanticVector) -> PolicyResult:
    if vector.evidence_sufficient is False:
        return PolicyResult.INCONCLUSIVE
    if vector.asset_match is False:
        return PolicyResult.NOT_APPLICABLE
    if (
        vector.purpose_within_scope
        and vector.prohibited_context_present is False
        and vector.transformation_within_scope
        and vector.attribution_satisfied
        and vector.endorsement_implied is False
    ):
        return PolicyResult.PERMITTED
    return PolicyResult.DENIED
