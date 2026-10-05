---
"@mj-biz-apps/accounting-engine-base": patch
"@mj-biz-apps/accounting-core-entities-server": patch
---

`AccountingEngineBase.LegalEntityFor(companyId)` returns the company whose books a company uses. A Division, Department or Branch walks up `ParentAccountingCompanyID` to the first company of any other type; every other type, and a company with no profile, is its own legal entity. A Division with no parent, a parent with no profile, or a loop throws `AccountingResolutionError` with code `LEGAL_ENTITY_UNRESOLVED`, naming the company. Also exported: the pure `ResolveLegalEntity`, `UsesParentBooks` and `PARENT_BOOKS_ENTITY_TYPES`.

A company that keeps no books owns no active GL accounts: `GLAccountEntityServer` refuses creating or reactivating an active account on a Division, Department or Branch, and `AccountingCompanyProfileEntityServer` refuses changing a company that owns an active account to one of those types.
