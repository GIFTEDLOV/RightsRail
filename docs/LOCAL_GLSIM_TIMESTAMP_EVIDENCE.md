# Local timestamp evidence

This report is intentionally separate from the hosted Studio-dev gate.

## Exact V2.3 source

`contracts/rightsrail.py` was verified before the probe as:

```text
E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE
```

The test is `tests/integration/test_glsim_v23_timestamp_context.py`.

## Results

| Layer | Result | Evidence |
| --- | --- | --- |
| Direct RC5 timestamp context | PASS | `tests/direct/test_timestamp_context.py`: 2 passed |
| Exact V2.3 GLSim deployment | BLOCKED before `__init__` | pinned `py-genlayer:5jyc…` runner absent from local RC5 tree |
| GLSim `genvm_datetime` boundary calls | NOT EXECUTED | cannot deploy exact source without the pinned runner |
| Studio-dev simulation without datetime context | HISTORICAL FAILURE | validity guard error despite active canonical window |
| Studio-dev no-write simulation with explicit datetime | PASS | `sim_call`, `value=10`, and `sim_config.genvm_datetime` returned `SUCCESS` |
| Studio-dev no-write fee estimate with explicit datetime | PASS | `sim_estimateTransactionFees` returned a usable fee profile |

The GLSim process itself started on localhost after project-local FastAPI and
Uvicorn dependencies were installed. The exact source deployment then failed
with:

```text
runner py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
not under C:\\Users\\DELL\\.cache\\gltest-direct\\trees-v2\\v0.6.0-rc5
```

No blockchain write was performed by the local GLSim test. The hosted
no-write probe and canonical before/after state comparison are recorded in
`docs/provenance/simulations/gltest-studio-timestamp-probe.json`. It does not
prove hosted validator consensus or a business result.
