---
"@mj-biz-apps/accounting-ng": patch
---

Batch preview selection (the Build Batch dialog and the batch workspace) is now either every candidate or an explicit set of ticked entries, sent to the preview and the build as it is. A filter change no longer sends a selection derived from the previous preview's entries, so Entry Totals, Net to Post, the out-of-order warning and the Build count describe the entries ticked on screen. After Clear All, or any untick, entries that a later filter change brings in start unticked (bc-aidp-next-golive#284).
