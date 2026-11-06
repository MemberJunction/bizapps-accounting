---
"@mj-biz-apps/accounting-engine-base": minor
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-ng": minor
---

A Periods page for month close, and a Finance gate on the posting start date (golive #447).

- Only holders of the new `MJ.BizApps.Accounting.PostingStartDate.Set` authorization (granted to the Finance role) can set, move or clear a company's `PostingStartDate` on its Accounting Company Profile, the same way `BooksClosedThroughDate` is gated.
- The Accounting app gains a Periods nav item: one row per active company with its books-closed and posting start dates. Close month / Reopen month move the books-closed date by whole calendar months, and a month still under way cannot be closed. The posting start date is read-only with an Edit behind a confirmation, and shows how many pending entries it holds back (the batch preview's count). The buttons show only to holders of each authorization.
- `@mj-biz-apps/accounting-engine-base` exports `UserCanSetBooksClosedThroughDate`, `UserCanSetPostingStartDate` and both authorization names, plus `CloseMonthThrough`, `ReopenMonthThrough` and `CanCloseMonth`.
