---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Business Central batches now post to accounts pulled from Business Central (bc-aidp-next-golive#282).

- **Posting.** The BC GL pull stores BC's account id, a GUID, in `GLAccount.ExternalAccountID`. The engine sent that id as each journal line's `accountNumber`, which BC reads as the account number (20 characters at most), so every batch against a pulled account would have failed. `BusinessCentralERPProvider` now sends a line whose account carries a BC id as `accountId`, with no `accountNumber`. An account with no BC id is still sent by its `Code` as `accountNumber`.
- **Lookup.** BC's G/L entries return both the account id and the number. A line sent by id is matched on the id, compared without case, so a retry of a batch BC already holds is still found instead of reading as a mismatch.
- `resolveExternalAccountRef` returns the resolved identity with `accountId` set when it is the ERP's own account id. `resolveExternalAccount` is unchanged. `ERPJournalLine` and `ERPPostedJournalLine` gain an optional `accountId`.
