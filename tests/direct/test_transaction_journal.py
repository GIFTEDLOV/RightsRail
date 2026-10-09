from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from rightsrail_workflow import JournalCorruption, TransactionJournal


class TransactionJournalTests(unittest.TestCase):
    def test_append_is_durable_replayable_and_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "transactions.jsonl"
            journal = TransactionJournal(path)
            intent = journal.append(
                tx_id="tx-001",
                action="SETTLE_REQUEST",
                state="INTENTED",
                payload={"request": "r-1"},
            )
            journal.append(
                tx_id="tx-001", action="SUBMIT", state="SUBMITTED", payload={"request": "r-1"}
            )
            journal.append(
                tx_id="tx-001",
                action="FINALITY",
                state="FINALITY_CONFIRMED",
                payload={"request": "r-1"},
            )
            self.assertEqual(journal.append(
                tx_id="tx-001",
                action="FINALITY",
                state="FINALITY_CONFIRMED",
                payload={"request": "r-1"},
            ), journal.entries[-1])
            self.assertEqual(journal.recover_pending(), ("tx-001",))
            recovered = TransactionJournal(path)
            self.assertEqual(recovered.entries, journal.entries)
            self.assertEqual(intent.sequence, 1)

    def test_invalid_transition_and_corruption_stop_replay(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "transactions.jsonl"
            journal = TransactionJournal(path)
            journal.append(tx_id="tx-002", action="INTENT", state="INTENTED", payload={})
            with self.assertRaises(ValueError):
                journal.append(
                    tx_id="tx-002", action="DONE", state="EXECUTION_SUCCEEDED", payload={}
                )
            path.write_text(path.read_text(encoding="utf-8") + "not-json\n", encoding="utf-8")
            with self.assertRaises(JournalCorruption):
                TransactionJournal(path)


if __name__ == "__main__":
    unittest.main()
