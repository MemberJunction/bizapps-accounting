---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Join an already-open caller transaction when booking journal-entry drafts (TransactionDepth), and throw if EntryNumber assignment fails instead of returning a silent false.
