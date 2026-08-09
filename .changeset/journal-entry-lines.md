---
"@mj-biz-apps/accounting-entities": minor
"@mj-biz-apps/accounting-core-entities-server": minor
---

Move journal entry lines onto an MJ 6.1 related-record collection.

`Lines` is declared as `EntityRelationship.RelatedRecordCollection` metadata, so CodeGen emits a
typed accessor onto the generated entity class and both tiers have it. That replaces `_lines`,
`_deletedLines`, and the hand-written save sequence on `JournalEntryEntityServer`.

Adds `JournalEntryEntity`, a shared client+server subclass carrying the double-entry invariants —
at least two lines, and debits equal to credits at penny precision — so the browser refuses an
unbalanced entry before a round trip rather than after one.

Also fixes two defects that made the baseline uninstallable on a fresh database: the `Application`
row its generated half references was never created, and `V202608062100` threw when CodeGen metadata
was absent, which made `scripts/rebuild-db.sh` impossible to complete.
