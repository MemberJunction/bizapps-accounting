---
"@mj-biz-apps/accounting-ng": patch
---

The Accounting dashboard and the Accounting batches page now scroll. Both sized themselves to the shell's content pane and declared no scroll container, so with no window scrollbar behind them anything past the first screen could not be reached: on the dashboard, the content below the journal entry volume chart, and on the batches page, Sent batches further down the list. Each page now hides overflow on its host and scrolls the layout inside it, which is how the orders dashboard does it (bc-aidp-next-golive#367).
