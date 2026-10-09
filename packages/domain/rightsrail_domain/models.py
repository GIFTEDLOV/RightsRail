"""Immutable canonical records for policy, request, evidence, adjudication, and permits."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class PolicyState(StrEnum):
    DRAFT = "DRAFT"
    FROZEN = "FROZEN"
    CLOSED = "CLOSED"


class RequestState(StrEnum):
    SUBMITTED = "SUBMITTED"
    EVIDENCE_COMMITTED = "EVIDENCE_COMMITTED"
    ADJUDICATED = "ADJUDICATED"
    SETTLED = "SETTLED"


class EvidenceStatus(StrEnum):
    COMMITTED = "COMMITTED"


class AdjudicationState(StrEnum):
    FINAL = "FINAL"


@dataclass(frozen=True)
class Policy:
    policy_id: str
    issuer: str
    version: int
    state: PolicyState
    asset_sha256: str
    asset_exact_bytes: int
    asset_media_type: str
    asset_source: str
    license_text_sha256: str
    license_text_exact_bytes: int
    license_text: str
    allowed_purposes: tuple[str, ...]
    prohibited_purposes: tuple[str, ...]
    allowed_channels: tuple[str, ...]
    prohibited_contexts: tuple[str, ...]
    transformation_rules: tuple[str, ...]
    attribution_requirement: str
    endorsement_rule: str
    valid_from: datetime
    valid_until: datetime | None
    required_fee_wei: int
    settlement_recipient: str
    created_at: datetime
    frozen_at: datetime | None
    closed_at: datetime | None


@dataclass(frozen=True)
class UsageRequest:
    request_id: str
    policy_id: str
    policy_version: int
    requester: str
    purpose_description: str
    channel: str
    context_description: str
    proposed_asset_sha256: str
    proposed_asset_exact_bytes: int
    proposed_media_type: str
    public_evidence_url: str | None
    attribution_text: str
    request_digest: str
    required_fee: int
    escrowed_value: int
    created_at: datetime
    state: RequestState
    generation: int


@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    request_id: str
    policy_id: str
    policy_version: int
    reference_asset_sha256: str
    proposed_asset_sha256: str
    content_sha256: str
    exact_byte_length: int
    media_type: str
    source_digest: str
    authority_digest: str
    schema_version: str
    authenticated_at: datetime
    status: EvidenceStatus
    reference_source: str
    proposed_source: str
    public_evidence_url: str | None


@dataclass(frozen=True)
class Adjudication:
    adjudication_id: str
    request_id: str
    policy_id: str
    policy_version: int
    evidence_id: str
    generation: int
    semantic_schema: str
    semantic_vector: tuple[bool, ...]
    result: str
    state: AdjudicationState
    created_at: datetime


@dataclass(frozen=True)
class Permit:
    permit_id: str
    policy_id: str
    policy_version: int
    issuer: str
    requester: str
    asset_sha256: str
    request_digest: str
    evidence_hash: str
    adjudication_id: str
    generation: int
    semantic_schema: str
    fee_paid: int
    issued_at: datetime
    expires_at: datetime | None
    permit_binding_hash: str
    status: str


@dataclass(frozen=True)
class Settlement:
    request_id: str
    result: str
    amount: int
    recipient: str | None
    settled_at: datetime
    status: str


@dataclass(frozen=True)
class JournalEntry:
    sequence: int
    action: str
    subject_id: str
    details_digest: str
    created_at: datetime
