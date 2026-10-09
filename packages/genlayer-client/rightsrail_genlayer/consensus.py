"""Custom leader/validator consensus architecture for the seven-field semantic vector."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from rightsrail_domain import Evidence, Policy, UsageRequest
from rightsrail_policy_engine import parse_semantic_vector


class ConsensusReject(Exception):
    """Infrastructure/consensus rejection; never a business verdict."""


@dataclass(frozen=True)
class AdjudicationCalldata:
    request_id: str
    policy_id: str
    policy_version: int
    evidence_id: str
    generation: int


@dataclass(frozen=True)
class SemanticContext:
    policy: Policy
    request: UsageRequest
    evidence: Evidence
    reference_image_source: str
    proposed_image_source: str
    public_evidence_url: str | None


CALLDATA_KEYS = {
    "request_id",
    "policy_id",
    "policy_version",
    "evidence_id",
    "generation",
}


def parse_adjudication_calldata(raw: Any) -> AdjudicationCalldata:
    if not isinstance(raw, Mapping) or set(raw.keys()) != CALLDATA_KEYS or len(raw) != 5:
        raise ConsensusReject("leader calldata must contain exactly five binding fields")
    for key in ("request_id", "policy_id", "evidence_id"):
        if type(raw[key]) is not str or not raw[key].strip():
            raise ConsensusReject(f"{key} must be a non-empty string")
    for key in ("policy_version", "generation"):
        if type(raw[key]) is not int or raw[key] < 0:
            raise ConsensusReject(f"{key} must be a non-negative integer")
    if raw["policy_version"] == 0:
        raise ConsensusReject("policy_version must be positive")
    return AdjudicationCalldata(
        request_id=raw["request_id"],
        policy_id=raw["policy_id"],
        policy_version=raw["policy_version"],
        evidence_id=raw["evidence_id"],
        generation=raw["generation"],
    )


def _require_return(gl_module: Any) -> Any:
    vm = getattr(gl_module, "vm", None)
    return_fn = getattr(vm, "Return", None)
    if not callable(return_fn):
        raise ConsensusReject("gl.vm.Return is required")
    return vm


def _context_for(
    calldata: AdjudicationCalldata,
    context_loader: Callable[[AdjudicationCalldata], SemanticContext],
) -> SemanticContext:
    try:
        context = context_loader(calldata)
    except ConsensusReject:
        raise
    except Exception as exc:
        raise ConsensusReject("unable to load bound adjudication context") from exc
    try:
        if context.request.request_id != calldata.request_id:
            raise ConsensusReject("request calldata does not match loaded context")
        if context.policy.policy_id != calldata.policy_id:
            raise ConsensusReject("policy calldata does not match loaded context")
        if context.policy.version != calldata.policy_version:
            raise ConsensusReject("policy version calldata does not match loaded context")
        if context.evidence.evidence_id != calldata.evidence_id:
            raise ConsensusReject("evidence calldata does not match loaded context")
    except ConsensusReject:
        raise
    except Exception as exc:
        raise ConsensusReject("loaded context is malformed") from exc
    return context


def leader_fn(
    gl_module: Any,
    evaluator: Callable[[SemanticContext], Mapping[str, Any]],
    context_loader: Callable[[AdjudicationCalldata], SemanticContext],
) -> Any:
    """Leader path: strict calldata, bounded vision/evidence evaluation, strict return."""

    vm = _require_return(gl_module)
    calldata = parse_adjudication_calldata(vm.calldata)
    context = _context_for(calldata, context_loader)
    try:
        raw_result = evaluator(context)
        vector = parse_semantic_vector(raw_result)
    except Exception as exc:
        raise ConsensusReject("malformed leader semantic output; rotate/reject") from exc
    return vm.Return(vector.as_dict())


def validator_fn(
    gl_module: Any,
    leader_return: Any,
    evaluator: Callable[[SemanticContext], Mapping[str, Any]],
    context_loader: Callable[[AdjudicationCalldata], SemanticContext],
) -> Any:
    """Validator path: independently evaluate and compare only the seven booleans."""

    vm = _require_return(gl_module)
    calldata = parse_adjudication_calldata(vm.calldata)
    context = _context_for(calldata, context_loader)
    try:
        leader_vector = parse_semantic_vector(leader_return)
    except Exception as exc:
        raise ConsensusReject("malformed leader return; rotate/reject") from exc
    try:
        own_vector = parse_semantic_vector(evaluator(context))
    except Exception as exc:
        raise ConsensusReject("malformed validator semantic output; rotate/reject") from exc
    if leader_vector.as_tuple() != own_vector.as_tuple():
        raise ConsensusReject("independent semantic vectors disagree; rotate/reject")
    return vm.Return({"accepted": True})
