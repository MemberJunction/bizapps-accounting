---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Raising and clearing finance exceptions works on PostgreSQL: the locking reads pick their SQL by database platform and bind positional parameters, and a raise on PostgreSQL takes an advisory lock per (type, DedupeKey) so a concurrent raise of the same new item still finds the first one's row.
