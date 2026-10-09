$ErrorActionPreference = "Stop"
$env:GENVM_VERSION = "v0.6.0-rc5"
genvm-lint typecheck contracts/rightsrail.py --json --all
