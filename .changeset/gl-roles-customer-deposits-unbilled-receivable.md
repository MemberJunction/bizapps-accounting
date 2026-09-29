---
'@mj-biz-apps/accounting-entities': minor
---

Ships the Customer Deposits and Unbilled Receivable GL account roles to hosts. Until now they existed only in `metadata/`, so no install had them. bizapps-orders 5.20 posts to both, and without Customer Deposits it refuses payments on scheduled orders. The seed covers these two roles and nothing else, and it skips a role a host already has.
