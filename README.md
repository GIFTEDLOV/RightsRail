# RightsRail

RightsRail is a GenLayer Intelligent Contract application for semantic usage-rights enforcement for AI and digital media.

It lets an issuer register and freeze a usage permission policy for a digital asset. A requester submits a proposed use and bound evidence. GenLayer validators independently evaluate only bounded semantic questions and return the exact seven-boolean `RIGHTSRAIL_USAGE_V1` vector. A deterministic policy engine then decides whether a permit can exist.

RightsRail does not determine legal copyright ownership or legal infringement. It enforces only the frozen permission policy registered by the issuer.

## Phase 1 status

This repository contains the local implementation foundation only:

- append-only domain state machine and deterministic policy engine;
- strict semantic-vector and consensus-calldata parsers;
- leader/validator architecture skeleton with independent validation;
- contract adapter skeleton at `contracts/rightsrail.py`;
- direct and adversarial standard-library tests;
- architecture, trust, threat, evidence, schema, state, and release documentation.

No deployment, GEN spending, GitHub repository, or polished frontend is part of this phase.

## Run locally

```powershell
python -m unittest discover -s tests -t . -p test_*.py
python -m compileall -q contracts packages tests
```

The optional commands `ruff check .` and `mypy` are configured in `pyproject.toml` for the next environment setup, but their CLIs are intentionally not vendored into this foundation.

## Core sequence

```text
deterministic facts -> bounded semantic vector -> deterministic policy -> settlement
```

The first canonical adjudication is authoritative. Malformed model output is a consensus rejection/rotation condition, never a business verdict.
