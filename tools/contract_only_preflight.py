"""Fail-closed, no-wallet RightsRail Intelligent Contract preflight.

Offline checks work in a source-review container. ``--official`` additionally
requires a real pinned GenVM toolchain; it never signs or broadcasts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts/rightsrail.py"
EXPECTED_SHA = "E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE"
PROVISIONAL_SCHEMA = ROOT / "artifacts/rightsrail.abi.json"


def execute(
    command: list[str], *, env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, check=False)
    if p.stdout:
        print(p.stdout, end="")
    if p.stderr:
        print(p.stderr, file=sys.stderr, end="")
    return p


def check_source() -> None:
    data = SOURCE.read_bytes()
    if b"\r\n" in data or hashlib.sha256(data).hexdigest().upper() != EXPECTED_SHA:
        raise SystemExit("STOP: contract has changed or contains CRLF; reset and repeat full audit")
    print(f"SOURCE_SHA256={EXPECTED_SHA}")


def check_offline() -> None:
    p = execute(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "tests/adversarial",
            "tests/integration",
            "tests/mutation",
            "tests/test_ci_release_portability.py",
        ]
    )
    if p.returncode != 0:
        raise SystemExit("STOP: offline contract tests failed")
    print("OFFLINE_CONTRACT_TESTS=PASS")


def check_official() -> None:
    env = os.environ.copy()
    env["GENVM_VERSION"] = "v0.6.0-rc5"
    for name, args in (
        ("lint", ["lint", "contracts/rightsrail.py", "--json"]),
        ("validate", ["validate", "contracts/rightsrail.py", "--json"]),
        ("typecheck", ["typecheck", "contracts/rightsrail.py", "--json", "--all"]),
        (
            "schema",
            [
                "schema",
                "contracts/rightsrail.py",
                "-o",
                "artifacts/rightsrail.official.abi.json",
                "--json",
            ],
        ),
    ):
        try:
            result = execute(["genvm-lint", *args], env=env)
        except FileNotFoundError as e:
            raise SystemExit("STOP: pinned genvm-lint is not installed in this environment") from e
        if result.returncode != 0:
            try:
                payload = json.loads(result.stdout)
            except (ValueError, TypeError):
                payload = None
            if not (name == "lint" and isinstance(payload, dict)
                    and payload.get("warnings")
                    and all(
                        isinstance(w, dict) and w.get("code") == "E010"
                        for w in payload["warnings"]
                    )
                    and not payload.get("errors")):
                raise SystemExit(f"STOP: official GenVM {name} failed")
        print(f"GENVM_{name.upper()}=PASS")
    official = ROOT / "artifacts/rightsrail.official.abi.json"
    if not official.is_file():
        raise SystemExit("STOP: official GenVM schema was not generated")
    source_methods = set(json.loads(PROVISIONAL_SCHEMA.read_text())["methods"])
    generated = json.loads(official.read_text())
    if not isinstance(generated, dict) or not isinstance(generated.get("methods"), dict):
        raise SystemExit("STOP: unrecognized official GenVM ABI structure")
    if source_methods != set(generated["methods"]):
        raise SystemExit("STOP: official ABI method set differs from reviewed source")
    print("OFFICIAL_ABI_SHA256=" + hashlib.sha256(official.read_bytes()).hexdigest().upper())
    print("OFFICIAL_METHODS=" + str(len(generated["methods"])))
    print(
        "NOTE: official ABI must be deployed and committed; "
        "provisional ABI is not deployment authority"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--official", action="store_true", help="run actual pinned GenVM validation and schema"
    )
    args = parser.parse_args()
    check_source()
    check_offline()
    if args.official:
        check_official()
    else:
        print("OFFICIAL_GENVM=NOT_RUN (pass --official in pinned connected environment)")
    print("BLOCKCHAIN_WRITES=NONE")


if __name__ == "__main__":
    main()
