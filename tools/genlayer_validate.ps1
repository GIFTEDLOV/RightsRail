$ErrorActionPreference = "Stop"
$env:GENVM_VERSION = "v0.6.0-rc5"
$env:PATH = (Resolve-Path (Join-Path $PSScriptRoot "..\.venv\Scripts")).Path + ";" + $env:PATH
$lint = Join-Path $PSScriptRoot "..\.venv\Scripts\genvm-lint.exe"
if (!(Test-Path $lint)) { $lint = "genvm-lint" }
& $lint validate contracts/rightsrail_v24.py --json
exit $LASTEXITCODE
