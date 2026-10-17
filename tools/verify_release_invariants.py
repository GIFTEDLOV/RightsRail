"""Fail-closed local release invariant checks; never performs network writes."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FROZEN_CONTRACT = "5C99DEB31EB29B171B94F343950CBFF5204945D02160B2ADA3D742A1FFC6D321"
FROZEN_ABI = "11548EA63B1C365C7985BE8C748109C4B7F4A33A1A55DE8394EF1CE90E6BE4EA"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def constant(source: str, name: str) -> str:
    match = re.search(
        rf"(?:^|\n)export const {name}\s*=\s*\n?\s*\"([0-9A-F]+)\"",
        source,
    )
    if not match:
        raise SystemExit(f"missing {name}")
    return match.group(1)


def main() -> None:
    contract = ROOT / "contracts" / "rightsrail_v24.py"
    abi = ROOT / "artifacts" / "rightsrail-v24.abi.json"
    client = (ROOT / "packages" / "genlayer-client" / "src" / "index.ts").read_text(
        encoding="utf-8"
    )
    active = json.loads((ROOT / "provenance/studionet-candidate-manifest.json").read_text())
    if constant(client, "CONTRACT_SHA256") != active["source_sha256"]:
        raise SystemExit("Active client source hash differs from the Studionet manifest")
    if constant(client, "ABI_SHA256") != active["abi_sha256"]:
        raise SystemExit("Active client ABI hash differs from the Studionet manifest")
    if sha256(ROOT / active["source"]) != active["source_sha256"]:
        raise SystemExit("Stable source differs from its recorded candidate")
    if sha256(ROOT / active["abi"]) != active["abi_sha256"]:
        raise SystemExit("Stable ABI differs from its recorded candidate")
    candidate_contract = sha256(contract)
    candidate_abi = sha256(abi)
    if candidate_contract != FROZEN_CONTRACT:
        raise SystemExit("V2.4 contract hash differs from the pinned candidate")
    if candidate_abi != FROZEN_ABI:
        raise SystemExit("V2.4 ABI hash differs from the pinned candidate")
    print(
        {
            "frozen_contract": FROZEN_CONTRACT,
            "frozen_abi": FROZEN_ABI,
            "candidate_contract": candidate_contract,
            "candidate_abi": candidate_abi,
        }
    )


if __name__ == "__main__":
    main()
