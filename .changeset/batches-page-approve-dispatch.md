---
"@mj-biz-apps/accounting-ng": patch
"@mj-biz-apps/accounting-core-entities-server": patch
---

A journal entry batch can now be approved, rejected and sent from the Accounting app's Batches page (#466). Since the app's nav was reduced to Overview and Batches, the only screens with Approve, Reject and Dispatch were no longer reachable, so a batch built from the Batches page stayed Pending. Each row now offers Approve and Reject on a Pending batch to the company's approver who did not build it, Dispatch on an Approved batch and Retry on a Failed one to holders of the batch-operator grant. Reject asks for a reason, which becomes the batch's cancel reason. A retry the server's ERP lookup cannot settle asks the operator to check the ERP first; that dialog is now one component shared with Dispatch status. The approval Task's description now says to approve or reject the batch in the Accounting app, since a decision recorded on the Task alone does not change the batch.
