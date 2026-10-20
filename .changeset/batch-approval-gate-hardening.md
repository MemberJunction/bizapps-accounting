---
"@mj-biz-apps/accounting-core-entities-server": minor
"@mj-biz-apps/accounting-ng": minor
"@mj-biz-apps/accounting-engine-base": minor
---

Batch approval and archive checks (#446, #447, #448, #451, #452):

- A batch moves to Approved only through the approval decision; a plain save (the generic form or the GraphQL update) that sets Status = Approved is refused, and the approver is always the user who approved (#447).
- The batch audit fields (who built, approved, archived, cancelled or sent it, and when) are written by the server only; a plain save that changes one is refused (#451).
- Sending a batch re-checks its approval: the batch must record an approver who did not build it, and an approval decision attributed to another person does not count (#446).
- Building, regenerating, dispatching and archiving a batch require the Finance role, through the new `MJ.BizApps.Accounting.JournalEntryBatches.Operate` Authorization (metadata); the batch pages hide those actions from users without it. The scheduled build and auto-post are unaffected (#448).
- Archiving a batch is possible only through the Archive action: before approval only the company's configured approver may archive it (the builder may still cancel it), past approval the approver or whoever approved the batch; the batch pages show Archive only to them (#448).
- Another server package can no longer silently replace the batch approval gate, ERP poster and ERP lookup: a replacement is used only in unit tests or when the `ACCOUNTING_DISPATCH_SERVICES_OVERRIDE` environment variable names it, and is logged either way (#452).
