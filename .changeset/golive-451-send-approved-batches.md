---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-actions": minor
"@mj-biz-apps/accounting-ng": minor
---

Add a "Send approved batches" button to the Batches page (bc-aidp-next-golive#451). It calls the new `Accounting.DispatchApprovedJournalEntryBatches` Remote Operation, which requires the batch-operator Authorization (the Finance role), takes an optional company filter, sends every Approved batch through the same send as the per-batch Dispatch button, and returns each batch's outcome; one batch failing does not stop the rest. The hourly dispatch action now shares that selection and send and still runs only as the system user. The ERP sync panel is relabelled "Pull accounts and dimensions from ERP" and points to the Batches page for posting.
