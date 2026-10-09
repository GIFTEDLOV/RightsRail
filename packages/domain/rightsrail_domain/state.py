"""Append-only RightsRail state machine with deterministic precondition checks."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

from rightsrail_evidence import validate_sha256
from rightsrail_policy_engine import (
    SEMANTIC_SCHEMA,
    evaluate_policy,
    parse_semantic_vector,
)
from rightsrail_shared import canonical_digest

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
)


class RightsRailError(Exception):
    """Base class for domain failures."""


class AuthorizationError(RightsRailError):
    pass


class StateTransitionError(RightsRailError):
    pass


class InvariantViolation(RightsRailError):
    pass


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _non_empty(value: str, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be non-empty")
    return value


def _non_negative_int(value: int, name: str) -> int:
    if type(value) is not int or value < 0:
        raise ValueError(f"{name} must be a non-negative integer")
    return value


class RightsRailState:
    """Canonical state; every mutation appends a journal record and preserves history."""

    _EDITABLE_POLICY_FIELDS = {
        "asset_sha256",
        "asset_exact_bytes",
        "asset_media_type",
        "asset_source",
        "license_text_sha256",
        "license_text_exact_bytes",
        "license_text",
        "allowed_purposes",
        "prohibited_purposes",
        "allowed_channels",
        "prohibited_contexts",
        "transformation_rules",
        "attribution_requirement",
        "endorsement_rule",
        "valid_from",
        "valid_until",
        "required_fee_wei",
        "settlement_recipient",
    }

    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self._clock = clock or _utc_now
        self.policies: dict[str, Policy] = {}
        self.requests: dict[str, UsageRequest] = {}
        self.request_digests: dict[str, str] = {}
        self.evidence: dict[str, Evidence] = {}
        self.evidence_by_request: dict[str, str] = {}
        self.adjudications: dict[str, Adjudication] = {}
        self.adjudication_by_request: dict[str, str] = {}
        self.permits: dict[str, Permit] = {}
        self.settlements: dict[str, Settlement] = {}
        self.journal: list[JournalEntry] = []

    def _record(self, action: str, subject_id: str, details: Mapping[str, Any]) -> None:
        self.journal.append(
            JournalEntry(
                sequence=len(self.journal) + 1,
                action=action,
                subject_id=subject_id,
                details_digest=canonical_digest(details),
                created_at=self._clock(),
            )
        )

    def register_policy(
        self,
        *,
        policy_id: str,
        issuer: str,
        asset_sha256: str,
        asset_exact_bytes: int,
        asset_media_type: str,
        asset_source: str,
        license_text_sha256: str,
        license_text_exact_bytes: int,
        license_text: str,
        allowed_purposes: tuple[str, ...],
        prohibited_purposes: tuple[str, ...],
        allowed_channels: tuple[str, ...],
        prohibited_contexts: tuple[str, ...],
        transformation_rules: tuple[str, ...],
        attribution_requirement: str,
        endorsement_rule: str,
        valid_from: datetime,
        valid_until: datetime | None,
        required_fee_wei: int,
        settlement_recipient: str,
    ) -> Policy:
        _non_empty(policy_id, "policy_id")
        _non_empty(issuer, "issuer")
        if policy_id in self.policies:
            raise StateTransitionError("policy_id already exists")
        validate_sha256(asset_sha256, "asset_sha256")
        validate_sha256(license_text_sha256, "license_text_sha256")
        _non_negative_int(asset_exact_bytes, "asset_exact_bytes")
        _non_negative_int(license_text_exact_bytes, "license_text_exact_bytes")
        _non_negative_int(required_fee_wei, "required_fee_wei")
        _non_empty(asset_media_type, "asset_media_type")
        _non_empty(asset_source, "asset_source")
        _non_empty(license_text, "license_text")
        _non_empty(settlement_recipient, "settlement_recipient")
        if valid_until is not None and valid_until < valid_from:
            raise ValueError("valid_until cannot precede valid_from")

        policy = Policy(
            policy_id=policy_id,
            issuer=issuer,
            version=1,
            state=PolicyState.DRAFT,
            asset_sha256=asset_sha256,
            asset_exact_bytes=asset_exact_bytes,
            asset_media_type=asset_media_type,
            asset_source=asset_source,
            license_text_sha256=license_text_sha256,
            license_text_exact_bytes=license_text_exact_bytes,
            license_text=license_text,
            allowed_purposes=tuple(allowed_purposes),
            prohibited_purposes=tuple(prohibited_purposes),
            allowed_channels=tuple(allowed_channels),
            prohibited_contexts=tuple(prohibited_contexts),
            transformation_rules=tuple(transformation_rules),
            attribution_requirement=_non_empty(attribution_requirement, "attribution_requirement"),
            endorsement_rule=_non_empty(endorsement_rule, "endorsement_rule"),
            valid_from=valid_from,
            valid_until=valid_until,
            required_fee_wei=required_fee_wei,
            settlement_recipient=settlement_recipient,
            created_at=self._clock(),
            frozen_at=None,
            closed_at=None,
        )
        self.policies[policy_id] = policy
        self._record("REGISTER_POLICY", policy_id, {"issuer": issuer, "version": 1})
        return policy

    def edit_policy(self, *, caller: str, policy_id: str, **changes: Any) -> Policy:
        policy = self._policy(policy_id)
        if caller != policy.issuer:
            raise AuthorizationError("only the issuing identity may edit its policy")
        if policy.state is not PolicyState.DRAFT:
            raise StateTransitionError("only DRAFT policies are editable")
        unknown = set(changes) - self._EDITABLE_POLICY_FIELDS
        if unknown:
            raise StateTransitionError(f"non-editable policy fields: {sorted(unknown)}")
        merged = replace(policy, **changes)
        validate_sha256(merged.asset_sha256, "asset_sha256")
        validate_sha256(merged.license_text_sha256, "license_text_sha256")
        _non_negative_int(merged.required_fee_wei, "required_fee_wei")
        if merged.valid_until is not None and merged.valid_until < merged.valid_from:
            raise ValueError("valid_until cannot precede valid_from")
        self.policies[policy_id] = merged
        self._record(
            "EDIT_POLICY", policy_id, {"version": merged.version, "fields": sorted(changes)}
        )
        return merged

    def freeze_policy(self, *, caller: str, policy_id: str) -> Policy:
        policy = self._policy(policy_id)
        if caller != policy.issuer:
            raise AuthorizationError("only the issuing identity may freeze its policy")
        if policy.state is not PolicyState.DRAFT:
            raise StateTransitionError("only DRAFT policies can be frozen")
        frozen = replace(policy, state=PolicyState.FROZEN, frozen_at=self._clock())
        self.policies[policy_id] = frozen
        self._record("FREEZE_POLICY", policy_id, {"version": frozen.version})
        return frozen

    def close_policy(self, *, caller: str, policy_id: str) -> Policy:
        policy = self._policy(policy_id)
        if caller != policy.issuer:
            raise AuthorizationError("only the issuing identity may close its policy")
        if policy.state is not PolicyState.FROZEN:
            raise StateTransitionError("only FROZEN policies can be closed")
        closed = replace(policy, state=PolicyState.CLOSED, closed_at=self._clock())
        self.policies[policy_id] = closed
        self._record("CLOSE_POLICY", policy_id, {"version": closed.version})
        return closed

    def submit_request(
        self,
        *,
        request_id: str,
        policy_id: str,
        policy_version: int,
        requester: str,
        purpose_description: str,
        channel: str,
        context_description: str,
        proposed_asset_sha256: str,
        proposed_asset_exact_bytes: int,
        proposed_media_type: str,
        public_evidence_url: str | None,
        attribution_text: str,
        escrowed_value: int,
    ) -> UsageRequest:
        policy = self._policy(policy_id)
        if policy.state is not PolicyState.FROZEN:
            raise StateTransitionError("requests require a FROZEN policy")
        if policy_version != policy.version:
            raise InvariantViolation("request policy version is not current")
        if request_id in self.requests:
            raise StateTransitionError("request_id already exists")
        validate_sha256(proposed_asset_sha256, "proposed_asset_sha256")
        _non_negative_int(proposed_asset_exact_bytes, "proposed_asset_exact_bytes")
        if type(escrowed_value) is not int or escrowed_value != policy.required_fee_wei:
            raise InvariantViolation("escrowed_value must equal the frozen required fee")
        for name, value in (
            ("requester", requester),
            ("purpose_description", purpose_description),
            ("channel", channel),
            ("context_description", context_description),
            ("proposed_media_type", proposed_media_type),
        ):
            _non_empty(value, name)

        created_at = self._clock()
        digest_input = {
            "policy_id": policy_id,
            "policy_version": policy_version,
            "requester": requester,
            "purpose_description": purpose_description,
            "channel": channel,
            "context_description": context_description,
            "proposed_asset_sha256": proposed_asset_sha256,
            "proposed_asset_exact_bytes": proposed_asset_exact_bytes,
            "proposed_media_type": proposed_media_type,
            "public_evidence_url": public_evidence_url,
            "attribution_text": attribution_text,
            "required_fee": policy.required_fee_wei,
            "escrowed_value": escrowed_value,
        }
        request_digest = canonical_digest(digest_input)
        if request_digest in self.request_digests:
            raise StateTransitionError("duplicate request digest")
        request = UsageRequest(
            request_id=request_id,
            policy_id=policy_id,
            policy_version=policy_version,
            requester=_non_empty(requester, "requester"),
            purpose_description=_non_empty(purpose_description, "purpose_description"),
            channel=_non_empty(channel, "channel"),
            context_description=_non_empty(context_description, "context_description"),
            proposed_asset_sha256=proposed_asset_sha256,
            proposed_asset_exact_bytes=proposed_asset_exact_bytes,
            proposed_media_type=_non_empty(proposed_media_type, "proposed_media_type"),
            public_evidence_url=public_evidence_url,
            attribution_text=attribution_text,
            request_digest=request_digest,
            required_fee=policy.required_fee_wei,
            escrowed_value=escrowed_value,
            created_at=created_at,
            state=RequestState.SUBMITTED,
            generation=0,
        )
        self.requests[request_id] = request
        self.request_digests[request_digest] = request_id
        self._record(
            "SUBMIT_REQUEST", request_id, {"policy_id": policy_id, "policy_version": policy_version}
        )
        return request

    def commit_evidence(
        self,
        *,
        evidence_id: str,
        request_id: str,
        reference_asset_sha256: str,
        proposed_asset_sha256: str,
        content_sha256: str,
        exact_byte_length: int,
        media_type: str,
        source_digest: str,
        authority_digest: str,
        schema_version: str,
        reference_source: str,
        proposed_source: str,
        public_evidence_url: str | None,
    ) -> Evidence:
        request = self._request(request_id)
        policy = self._policy(request.policy_id)
        if request.state is not RequestState.SUBMITTED:
            raise StateTransitionError("evidence is immutable and can be committed once")
        if evidence_id in self.evidence or request_id in self.evidence_by_request:
            raise StateTransitionError("evidence overwrite is forbidden")
        if reference_asset_sha256 != policy.asset_sha256:
            raise InvariantViolation("evidence reference asset does not match policy asset")
        if proposed_asset_sha256 != request.proposed_asset_sha256:
            raise InvariantViolation("evidence proposed asset does not match request")
        if policy.policy_id != request.policy_id or policy.version != request.policy_version:
            raise InvariantViolation("request policy binding is inconsistent")
        validate_sha256(reference_asset_sha256, "reference_asset_sha256")
        validate_sha256(proposed_asset_sha256, "proposed_asset_sha256")
        validate_sha256(content_sha256, "content_sha256")
        _non_negative_int(exact_byte_length, "exact_byte_length")
        _non_empty(media_type, "media_type")
        for name, value in (
            ("source_digest", source_digest),
            ("authority_digest", authority_digest),
            ("schema_version", schema_version),
            ("reference_source", reference_source),
            ("proposed_source", proposed_source),
        ):
            _non_empty(value, name)
        evidence = Evidence(
            evidence_id=evidence_id,
            request_id=request_id,
            policy_id=policy.policy_id,
            policy_version=policy.version,
            reference_asset_sha256=reference_asset_sha256,
            proposed_asset_sha256=proposed_asset_sha256,
            content_sha256=content_sha256,
            exact_byte_length=exact_byte_length,
            media_type=media_type,
            source_digest=source_digest,
            authority_digest=authority_digest,
            schema_version=schema_version,
            authenticated_at=self._clock(),
            status=EvidenceStatus.COMMITTED,
            reference_source=reference_source,
            proposed_source=proposed_source,
            public_evidence_url=public_evidence_url,
        )
        self.evidence[evidence_id] = evidence
        self.evidence_by_request[request_id] = evidence_id
        self.requests[request_id] = replace(request, state=RequestState.EVIDENCE_COMMITTED)
        self._record(
            "COMMIT_EVIDENCE", evidence_id, {"request_id": request_id, "schema": schema_version}
        )
        return evidence

    def record_adjudication(
        self,
        *,
        request_id: str,
        evidence_id: str,
        semantic_output: Mapping[str, Any],
        generation: int,
    ) -> Adjudication:
        request = self._request(request_id)
        policy = self._policy(request.policy_id)
        evidence = self._evidence_for(request_id, evidence_id)
        if request.state is not RequestState.EVIDENCE_COMMITTED:
            raise StateTransitionError("request is not ready for adjudication")
        if request_id in self.adjudication_by_request:
            raise StateTransitionError("the first canonical adjudication is authoritative")
        if type(generation) is not int or generation < 0:
            raise ValueError("generation must be a non-negative integer")
        if generation != request.generation + 1:
            raise InvariantViolation("adjudication generation must increment exactly once")
        vector = parse_semantic_vector(semantic_output)
        result = evaluate_policy(vector)
        adjudication_id = "adj-" + canonical_digest(
            {"request_id": request_id, "evidence_id": evidence_id, "generation": generation}
        )[:24]
        adjudication = Adjudication(
            adjudication_id=adjudication_id,
            request_id=request_id,
            policy_id=policy.policy_id,
            policy_version=policy.version,
            evidence_id=evidence.evidence_id,
            generation=generation,
            semantic_schema=SEMANTIC_SCHEMA,
            semantic_vector=vector.as_tuple(),
            result=result.value,
            state=AdjudicationState.FINAL,
            created_at=self._clock(),
        )
        self.adjudications[adjudication_id] = adjudication
        self.adjudication_by_request[request_id] = adjudication_id
        self.requests[request_id] = replace(
            request, state=RequestState.ADJUDICATED, generation=generation
        )
        self._record(
            "FINALIZE_ADJUDICATION",
            adjudication_id,
            {"request_id": request_id, "result": result.value},
        )
        return adjudication

    def settle(self, *, request_id: str) -> Settlement:
        request = self._request(request_id)
        if request.state is not RequestState.ADJUDICATED:
            raise StateTransitionError("settlement requires a final adjudication")
        if request_id in self.settlements:
            raise StateTransitionError("settlement is append-only and can occur once")
        adjudication = self.adjudications[self.adjudication_by_request[request_id]]
        policy = self._policy(request.policy_id)
        now = self._clock()
        if adjudication.result == "PERMITTED":
            settlement = Settlement(
                request_id=request_id,
                result=adjudication.result,
                amount=policy.required_fee_wei,
                recipient=policy.settlement_recipient,
                settled_at=now,
                status="TRANSFER_REQUIRED",
            )
            permit = self._issue_permit(request, policy, adjudication, now)
            self.permits[permit.permit_id] = permit
        else:
            settlement = Settlement(
                request_id=request_id,
                result=adjudication.result,
                amount=request.escrowed_value,
                recipient=request.requester,
                settled_at=now,
                status="REFUND_REQUIRED",
            )
        self.settlements[request_id] = settlement
        self.requests[request_id] = replace(request, state=RequestState.SETTLED)
        self._record(
            "SETTLE_REQUEST",
            request_id,
            {"result": adjudication.result, "amount": settlement.amount},
        )
        return settlement

    def _issue_permit(
        self,
        request: UsageRequest,
        policy: Policy,
        adjudication: Adjudication,
        issued_at: datetime,
    ) -> Permit:
        evidence = self.evidence[adjudication.evidence_id]
        evidence_hash = canonical_digest(
            {
                "evidence_id": evidence.evidence_id,
                "request_id": evidence.request_id,
                "policy_id": evidence.policy_id,
                "policy_version": evidence.policy_version,
                "reference_asset_sha256": evidence.reference_asset_sha256,
                "proposed_asset_sha256": evidence.proposed_asset_sha256,
                "content_sha256": evidence.content_sha256,
                "exact_byte_length": evidence.exact_byte_length,
                "media_type": evidence.media_type,
                "source_digest": evidence.source_digest,
                "authority_digest": evidence.authority_digest,
                "schema_version": evidence.schema_version,
                "authenticated_at": evidence.authenticated_at.isoformat(),
                "status": evidence.status.value,
                "reference_source": evidence.reference_source,
                "proposed_source": evidence.proposed_source,
                "public_evidence_url": evidence.public_evidence_url,
            }
        )
        binding = {
            "policy_id": policy.policy_id,
            "policy_version": policy.version,
            "request_id": request.request_id,
            "request_digest": request.request_digest,
            "evidence_hash": evidence_hash,
            "adjudication_id": adjudication.adjudication_id,
            "generation": adjudication.generation,
            "semantic_schema": adjudication.semantic_schema,
        }
        permit_binding_hash = canonical_digest(binding)
        permit_id = "permit-" + permit_binding_hash[:24]
        return Permit(
            permit_id=permit_id,
            policy_id=policy.policy_id,
            policy_version=policy.version,
            issuer=policy.issuer,
            requester=request.requester,
            asset_sha256=policy.asset_sha256,
            request_digest=request.request_digest,
            evidence_hash=evidence_hash,
            adjudication_id=adjudication.adjudication_id,
            generation=adjudication.generation,
            semantic_schema=adjudication.semantic_schema,
            fee_paid=policy.required_fee_wei,
            issued_at=issued_at,
            expires_at=policy.valid_until,
            permit_binding_hash=permit_binding_hash,
            status="ISSUED",
        )

    def _policy(self, policy_id: str) -> Policy:
        try:
            return self.policies[policy_id]
        except KeyError as exc:
            raise RightsRailError(f"unknown policy: {policy_id}") from exc

    def _request(self, request_id: str) -> UsageRequest:
        try:
            return self.requests[request_id]
        except KeyError as exc:
            raise RightsRailError(f"unknown request: {request_id}") from exc

    def _evidence_for(self, request_id: str, evidence_id: str) -> Evidence:
        try:
            evidence = self.evidence[evidence_id]
        except KeyError as exc:
            raise RightsRailError(f"unknown evidence: {evidence_id}") from exc
        if evidence.request_id != request_id:
            raise InvariantViolation("evidence is bound to a different request")
        return evidence
