"""Canonical RightsRail domain models and append-only state machine."""

from .models import (
    Adjudication,
    AdjudicationState,
    Evidence,
    EvidenceStatus,
    JournalEntry,
    Permit,
    Policy,
    PolicyState,
    RequestState,
    Settlement,
    UsageRequest,
    Withdrawal,
)
from .state import (
    AuthorizationError,
    InvariantViolation,
    RightsRailError,
    RightsRailState,
    StateTransitionError,
)

__all__ = [
    "Adjudication",
    "AdjudicationState",
    "AuthorizationError",
    "Evidence",
    "EvidenceStatus",
    "InvariantViolation",
    "JournalEntry",
    "Permit",
    "Policy",
    "PolicyState",
    "RequestState",
    "RightsRailError",
    "RightsRailState",
    "Settlement",
    "StateTransitionError",
    "UsageRequest",
    "Withdrawal",
]
