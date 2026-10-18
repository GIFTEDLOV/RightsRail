"""Cross-platform fail-closed GenVM CI checks using the pinned RC5 toolchain.

The original PowerShell wrappers assume .venv\\Scripts and cannot execute on
Linux GitHub Actions runners. This command does not sign or broadcast anything.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = "contracts/rightsrail_v24.py"
SCHEMA = "artifacts/rightsrail-v24.abi.json"


def genvm_lint_command() -> str:
    """Resolve the pinned virtualenv executable on Windows and CI runners."""

    from_path = shutil.which("genvm-lint")
    if from_path:
        return from_path
    candidates = (
        ROOT / ".venv" / "Scripts" / "genvm-lint.exe",
        ROOT / ".venv" / "bin" / "genvm-lint",
    )
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise SystemExit("GenVM linter executable not found in PATH or .venv")


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
    linter = genvm_lint_command()
    tool_bin = str(Path(linter).parent)
    env["PATH"] = os.pathsep.join([tool_bin, env.get("PATH", "")])
    steps = [
        ("lint", ["lint", CONTRACT, "--json"]),
        ("validate", ["validate", CONTRACT, "--json"]),
        ("typecheck", ["typecheck", CONTRACT, "--json", "--all"]),
    ]
    for name, args in steps:
        process = subprocess.run(
            [linter, *args],
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
    # Generate outside the worktree. The frozen V2.4 ABI predates the current
    # LF policy, so rewriting it would change its byte hash on Linux even when
    # the generated JSON schema is identical.
    with tempfile.TemporaryDirectory(prefix="rightsrail-genvm-") as temp_dir:
        generated = Path(temp_dir) / "rightsrail-v24.abi.json"
        process = subprocess.run(
            [linter, "schema", CONTRACT, "-o", str(generated), "--json"],
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
            raise SystemExit(f"GenVM schema failed (exit {process.returncode})")
        expected_schema = json.loads((ROOT / SCHEMA).read_text(encoding="utf-8"))
        generated_schema = json.loads(generated.read_text(encoding="utf-8"))
        if generated_schema != expected_schema:
            raise SystemExit("Generated V2.4 schema differs from the pinned ABI")
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
