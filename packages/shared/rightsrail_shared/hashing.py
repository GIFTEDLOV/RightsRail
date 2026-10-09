"""Canonical hashing helpers used for binding and audit identity."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_bytes(value: Any) -> bytes:
    """Serialize JSON-compatible values with one deterministic representation."""

    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def canonical_digest(value: Any) -> str:
    return sha256_bytes(canonical_bytes(value))
