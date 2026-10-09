"""RightsRail Intelligent Contract skeleton.

The domain state machine is intentionally framework-neutral so it can be tested
without a GenLayer node. The `leader_fn` and `validator_fn` methods are the
adapter seam where the deployed GenLayer runtime supplies `gl.vm.calldata` and
`gl.vm.Return`. They never accept caller-supplied semantic booleans.
"""

from __future__ import annotations

from typing import Any, Callable, Mapping

from rightsrail_domain import RightsRailState
from rightsrail_genlayer import SemanticContext, leader_fn, validator_fn
from rightsrail_genlayer.consensus import AdjudicationCalldata, parse_adjudication_calldata


class RightsRailContract:
    """Public contract surface backed by append-only canonical state."""

    def __init__(self, state: RightsRailState | None = None) -> None:
        self.state = state or RightsRailState()

    # Public deterministic methods are explicit and caller-authorized by identity.
    def register_policy(self, **kwargs: Any) -> Any:
        return self.state.register_policy(**kwargs)

    def edit_policy(self, *, caller: str, policy_id: str, **changes: Any) -> Any:
        return self.state.edit_policy(caller=caller, policy_id=policy_id, **changes)

    def freeze_policy(self, *, caller: str, policy_id: str) -> Any:
        return self.state.freeze_policy(caller=caller, policy_id=policy_id)

    def close_policy(self, *, caller: str, policy_id: str) -> Any:
        return self.state.close_policy(caller=caller, policy_id=policy_id)

    def submit_request(self, **kwargs: Any) -> Any:
        return self.state.submit_request(**kwargs)

    def commit_evidence(self, **kwargs: Any) -> Any:
        return self.state.commit_evidence(**kwargs)

    def adjudicate(
        self,
        gl_module: Any,
        evaluator: Callable[[SemanticContext], Mapping[str, Any]],
    ) -> Any:
        """Run consensus first; mutate canonical state only after validator acceptance."""

        leader_return = self.leader_fn(gl_module, evaluator)
        self.validator_fn(gl_module, leader_return, evaluator)
        calldata = parse_adjudication_calldata(
            getattr(getattr(gl_module, "vm", None), "calldata", None)
        )
        return self.state.record_adjudication(
            request_id=calldata.request_id,
            evidence_id=calldata.evidence_id,
            semantic_output=leader_return,
            generation=calldata.generation,
        )

    def settle(self, *, request_id: str) -> Any:
        return self.state.settle(request_id=request_id)

    def _context_loader(self, call: AdjudicationCalldata) -> SemanticContext:
        request = self.state.requests.get(call.request_id)
        if request is None:
            raise ValueError("unknown request")
        policy = self.state.policies.get(call.policy_id)
        if policy is None:
            raise ValueError("unknown policy")
        evidence = self.state.evidence.get(call.evidence_id)
        if evidence is None:
            raise ValueError("unknown evidence")
        return SemanticContext(
            policy=policy,
            request=request,
            evidence=evidence,
            reference_image_source=evidence.reference_source,
            proposed_image_source=evidence.proposed_source,
            public_evidence_url=evidence.public_evidence_url,
        )

    def leader_fn(
        self,
        gl_module: Any,
        evaluator: Callable[[SemanticContext], Mapping[str, Any]],
    ) -> Any:
        return leader_fn(gl_module, evaluator, self._context_loader)

    def validator_fn(
        self,
        gl_module: Any,
        leader_return: Any,
        evaluator: Callable[[SemanticContext], Mapping[str, Any]],
    ) -> Any:
        return validator_fn(gl_module, leader_return, evaluator, self._context_loader)
