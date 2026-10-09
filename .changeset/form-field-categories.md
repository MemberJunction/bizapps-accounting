---
'@mj-biz-apps/accounting-ng': patch
---

Accounting entity forms no longer put fields in the generic Details panel (MemberJunction/bizapps-orders#276). The fields CodeGen left uncategorized get a section in `metadata/entity-fields`, and the forms are regenerated. A repo check now fails when a generated form puts fields in Details.
