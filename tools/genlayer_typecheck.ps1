$ErrorActionPreference = "Stop"
$env:GENVM_VERSION = "v0.2.16"
genvm-lint typecheck contracts/rightsrail.py --json --all
