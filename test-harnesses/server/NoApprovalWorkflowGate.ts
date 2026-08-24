/**
 * NoApprovalWorkflowGate — the seed/maintenance fixture for "run this batch flow WITHOUT a tasks app."
 *
 * It replaces `AutoApproveGate`, which used to live in (and be exported from) the accounting package
 * itself and was the DEFAULT gate for `buildJournalEntryBatch` and friends. Two things were wrong
 * with that, and the name was the root of both:
 *
 *   1. "AutoApprove" describes a POLICY (everything gets approved). What the object actually does is
 *      answer a different question — "is there an approval workflow in this deployment at all?" — with
 *      "no". Dressed as a policy and wired in as a default, opting OUT of the CFO gate looked like
 *      opting IN, and it typechecked. Production callers passed a real gate, so nothing shipped
 *      broken, but the safety of the whole seam rested on every caller remembering.
 *   2. As a test double it proves nothing. `assertApproved` that always returns can only confirm the
 *      code path it disables. The gate double that earns its keep is one that can FAIL — see L11's
 *      `failingGate` in phase2-encapsulation.live.test.ts, which is why that test means something.
 *
 * So the accounting package now ships exactly one gate (TasksAppApprovalGate) and requires callers to
 * pass one. This lives HERE, in the harness, because "build and post a batch without standing up
 * bizapps-tasks" is a real fixture need — it is just not a production concern, and it should never be
 * reachable from a consumer's `import`.
 *
 * USE IT ONLY for seeding and maintenance scripts. If you reach for it in a test that is ABOUT
 * approval, the test is wrong: use TasksAppApprovalGate, or a double that refuses.
 */
import type { JournalEntryBatchApprovalGate } from '@mj-biz-apps/accounting-core-entities-server';

/**
 * No approval workflow: raises no Task (`onBatchBuilt`/`assertCanRaise` are deliberately absent, so a
 * batch built with this carries a null ApprovalTaskID), records no decision, and does not block a
 * dispatch. The batch's own Status graph is the only thing still governing the flow.
 */
export const NoApprovalWorkflowGate: JournalEntryBatchApprovalGate = {
  // Not "approved" — UNGATED. Nothing raised a Task, so there is no decision for this to read.
  async assertApproved(): Promise<void> { /* no approval workflow in this fixture */ },
  // Nothing to record against: no Task exists. Present because the seam requires it — a gate that
  // can refuse a send must be able to record the decision that unblocks it.
  async recordDecision(): Promise<void> { /* no task, no decision */ },
};
