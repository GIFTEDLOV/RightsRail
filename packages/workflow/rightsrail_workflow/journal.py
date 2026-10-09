"""Crash-safe, append-only transaction journal for post-consensus execution."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from rightsrail_shared import canonical_digest

JournalState = Literal[
    "INTENTED",
    "SUBMITTED",
    "FINALITY_CONFIRMED",
    "EXECUTION_SUCCEEDED",
    "EXECUTION_FAILED",
]
TERMINAL_STATES: frozenset[JournalState] = frozenset(
    {"EXECUTION_SUCCEEDED", "EXECUTION_FAILED"}
)
ALLOWED_TRANSITIONS: dict[JournalState, frozenset[JournalState]] = {
    "INTENTED": frozenset({"SUBMITTED"}),
    "SUBMITTED": frozenset({"FINALITY_CONFIRMED"}),
    "FINALITY_CONFIRMED": frozenset(TERMINAL_STATES),
    "EXECUTION_SUCCEEDED": frozenset(),
    "EXECUTION_FAILED": frozenset(),
}


@dataclass(frozen=True)
class JournalEntry:
    sequence: int
    tx_id: str
    action: str
    state: JournalState
    payload_sha256: str
    created_at: str


class JournalCorruption(ValueError):
    """Raised when an append-only journal cannot be safely replayed."""


class TransactionJournal:
    """Durable JSON-lines journal with fsync and idempotent replay semantics."""

    _FIELDS = {"sequence", "tx_id", "action", "state", "payload_sha256", "created_at"}

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._entries = self._read()

    @property
    def entries(self) -> tuple[JournalEntry, ...]:
        return tuple(self._entries)

    def append(
        self,
        *,
        tx_id: str,
        action: str,
        state: JournalState,
        payload: Any,
    ) -> JournalEntry:
        self._require_text(tx_id, "tx_id")
        self._require_text(action, "action")
        payload_sha256 = canonical_digest(payload)
        previous = self._latest(tx_id)
        if previous is not None:
            if previous.state == state:
                if previous.action == action and previous.payload_sha256 == payload_sha256:
                    return previous
                raise JournalCorruption("replayed state has different action or payload")
            if state not in ALLOWED_TRANSITIONS[previous.state]:
                raise ValueError(f"invalid transaction transition {previous.state} -> {state}")
        entry = JournalEntry(
            sequence=len(self._entries) + 1,
            tx_id=tx_id,
            action=action,
            state=state,
            payload_sha256=payload_sha256,
            created_at=datetime.now(UTC).isoformat(),
        )
        encoded = json.dumps(entry.__dict__, sort_keys=True, separators=(",", ":"))
        with self.path.open("a", encoding="utf-8", newline="\n") as journal_file:
            journal_file.write(encoded + "\n")
            journal_file.flush()
            self._flush_to_disk(journal_file)
        self._entries.append(entry)
        return entry

    def recover_pending(self) -> tuple[str, ...]:
        """Return non-terminal tx IDs for idempotent worker reconciliation."""

        latest: dict[str, JournalState] = {}
        for entry in self._entries:
            latest[entry.tx_id] = entry.state
        return tuple(tx_id for tx_id, state in latest.items() if state not in TERMINAL_STATES)

    def _latest(self, tx_id: str) -> JournalEntry | None:
        for entry in reversed(self._entries):
            if entry.tx_id == tx_id:
                return entry
        return None

    def _read(self) -> list[JournalEntry]:
        if not self.path.exists():
            return []
        entries: list[JournalEntry] = []
        latest_by_tx: dict[str, JournalEntry] = {}
        with self.path.open("r", encoding="utf-8") as journal_file:
            for line_number, line in enumerate(journal_file, start=1):
                if not line.strip():
                    raise JournalCorruption(f"blank journal line {line_number}")
                try:
                    raw = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise JournalCorruption(f"invalid JSON at line {line_number}") from exc
                if not isinstance(raw, dict) or set(raw) != self._FIELDS:
                    raise JournalCorruption(f"invalid journal fields at line {line_number}")
                entry = self._entry_from_json(raw, line_number)
                if entry.sequence != len(entries) + 1:
                    raise JournalCorruption(f"non-monotonic sequence at line {line_number}")
                previous = latest_by_tx.get(entry.tx_id)
                if previous is not None and entry.state not in ALLOWED_TRANSITIONS[previous.state]:
                    if not (
                        entry.state == previous.state
                        and entry.action == previous.action
                        and entry.payload_sha256 == previous.payload_sha256
                    ):
                        raise JournalCorruption(f"invalid transition at line {line_number}")
                entries.append(entry)
                latest_by_tx[entry.tx_id] = entry
        return entries

    @staticmethod
    def _entry_from_json(raw: dict[str, Any], line_number: int) -> JournalEntry:
        state = raw["state"]
        if state not in ALLOWED_TRANSITIONS:
            raise JournalCorruption(f"invalid state at line {line_number}")
        values = {key: raw[key] for key in ("tx_id", "action", "payload_sha256", "created_at")}
        for key, value in values.items():
            if not isinstance(value, str) or not value:
                raise JournalCorruption(f"invalid {key} at line {line_number}")
        if not isinstance(raw["sequence"], int) or isinstance(raw["sequence"], bool):
            raise JournalCorruption(f"invalid sequence at line {line_number}")
        return JournalEntry(
            sequence=raw["sequence"],
            tx_id=raw["tx_id"],
            action=raw["action"],
            state=state,
            payload_sha256=raw["payload_sha256"],
            created_at=raw["created_at"],
        )

    @staticmethod
    def _require_text(value: str, name: str) -> None:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{name} must be non-empty")

    @staticmethod
    def _flush_to_disk(journal_file: Any) -> None:
        journal_file.flush()
        try:
            import os

            os.fsync(journal_file.fileno())
        except OSError:
            # Some virtual filesystems do not expose fsync; the append is still
            # flushed and replay remains strict rather than silently recovering.
            pass
