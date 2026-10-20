---
"@mj-biz-apps/accounting-engine-base": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A company's `BooksClosedThroughDate` closes its months (golive #316).

- Only holders of the new `MJ.BizApps.Accounting.BooksClosedThroughDate.Set` authorization (granted to the Finance role) can set, move or clear it on the Accounting Company Profile. Every change is kept in the profile's record-change history.
- Every batch build refuses a posting date on or before it, and the batch workspace and the Build Batch dialog say so before the click. A failed read of the date refuses the build.
- Regenerating a Pending batch refuses too when the month of its posting date has closed since it was built, because Regenerate keeps that date; the message says to cancel the batch and build a new one.
- A batch the ERP rejects still goes `Failed` with the ERP's message, and now also raises a new `ERP_POSTING_REJECTED` finance exception, one per failed send.
- `@mj-biz-apps/accounting-engine-base` exports the shared rule (`IsInClosedBooks`, `FirstOpenDay`, `ClosedBooksPostingDateProblem`) and `AccountingEngineBase.BooksClosedThroughFor`, for apps that date entries into the ledger.
