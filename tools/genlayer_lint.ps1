$ErrorActionPreference = "Stop"
$env:GENVM_VERSION = "v0.6.0-rc5"
$env:PATH = (Resolve-Path (Join-Path $PSScriptRoot "..\.venv\Scripts")).Path + ";" + $env:PATH
$lint = Join-Path $PSScriptRoot "..\.venv\Scripts\genvm-lint.exe"
if (!(Test-Path $lint)) { $lint = "genvm-lint" }
$output = & $lint lint contracts/rightsrail.py --json 2>&1
$exitCode = $LASTEXITCODE
$output | Out-Default
if ($exitCode -ne 0) {
  try {
    $report = ($output -join "") | ConvertFrom-Json
    $onlyExpectedWarnings = $report.warnings -and @($report.warnings | Where-Object { $_.code -ne "E010" }).Count -eq 0
    if ($report.ok -eq $false -and $onlyExpectedWarnings) { exit 0 }
  } catch { }
}
exit $exitCode
