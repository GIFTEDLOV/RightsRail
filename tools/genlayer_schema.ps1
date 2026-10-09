$ErrorActionPreference = "Stop"
$env:GENVM_VERSION = "v0.2.16"
New-Item -ItemType Directory -Force artifacts | Out-Null
genvm-lint schema contracts/rightsrail.py -o artifacts/rightsrail.abi.json --json
