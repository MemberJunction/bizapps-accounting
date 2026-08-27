---
'@mj-biz-apps/accounting-entities': minor
---

Own the Task form's "Journal Entry Batches this task approved" chrome (counterpart to bizapps-tasks#54, which removes it there — Tasks metadata must not name Accounting). The form-chrome record pins `inclusion: More` and `DisplayName: Journal Entry Batches`; `mj sync push` resolves it by natural key on every install.
