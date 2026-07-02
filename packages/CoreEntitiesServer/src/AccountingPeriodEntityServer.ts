/**
 * Server-side subclass of AccountingPeriod — Block 2 period-close lifecycle (W7/W8).
 *
 *   W7 period-close orchestration: when a save moves Status to Closing/Closed, validate the close
 *      prerequisites (no Pending JEs, all batches Acknowledged, all due ScheduledJournalEntry rows
 *      materialized); on success advance to Closed + stamp ClosedAt/ClosedByUserID. **No balance
 *      materialization in v1** (AD-12). On failure it throws loudly (the period stays as-is).
 *   W8 reopen: Closed → Reopened requires a non-empty ReopenReason; stamps ReopenedAt/By.
 *      ClosedAt is left set (CK_AccountingPeriod_ClosedCoherence requires it for Reopened too).
 *
 * CONNECTS TO:
 *   READS:       Journal Entries · Journal Entry Batches · Scheduled Journal Entries (close gate)
 *   DB TRIGGERS: trg_JournalEntry_PeriodClose (50007) becomes active once Status=Closed (blocks new posts)
 *   CHECK:       CK_AccountingPeriod_ClosedCoherence (Closed/Reopened ⇒ ClosedAt set)
 *   SIBLINGS:    JournalEntryEntityServer (W4 routes adjusting entries to the next open period)
 *   ENTITY:      'MJ_BizApps_Accounting: Accounting Periods'
 *   DOC:         docs/lifecycle-hooks.md (W7/W8) · docs/ARCHITECTURE.md
 */
import { BaseEntity, EntitySaveOptions, RunView } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingAccountingPeriodEntity } from '@mj-biz-apps/accounting-entities';

const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const SJE_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entries';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Accounting Periods')
export class AccountingPeriodEntityServer extends mjBizAppsAccountingAccountingPeriodEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (this.IsSaved) {
      const previous = await this.loadPreviousStatus();
      if (previous && previous !== this.Status) {
        await this.handleStatusTransition(previous, this.Status);
      }
    }
    return super.Save(options);
  }

  private async handleStatusTransition(from: string, to: string): Promise<void> {
    if (to === 'Closing' || to === 'Closed') {
      if (from === 'Closed') return; // already closed; no-op
      await this.closePeriod(); // W7
    } else if (to === 'Reopened') {
      this.reopenPeriod(from); // W8
    }
  }

  // ─── W7: period-close orchestration ───────────────────────────────────────
  private async closePeriod(): Promise<void> {
    const blockers = await this.validateCloseable();
    if (blockers.length > 0) {
      throw new Error(`Cannot close AccountingPeriod ${this.ID}: ${blockers.join('; ')}.`);
    }
    // Validated — lock it. (No AccountBalance materialization in v1, per AD-12.)
    this.Status = 'Closed';
    this.ClosedAt = new Date();
    this.ClosedByUserID = this.ContextCurrentUser?.ID ?? null;
  }

  /** Returns a list of human-readable blockers; empty = closeable. */
  public async validateCloseable(): Promise<string[]> {
    const rv = new RunView();
    // BypassCache: a period-close gate MUST read TRUE DB state — a stale filtered cache (e.g. a JE
    // read as Pending moments before it was batched/GLPosted) would otherwise falsely block (or, worse,
    // falsely allow) a close. The live harness caught exactly this on the close-after-acknowledge path.
    const [pending, openBatches, scheduled] = await rv.RunViews([
      { EntityName: JE_ENTITY, ExtraFilter: `AccountingPeriodID='${this.ID}' AND Status='Pending'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
      { EntityName: BATCH_ENTITY, ExtraFilter: `AccountingPeriodID='${this.ID}' AND Status <> 'Acknowledged'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
      { EntityName: SJE_ENTITY, ExtraFilter: `TargetAccountingPeriodID='${this.ID}' AND Status='Scheduled'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
    ], this.ContextCurrentUser);

    const blockers: string[] = [];
    const n = (r: { Results?: unknown[] }) => r.Results?.length ?? 0;
    if (n(pending) > 0) blockers.push(`${n(pending)} Pending journal entr${n(pending) === 1 ? 'y' : 'ies'} remain`);
    if (n(openBatches) > 0) blockers.push(`${n(openBatches)} batch(es) not yet Acknowledged`);
    if (n(scheduled) > 0) blockers.push(`${n(scheduled)} scheduled entr${n(scheduled) === 1 ? 'y' : 'ies'} not yet materialized`);
    return blockers;
  }

  // ─── W8: reopen ───────────────────────────────────────────────────────────
  private reopenPeriod(from: string): void {
    if (from !== 'Closed') {
      throw new Error(`AccountingPeriod can only be reopened from Closed (was ${from}).`);
    }
    if (!this.ReopenReason || this.ReopenReason.trim().length === 0) {
      throw new Error('Reopening a closed period requires a non-empty ReopenReason (W8).');
    }
    this.ReopenedAt = new Date();
    this.ReopenedByUserID = this.ContextCurrentUser?.ID ?? null;
    // ClosedAt intentionally left set — CK_AccountingPeriod_ClosedCoherence requires it for Reopened.
  }

  private async loadPreviousStatus(): Promise<string | null> {
    const rv = new RunView();
    const res = await rv.RunView<{ Status: string }>(
      { EntityName: PERIOD_ENTITY, ExtraFilter: `ID='${this.ID}'`, Fields: ['Status'], ResultType: 'simple', BypassCache: true },
      this.ContextCurrentUser,
    );
    return res.Success && res.Results.length ? res.Results[0].Status : null;
  }
}
