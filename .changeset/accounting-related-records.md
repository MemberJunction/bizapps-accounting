---
"@mj-biz-apps/accounting-entities": patch
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

The last hand-rolled child collections become related-record collections. `JournalEntryLine.Dimensions` replaces `_dimensions` / `_deletedDimensions` plus their save and delete ordering, and is now available on BOTH tiers rather than server-only. `JournalEntryBatch.Members` replaces `_members`, a lazy cache with its own forceRefresh flag, and is declared `ReadOnly: true` / `OnRemove: 'refuse'` — the code already said "read-only by convention" in a comment, and a convention in a comment is enforced by whoever reads it. The GL accounts editor binds the `GLAccount` entity instead of an `AccountDraft` mirror of eleven columns filled by hand in two places and copied back by a third.
