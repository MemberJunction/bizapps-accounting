---
"@mj-biz-apps/accounting-ng": patch
---

The JE workspace tags dimensions on the LINE rather than in a component `Map` keyed by line id. That Map was justified by a comment saying `JournalEntryLine` declares no `Dimensions` related collection — true when written, false since the collection landed, and a mirror kept alive by its own stale justification. Clearing an axis now removes the tag rather than setting it to null, because an axis with no value is an absent tag and the engine rejects the alternative.
