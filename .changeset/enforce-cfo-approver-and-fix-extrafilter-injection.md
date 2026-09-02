---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Security: enforce CFO approver identity (separation of duties) on journal-entry-batch approval, and close a second-order SQL-injection class in RunView `ExtraFilter` concatenation.

- The batch approval gate now requires the calling user to be the batch company's configured CFO approver before an approving decision is recorded, and `approveJournalEntryBatch` rejects self-approval (the batch creator, `BatchedByUserID`, may never approve their own batch). Previously any authenticated caller of the decision Remote Operation could approve their own batch and dispatch it to the ERP.
- Client-settable UUID fields (`EntityID`, `GLAccountRoleID`, `GLAccountID`, the Standard-build `CompanyID`, and JournalEntry `FileID`) are now strictly validated as UUIDs before being concatenated into `ExtraFilter`, via a shared `sqlGuidLiteral` helper. Polymorphic `RecordID` remains quote-escaped (it may legitimately be a non-UUID key).
