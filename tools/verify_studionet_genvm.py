"""Validate the active stable candidate and compare its generated ABI exactly."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    manifest = json.loads((ROOT / "provenance/studionet-candidate-manifest.json").read_text())
    linter = shutil.which("genvm-lint") or str(ROOT / ".venv/Scripts/genvm-lint.exe")
    env = {**os.environ, "GENVM_REPO": "genlayerlabs/genvm", "GENVM_VERSION": "v0.2.16"}
    env["PATH"] = str(Path(linter).parent) + os.pathsep + env.get("PATH", "")
    cache = ROOT / ".genlayer-cache"
    cache.mkdir(exist_ok=True)
    generated = cache / "studionet-verified.abi.json"
    steps = [
        ["lint", manifest["source"], "--json"],
        ["validate", manifest["source"], "--json"],
        ["typecheck", manifest["source"], "--all", "--json"],
        ["schema", manifest["source"], "-o", str(generated), "--json"],
    ]
    for step in steps:
        subprocess.run([linter, *step], cwd=ROOT, env=env, check=True)
    if json.loads(generated.read_text()) != json.loads((ROOT / manifest["abi"]).read_text()):
        raise SystemExit("Generated stable schema differs from deployed candidate ABI")
    print("Stable GenVM gates and exact schema comparison: PASS")


if __name__ == "__main__":
    main()
