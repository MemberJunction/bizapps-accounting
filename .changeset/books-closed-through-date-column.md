---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

New nullable column `AccountingCompanyProfile.BooksClosedThroughDate` (DATE): the last day of the latest month finance has closed for the company. A date on or before it is in a closed month. NULL means nothing is closed; existing profiles read NULL. Includes the CodeGen output for the column (entity subclass, GraphQL types, profile form field).
