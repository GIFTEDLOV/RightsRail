# RightsRail API

Phase 2 keeps the API boundary intentionally thin and typed. A future API will expose canonical contract reads, evidence-authentication orchestration, crash-safe transaction-journal status, and request/adjudication workflow state.

The contract/domain state remains the source of truth. API projections must be rebuildable, must separate finality from execution success, and must never fabricate or rewrite historical results.
