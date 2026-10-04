---
"@mj-biz-apps/accounting-core-entities-server": patch
---

A batch the ERP accepted whose `Sent → Posted` save then failed is now marked `Failed` instead of throwing (#30). On a manual dispatch the throw left the batch at `Sent`, where no retry, archive or stranded-entry report reaches it, with its entries held at `Batched`. The `Failed` batch keeps the ERP reference, and the retry records it `Posted` under that reference without sending it again. `sendJournalEntryBatch` returns the batch `Failed` in this case, as it does for a send the ERP rejects.
