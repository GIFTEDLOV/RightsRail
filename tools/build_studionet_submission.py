"""Build and verify the allowlisted RightsRail 2.4.1 submission archive."""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "RightsRail_V2.4.1_STUDIONET_SUBMISSION.zip"
MANIFEST = ROOT / "provenance" / "rightsrail-v241-studionet-archive-manifest.json"
MEMBERS = (
    "contracts/rightsrail_studionet.py",
    "artifacts/rightsrail-studionet.abi.json",
    "provenance/studionet-candidate-manifest.json",
    "docs/provenance/rightsrail-studionet-preflight.json",
    "docs/provenance/live-transactions/rightsrail-studionet-deployment.json",
    "docs/provenance/live-transactions/rightsrail-studionet-qualification.json",
    "docs/SUBMISSION_DETAILS_V241.md",
    "FINAL_SUBMISSION_REPORT_V241.md",
    "SUBMISSION_STATUS_V241.json",
)
SOURCE_SHA = "DA0828DD579AB0CAA6432AF713559D4E3B5E679444F71E7345C4FF8E0F21EC47"
ABI_SHA = "AB93A76683921294FAC694751CF877E0F195A69DC7659FB5F02D6D34BC099B61"
SECRET_PATTERNS = (
    rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-[A-Za-z0-9]{32,})",
    rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    rb"(?i)(?:private_?key|mnemonic|password|api_?key)\s*[:=]\s*[\"'](?:0x[0-9a-f]{64}|[a-z0-9_\-]{32,})[\"']",
)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def main() -> None:
    candidate = json.loads((ROOT / MEMBERS[2]).read_text(encoding="utf-8"))
    status = json.loads((ROOT / MEMBERS[-1]).read_text(encoding="utf-8"))
    qualification = json.loads((ROOT / MEMBERS[5]).read_text(encoding="utf-8"))
    if candidate["source_sha256"] != SOURCE_SHA or candidate["abi_sha256"] != ABI_SHA:
        raise SystemExit("Candidate manifest hashes do not match the active release")
    if status.get("status") != "GO_SUBMISSION_READY":
        raise SystemExit("Submission status is not GO_SUBMISSION_READY")
    if qualification.get("phase") != "QUALIFICATION_AND_DELIVERY_VERIFIED":
        raise SystemExit("Live qualification and delivery are not verified")

    records: list[dict[str, str | int]] = []
    payloads: dict[str, bytes] = {}
    for member in MEMBERS:
        path = ROOT / member
        if not path.is_file():
            raise SystemExit(f"Missing archive member: {member}")
        data = path.read_bytes()
        if any(re.search(pattern, data) for pattern in SECRET_PATTERNS):
            raise SystemExit(f"Credential pattern found in archive member: {member}")
        payloads[member] = data
        records.append({"path": member, "bytes": len(data), "sha256": digest(data)})

    if records[0]["sha256"] != SOURCE_SHA or records[1]["sha256"] != ABI_SHA:
        raise SystemExit("Candidate bytes changed before archive creation")
    if payloads[MEMBERS[1]] != (ROOT / "apps/web/public/release/rightsrail.abi.json").read_bytes():
        raise SystemExit("Published ABI does not match generated ABI")

    with zipfile.ZipFile(
        ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as archive:
        for member in MEMBERS:
            info = zipfile.ZipInfo(member, date_time=(2026, 10, 17, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, payloads[member])

    with zipfile.ZipFile(ARCHIVE, "r") as archive:
        if tuple(archive.namelist()) != MEMBERS:
            raise SystemExit("Archive member set or order changed")
        for record in records:
            if digest(archive.read(str(record["path"]))) != record["sha256"]:
                raise SystemExit(f"Archive member verification failed: {record['path']}")

    archive_bytes = ARCHIVE.read_bytes()
    manifest = {
        "schema": "RIGHTSRAIL_V241_STUDIONET_ARCHIVE_MANIFEST_V1",
        "archive": ARCHIVE.name,
        "archive_sha256": digest(archive_bytes),
        "archive_bytes": len(archive_bytes),
        "status": "GO_SUBMISSION_READY",
        "network": {
            "alias": "studionet",
            "rpc": "https://studio.genlayer.com/api",
            "chain_id": 61999,
        },
        "contract_address": "0xdDB18c41B3033Ec2daD038F9547baAB913BEA2Aa",
        "candidate_source_sha256": SOURCE_SHA,
        "candidate_abi_sha256": ABI_SHA,
        "member_count": len(records),
        "members": records,
        "checks": {
            "archive_member_set_exact": True,
            "all_member_bytes_match_workspace": True,
            "all_member_hashes_verified": True,
            "generated_and_published_abi_match": True,
            "secret_assignment_pattern_found": False,
            "environment_files_included": False,
            "unrelated_project_files_included": False,
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(
        json.dumps(
            {
                "archive": ARCHIVE.name,
                "sha256": manifest["archive_sha256"],
                "members": len(records),
            }
        )
    )


if __name__ == "__main__":
    main()
