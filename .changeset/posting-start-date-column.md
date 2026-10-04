---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-server": minor
"@mj-biz-apps/accounting-ng": minor
---

New nullable column `AccountingCompanyProfile.PostingStartDate` (DATE): the first `EffectiveDate` a company posts to the ERP. Journal entries dated before it are meant never to enter a posting batch, for example history brought in at cutover that the ERP already holds. NULL means no floor; existing profiles read NULL. Includes the CodeGen output for the column (entity subclass, GraphQL types, profile form field).
