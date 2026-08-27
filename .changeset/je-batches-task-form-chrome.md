---
'@mj-biz-apps/accounting-entities': minor
---

Own the Task form's "Journal Entry Batches this task approved" chrome (counterpart to bizapps-tasks#54, which removes it there — Tasks metadata must not name Accounting). The form-chrome record pins `inclusion: More` and `DisplayName`, and a Metadata_Sync migration applies the same configuration by natural key so migrations-only installs get it — the relationship row is heal-created with a per-install ID, so a captured UPDATE-by-ID would not replay.
