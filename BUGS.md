
### Batch Approvals inbox — card does not live-update after Approve (needs manual Refresh)
- Found: 2026-07-10 (Task 36 testing rollout, GUI/Playwright)
- Severity: LOW (cosmetic/reactivity — no data or correctness impact)
- Repro: Batch Approvals → Approve a Pending batch. The success banner reads "Recorded 'Approved' on
  batch BATCH-xxxxxx", but that batch's card still shows the **Pending** badge + a **Regenerate** action
  (not **Approved** + **Dispatch**). Clicking **Refresh** then shows the correct Approved state + Dispatch.
- Root cause (suspected): the inbox card list isn't reactively refreshed after the approve mutation
  (`BatchDispatchClient.recordDecision`). The engine + DB are correct (Approve is persisted; refresh
  reflects it; T3 batch-dispatch-api 20/20 and engine 12/12 prove the state machine). This is a UI
  reactivity gap only — likely wants a `BaseEngine.ObserveProperty`/reload after recordDecision, per the
  reactive-UI convention (see MJ CLAUDE.md "Reactive UIs over entity caches").
- Test status: covered — `test-harnesses/playwright/specs/accounting-batch-approvals.spec.ts` drives the
  real Refresh and asserts the resulting Approved + Dispatch state (passes). If the card is made reactive,
  the Refresh step becomes a harmless no-op.

### Reject → rebuild: freed entries may not re-batch (banner says "returned to candidate pool")
- Found: 2026-07-10 (Task 36, GUI reconciliation of batching-reject.spec)
- Severity: MEDIUM — needs investigation (could be correct netting behavior OR a real gap)
- Repro: Batch Approvals → build a batch → Reject it. Banner reads "Rejected batch BATCH-xxxx — cancelled;
  its journal entries returned to the candidate pool." Then go to Batch Status → Build Batch again. Observed:
  NO new Pending batch appears in Batch Approvals — only the Cancelled batch + unrelated Posted demo batches
  remain (screenshot: test-harnesses/playwright/test-results/batching-reject-*/test-failed-1.png).
- Open question: does Reject actually return the freed JEs to a BUILDABLE candidate state, or do they land in
  a state the global buildBatch sweep skips (or net to zero on rebuild)? The #12 core (Reject → Cancelled +
  the entries-freed banner) IS verified; only the *rebuild-after-reject* is unproven.
- Where to look: CoreEntitiesServer buildBatch + the reject/recordDecision path (what Status the freed JEs get);
  BatchStatus OpenBuildPreview candidate query. Cross-check the Tier-2 harness (block2 / batching) reject→rebuild.
- Test status: batching-reject.spec.ts asserts the verified #12 core only; rebuild+Regenerate assertions were
  removed pending this answer (NOT forced green).
