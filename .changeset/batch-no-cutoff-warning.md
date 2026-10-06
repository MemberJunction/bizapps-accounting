---
'@mj-biz-apps/accounting-ng': patch
---

Clearing the batch cutoff now says what it does (golive #168). An empty cutoff sends no date clause, so the preview includes Pending journal entries dated in the future; the batch workspace and the Batches page's Build Batch modal now show "No cutoff — includes future-dated entries." under the date input, and the workspace's criteria chips show it in place of the missing "through" chip.
