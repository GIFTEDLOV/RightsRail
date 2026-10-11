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
| Studio-dev simulation | BLOCKED | validity guard error despite active canonical window |

The GLSim process itself started on localhost after project-local FastAPI and
Uvicorn dependencies were installed. The exact source deployment then failed
with:

```text
runner py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng
not under C:\\Users\\DELL\\.cache\\gltest-direct\\trees-v2\\v0.6.0-rc5
```

No external endpoint was contacted by this test, and no blockchain write was
performed.
