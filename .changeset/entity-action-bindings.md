---
"@mj-biz-apps/accounting-core-entities-server": patch
---

Author the first Entity Action bindings as metadata: `JournalEntryBatch · AfterUpdate` and
`JournalEntry · AfterCreate`, in a new `metadata/entity-actions/`. Both ship `Pending` rather than
`Active` — MJ dispatches only `Active` bindings, so they are inert until an administrator sets a
recipient and a company scope. Two of the four bindings the adoption plan proposed were dropped:
they bind `AccountingPeriod`, which this repo removed on 2026-07-06 when the ERP took ownership of
periods. No transition `ActionFilter` is authored either — MJ #3408 did not seed the reusable
"field changed to value" filters the plan assumed, and the generated-filter runtime that replaced
them is not in the installed `actions-base@6.1.0-edge.1`, so `AfterUpdate` would still fire on every
save. Shape tests cover the rules that are checkable without a database: nothing `Active`, no
`Before*`/`Validate` invocation (they would run inside the same transaction as the deferrable
balanced-JE and batch-lock constraint triggers), scope columns set together or not at all, and every
`Script` param actually compiling.
