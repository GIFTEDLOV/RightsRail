$ErrorActionPreference = "Stop"
$env:GENVM_VERSION = "v0.6.0-rc5"
New-Item -ItemType Directory -Force artifacts | Out-Null
genvm-lint schema contracts/rightsrail.py -o artifacts/rightsrail.abi.json --json
