---
'@mj-biz-apps/accounting-entities': minor
---

The 0.20 Metadata_Sync seeds the ERP Posting Not Read Back finance exception type (`ERP_POSTING_NOT_READ_BACK`), which the batch engine raises when the ERP accepts a journal batch it cannot then read back, so hosts have the type the new code raises and not only a developer's own database. The seed is idempotent and safe on a host that already ran `mj sync push`. As in 0.17, the Active posting scheduled jobs and the ML bench output under metadata/ are not included.
