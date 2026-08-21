---
"@mj-biz-apps/accounting-entities": patch
"@mj-biz-apps/accounting-core-entities-server": patch
"@mj-biz-apps/accounting-ng": patch
---

The JE workspace composes a real `JournalEntryEntity` with its `Lines` collection instead of a hand-maintained `JEDraftState`/`JEDraftLine` mirror, so the screen and the ledger run the same `Validate()`. New shared `JournalEntryLineEntity` carries the per-line rules that need nothing but the line — an account, exactly one side, neither side negative — which were server-only and restated by hand in the editor. `JournalEntryEntityServer.Validate()` loses the three rules it duplicated from the shared subclass (every unbalanced entry was reporting itself twice) and gains the one that is genuinely its own: a blank line reaching a save is named by number rather than failing at a NOT NULL constraint. The double-entry line count now counts lines somebody actually typed in, so an untouched two-row draft can no longer satisfy it.
