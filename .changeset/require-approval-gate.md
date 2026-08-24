---
'@mj-biz-apps/accounting-core-entities-server': minor
---

**Breaking (pre-1.0):** removed `AutoApproveGate` and made the approval gate a required argument.

`AutoApproveGate` was the DEFAULT value for `buildJournalEntryBatch`,
`buildJournalEntryBatchFromExplicitIds` and `buildJournalEntryBatchFromView`, and it was exported
from the package. Its `assertApproved` was a no-op and it implemented neither `assertCanRaise` nor
`onBatchBuilt` — so "no CFO precondition, no approval Task raised, dispatch ungated" was what a
consumer got by *omitting an argument*. A bypass shaped like a policy: it typechecks, and it reads
as safe at the call site. Every in-repo production caller passed `TasksAppApprovalGate` explicitly,
so nothing shipped ungated, but the safety of the seam rested on each caller remembering.

It was also worthless as a test double — a stub that always approves can only confirm the code path
it disables.

- `gate` is now a required parameter on all three build entry points (it was already required on
  `SendJournalEntryBatchOptions`).
- `AutoApproveGate` is deleted and no longer exported; `TasksAppApprovalGate` is the only gate this
  package ships.
- No replacement ships. The demo seeder now uses the real gate (a seeding script knows who the
  approver is, because it configures the CFO itself), so demo batches carry a real approval Task like
  every other batch. The only surviving no-workflow stub is declared inline in the one live spec that
  builds batches as scaffolding — a property of that test, not of this app.

**Migration:** pass a gate explicitly. Production callers pass `new TasksAppApprovalGate(provider)`.
A caller that genuinely wants no approval workflow must now write its own gate and say so.
