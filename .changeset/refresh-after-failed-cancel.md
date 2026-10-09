---
"@mj-biz-apps/accounting-ng": patch
---

Batch Dispatch reloads the batch list after a cancel the server refuses, not only after one that succeeds. When the ERP posts a Failed batch while it is being cancelled, the server records the batch Posted and refuses the cancel; the card now shows Posted instead of staying Failed until a manual refresh (#324).
