---
"@mj-biz-apps/accounting-ng": patch
---

Wire the MJ-core UI inputs the list-page standard was designed around: `[FillWidth]` on the All Journal Entries and All Batches grids (inert trailing filler column so row banding reaches the card edge without stretching a real column) and `[IconOnly]` on the shell rail's `mj-left-nav` (tooltips + accessible names when the rail is collapsed to icons). Requires the MemberJunction release that ships `EntityDataGrid.FillWidth` and `MJLeftNav.IconOnly`.
