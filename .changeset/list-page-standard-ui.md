---
"@mj-biz-apps/accounting-ng": patch
---

List-page UI standard across the accounting shell. Adds shared `mja-summary-strip` (equal-width stat figures) and `mja-list-toolbar` (search + status preset chips + trailing Filters disclosure) components, and converts All Journal Entries, All Batches (new page, replacing the BatchStatus dashboard on that rail item), All Accounts, and Chart of Accounts to the standard page shape: one fused subheader band (stats + toolbar) over a rounded grid card, no title card. Adds a batch detail slide-in panel (identity, dispatch trail, totals, missing-task warning, member entries) and "Open in workspace" from both detail panels (JE workspace `FocusEntryID`, batch workspace `FocusBatchID`). Category headers gain an icon-only refresh and promote the primary create verb; the nav rail's collapse control is redesigned (double-angle chip, locked position across expand/collapse — no more hamburger).
