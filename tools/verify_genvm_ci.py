"""Cross-platform fail-closed GenVM CI checks using the pinned RC5 toolchain.

The original PowerShell wrappers assume .venv\\Scripts and cannot execute on
Linux GitHub Actions runners. This command does not sign or broadcast anything.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = "contracts/rightsrail.py"
SCHEMA = "artifacts/rightsrail.abi.json"


def is_only_expected_reachability_warnings(result: object) -> bool:
    """Never excuse other errors, unknown output, or an empty warning list."""
    if not isinstance(result, dict):
        return False
    warnings = result.get("warnings")
    if not isinstance(warnings, list) or not warnings:
        return False
    errors = result.get("errors", [])
    if errors:
        return False
    return all(isinstance(item, dict) and item.get("code") == "E010" for item in warnings)


def run_checks() -> None:
    env = os.environ.copy()
    env["GENVM_VERSION"] = "v0.6.0-rc5"
    steps = [
        ("lint", ["lint", CONTRACT, "--json"]),
        ("validate", ["validate", CONTRACT, "--json"]),
        ("typecheck", ["typecheck", CONTRACT, "--json", "--all"]),
        ("schema", ["schema", CONTRACT, "-o", SCHEMA, "--json"]),
    ]
    for name, args in steps:
        process = subprocess.run(
            ["genvm-lint", *args],
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
        if process.stdout:
            print(process.stdout, end="")
        if process.stderr:
            print(process.stderr, end="", file=sys.stderr)
        if process.returncode != 0:
            try:
                output = json.loads(process.stdout)
            except (json.JSONDecodeError, TypeError):
                output = None
            if name != "lint" or not is_only_expected_reachability_warnings(output):
                raise SystemExit(f"GenVM {name} failed (exit {process.returncode})")
            print("GenVM lint: only known E010 warnings observed")
    verification = subprocess.run(
        [sys.executable, str(ROOT / "tools/verify_release_invariants.py")],
        cwd=ROOT, text=True, check=False,
    )
    if verification.returncode != 0:
        raise SystemExit(
            "Generated schema or contract source differs from frozen release invariants"
        )


if __name__ == "__main__":
    run_checks()
