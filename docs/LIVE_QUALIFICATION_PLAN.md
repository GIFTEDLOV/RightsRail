# Live qualification plan

## Current chain state

The deployed V1 contract is `0x984b996079d2591976FcfFb62d0506DF02E0396A` on
Studio-dev chain `61997`. It has one frozen policy and zero requests, evidence,
adjudications, permits, and settlements. The two policy transactions remain
immutable history. No new write is authorized by this audit.

## Release-blocking sequence for a successor

1. Deploy a separately authorized successor with its exact source and ABI
   hashes, then verify `FINISHED_WITH_RETURN` and canonical readback.
2. Create and freeze one long-lived policy using chain-derived Unix seconds.
3. Submit two requests using different requester and settlement-recipient
   actors: one permitted editorial use and one prohibited betting use.
4. Commit and authenticate immutable evidence, then adjudicate once per
   request. The first successful canonical result is final.
5. Settle and verify permit/refund allocation.
6. Exercise one payout withdrawal and one requester refund withdrawal with
   distinct actors. Reconcile the external message status; never call an
   emitted message delivered without independent evidence.
7. Keep insufficient and unrelated cases as local/direct proof unless a
   separate authorization requires live execution.

## Expected local qualification cases

| Case | Context | Expected hypothesis | Live claim now |
| --- | --- | --- | --- |
| A | Editorial/newsletter, attribution, allowed transformation | `PERMITTED` / payout | Not live-proven |
| B | Betting promotion, endorsement implication | `DENIED` / refund | Not live-proven |
| C | Missing context | `INCONCLUSIVE` / refund | Local/direct only |
| D | Unrelated asset | `NOT_APPLICABLE` / refund | Local/direct only |

The expected values are not targets. Any first successful canonical semantic
result is authoritative; infrastructure failure is not a business result and
halts the sequence.
