---
"@mj-biz-apps/accounting-ng": patch
---

Build Batch preview: apply only the latest preview response. Overlapping previews (ticking entries quickly) could settle out of order, so an earlier, slower response overwrote the totals for the current selection and cleared the loading state early. The Build Batch modal and the batch workspace now discard superseded responses, and the workspace writes a response to the tab that requested it rather than the tab active when it arrives (#254).
