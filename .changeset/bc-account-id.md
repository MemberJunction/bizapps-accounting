---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Business Central batches now post to accounts pulled from Business Central (bc-aidp-next-golive#282).

- **Posting.** The BC GL pull stores BC's account id, a GUID, in `GLAccount.ExternalAccountID`. The engine sent that id as each journal line's `accountNumber`, which BC reads as the account number (20 characters at most), so every batch against a pulled account would have failed. `BusinessCentralERPProvider` now sends a line whose account carries a BC id as `accountId`, with no `accountNumber`. An account with no BC id is still sent by its `Code` as `accountNumber`.
- **Two identifiers, two fields.** A journal line's `accountNumber` is now always the GL account's `Code`, and its `accountId` is the account's `ExternalAccountID` when one is recorded for the target ERP. Before, `accountNumber` held whichever of the two the engine chose. QuickBooks Online still posts by `accountId`, and its verb ignores `accountNumber`.
- **Lookup.** Each posted line is compared on the identifier its line was sent by: the account id when it has one, compared without case, and otherwise the account number. A retry of a batch the ERP already holds is still found. QuickBooks Online's posted lines now carry the QBO account id as `accountId`, and `ERPPostedJournalLine.accountNumber` is optional.
- `resolveExternalAccountRef` returns both identifiers. `resolveExternalAccount` still returns the id when there is one and the `Code` otherwise.
