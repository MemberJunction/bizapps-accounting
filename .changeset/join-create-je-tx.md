---
"@mj-biz-apps/accounting-core-entities-server": patch
---

CreateJournalEntries joins a caller-owned provider transaction instead of wrapping a second one. Journal entry numbering failures throw with the SQL error instead of returning false with an unknown message.
