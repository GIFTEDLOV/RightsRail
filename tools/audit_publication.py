"""Check the staged publication and historical text blobs without displaying secrets."""
from __future__ import annotations

import re
import subprocess

PATTERNS = (
    rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-[A-Za-z0-9]{32,})",
    rb"(?i)(?:private_?key|mnemonic|password|api_?key)\s*[:=]\s*[\"'](?:0x[0-9a-f]{64}|[a-z0-9_\-]{32,})[\"']",
    rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
)


def main() -> None:
    commits = subprocess.check_output(["git", "rev-list", "--all"], text=True).splitlines()
    seen = set()
    failures = []
    for revision in [*commits, ":"]:
        listing = subprocess.check_output(
            ["git", "ls-files", "--stage"] if revision == ":" else
            ["git", "ls-tree", "-r", revision], text=True,
        )
        for line in listing.splitlines():
            fields, path = line.split("\t", 1)
            blob = fields.split()[1 if revision == ":" else 2]
            if blob in seen:
                continue
            seen.add(blob)
            data = subprocess.check_output(["git", "cat-file", "blob", blob])
            if b"\0" in data[:8192]:
                continue
            if any(re.search(pattern, data) for pattern in PATTERNS):
                failures.append(path)
    if failures:
        raise SystemExit(
            "Credential pattern requires review in: "
            + ", ".join(sorted(set(failures)))
        )
    print(f"Publication scan: PASS ({len(seen)} unique tracked/staged blobs; values never printed)")


if __name__ == "__main__":
    main()
