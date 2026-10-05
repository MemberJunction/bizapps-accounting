---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-server": minor
---

A company profile's parent may itself have a parent. `trg_ACP_NoChains` (error 50010) now refuses a cycle instead of any chain, so a Division can sit under a legal entity that sits under a holding company. A profile pointing at itself stays refused by `CK_AccountingCompanyProfile_NoSelfParent`. The `ParentAccountingCompanyID` description is rewritten: a Division, Department or Branch uses the books of the first company up the chain of any other type. Includes the CodeGen output for the description.
