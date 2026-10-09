$ErrorActionPreference = "Stop"
$env:GENVM_VERSION = "v0.6.0-rc5"
$env:PATH = (Resolve-Path (Join-Path $PSScriptRoot "..\.venv\Scripts")).Path + ";" + $env:PATH
New-Item -ItemType Directory -Force artifacts | Out-Null
$lint = Join-Path $PSScriptRoot "..\.venv\Scripts\genvm-lint.exe"
if (!(Test-Path $lint)) { $lint = "genvm-lint" }
& $lint schema contracts/rightsrail.py -o artifacts/rightsrail.abi.json --json
exit $LASTEXITCODE
