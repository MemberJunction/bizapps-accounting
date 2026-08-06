---
"@mj-biz-apps/accounting-ng": patch
---

Round 4 of the JournalEntryBatch rename (Marcelo 2026-08-06) — the **visible chrome** now matches the entity. The top-nav category "Batches" becomes **"Journal Entry Batches"** (the app's `DefaultNavItems` Label, so it also renames the workspace tab and the category header), and the rail mirrors the Journal Entries category's own scheme: "All batches" → **"All journal entry batches"** (primary list spelled out), "Batch workspace" → **"JE batch workspace"**, "Batch approvals" → **"JE batch approvals"** (the "JE" abbreviation already established by "JE workspace"). Dashboard / Dispatch status are unchanged (no batch noun), as is page-internal prose — "this batch", the "New batch" verb, the `Batched` status value, and `BATCH-…` numbers all still name the action or the format, not the entity.

**All accounts** moves onto the standard `mj-entity-data-grid` (matching All journal entries / All journal entry batches): the toolbar's search and filters now feed the grid's server-side predicate, clicking a row opens the inline editor, and the hand-rolled table — with its per-row Edit/Retire buttons — is retired (the editor's Active checkbox is the retire path; rollup structure remains on Chart of accounts).

Three **grid bug fixes** found while validating that swap:

- **Refresh did nothing when the filters hadn't changed.** The grid's `Params` setter deep-compares and skips refetching equal params, so rebuilding params after a save — or on a header Refresh click — was a silent no-op. All journal entries and All journal entry batches also carried a `RefreshToken` counter that nothing consumed, so their header Refresh never reached the grid either. All four grid pages (All accounts, All journal entries, All journal entry batches, Dispatch status) now hold a `@ViewChild` on the grid and call its `Refresh()` explicitly; the dead counters are gone.
- **Row clicks on All accounts never opened the editor.** `AfterRowClick` emits a `CompositeKey` concatenated string (`ID|<uuid>`), not a bare ID; the handler compared it against raw IDs and always missed. It now parses through the shared `rowKeyToId` helper, as the other grid pages already did.
- **The All accounts grid rendered at zero height.** Its wrapper carried card dressing but no sizing, and the grid's host is `height: 100%` — the same regression the All journal entries page documents. The wrapper now uses that page's proven height chain.

Known cosmetic issue, filed upstream against MJ core, not fixable here: the Entries column on All journal entry batches renders a count as currency ("$1.00"). `mj-entity-data-grid` drops the host column's `type`/`format`/`formatter` and then force-formats any numeric field whose name contains "total" as currency. The column's config here is correct and left in place, so the display heals when MJ wires host formats through.
