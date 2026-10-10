"""Fail-closed local release invariant checks; never performs network writes."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FROZEN_CONTRACT = "C312E73FA9A01DB54A81FB19CBE82DBD0B73C6F9308D71A181E3E07BD13D548B"
FROZEN_ABI = "E1314699D11B66D903E049F3D4DF558486E93225DFFD861A7A2E7210697969DB"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def constant(source: str, name: str) -> str:
    match = re.search(rf"{name}\s*=\s*\n?\s*\"([0-9A-F]+)\"", source)
    if not match:
        raise SystemExit(f"missing {name}")
    return match.group(1)


def main() -> None:
    contract = ROOT / "contracts" / "rightsrail.py"
    abi = ROOT / "artifacts" / "rightsrail.abi.json"
    client = (ROOT / "packages" / "genlayer-client" / "src" / "index.ts").read_text(
        encoding="utf-8"
    )
    if constant(client, "CONTRACT_SHA256") != FROZEN_CONTRACT:
        raise SystemExit("frozen contract hash constant changed")
    if constant(client, "ABI_SHA256") != FROZEN_ABI:
        raise SystemExit("frozen ABI hash constant changed")
    candidate_contract = sha256(contract)
    candidate_abi = sha256(abi)
    if constant(client, "CANDIDATE_CONTRACT_SHA256") != candidate_contract:
        raise SystemExit("candidate contract hash is stale")
    if constant(client, "CANDIDATE_ABI_SHA256") != candidate_abi:
        raise SystemExit("candidate ABI hash is stale")
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
