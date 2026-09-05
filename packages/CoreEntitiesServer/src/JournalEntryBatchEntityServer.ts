/**
 * Server-side subclass of JournalEntryBatch — the batch's OWN invariants + owned collections
 * (enriched 2026-07-29 per Marcelo's review: "some of it should be in a BaseEntity subclass").
 *
 * WHAT LIVES HERE (single-aggregate concerns):
 *   - JournalEntryBatchNumber: atomic counter sproc on first save.
 *   - Lifecycle: born Pending; the legal status-transition graph; Approved auto-stamps
 *     ApprovedAt/ApprovedByUserID from the context user when the caller didn't supply them.
 *   - Read-only hydration (JE.Lines-style): `Members` (the locked member JEs) and
 *     `SummaryJournalEntry` — so consumers (dispatch, UI, tests) stop hand-rolling RunViews.
 *   - Cross-record coherence (ValidateAsync): on the Pending→Approved transition, the control
 *     totals must foot against the summary JE's lines and TotalEntries must equal the member
 *     count — the approver signs those numbers, so they must be true at the moment they become
 *     load-bearing. (Trigger 50023 covers the summary POINTER; this covers the TOTALS.)
 *   - `Cancel()`: reverse a PRELIMINARY (Pending) batch — delete the summary JE, return the
 *     member JEs to the candidate pool, mark Cancelled — in ONE provider transaction. The member
 *     unlock is the batch releasing ITS OWN locks (the reversible Batched→Pending transition the
 *     DB triggers sanction exactly for this), so it is legitimately batch-owned.
 *
 * WHAT DELIBERATELY STAYS IN THE ENGINE (multi-aggregate orchestration — JournalEntryBatchEngine.ts):
 *   build/regenerate (gather candidates → net → create summary → lock N independent JEs → raise
 *   the approval task) and dispatch (gate + ERP poster seam). Those compose MANY aggregates and
 *   run behind Remote Operations per the engine+transaction ruling (Marcelo 2026-07-21).
 */

import { BaseEntity, DatabaseProviderBase, EntitySaveOptions, IMetadataProvider, IRunViewProvider, UserInfo, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';

import { getNextJournalEntryBatchNumber } from './SequenceService.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

/** Cent-level tolerance — amounts are decimal(18,2). */
const FOOT_TOLERANCE = 0.005;

/**
 * The legal batch status graph (plan §7): Pending → Approved | Cancelled · Approved → Sent ·
 * Sent → Posted | Failed · Failed → Sent (retry) · Posted / Cancelled are terminal.
 * The DB immutability trigger freezes Approved/Sent/Posted content but does not police the
 * transition GRAPH itself — that is this entity's always-applies invariant, so a direct
 * client save can never jump Pending→Sent (skip approval) or resurrect a terminal batch.
 */
const LEGAL_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  Pending: ['Pending', 'Approved', 'Cancelled'],
  Approved: ['Approved', 'Sent'],
  Sent: ['Sent', 'Posted', 'Failed'],
  Failed: ['Failed', 'Sent'],
  Posted: ['Posted'],
  Cancelled: ['Cancelled'],
};

@RegisterClass(BaseEntity, BATCH_ENTITY)
export class JournalEntryBatchEntityServer extends mjBizAppsAccountingJournalEntryBatchEntity {

  // `Members` is a READ-ONLY RelatedRecordCollection on the generated class now. It replaces
  // `_members`, a hand-rolled lazy cache with its own forceRefresh flag and its own invalidation —
  // which is `Load(force)` and `IsLoaded` written again, per aggregate. Read-only and OnRemove
  // 'refuse' make the comment this class already carried — "the batch never writes other aggregates"
  // — something the collection enforces rather than something a reader has to honour.
  private _summary: mjBizAppsAccountingJournalEntryEntity | null | undefined = undefined;

  /** BaseEntity SKIPS ValidateAsync by default — opt in, or the coherence check never runs on Save. */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.IsSaved && !this.JournalEntryBatchNumber) {
      await this.assignJournalEntryBatchNumber();
    }
    // Approved auto-stamp: the approval-audit pair is an invariant of the TRANSITION, so the
    // entity fills it from context when the caller didn't — self-enforcing, not caller-supplied.
    const oldStatus = this.GetFieldByName('Status')?.OldValue as string | undefined;
    if (this.IsSaved && this.Status === 'Approved' && oldStatus !== 'Approved') {
      if (!this.ApprovedAt) this.ApprovedAt = new Date();
      if (!this.ApprovedByUserID && this.ContextCurrentUser) this.ApprovedByUserID = this.ContextCurrentUser.ID;
    }
    return super.Save(options);
  }

  /** Always-applies batch invariants: legal status transitions + approval-audit pairing. */
  public override Validate(): ValidationResult {
    const result = super.Validate();

    if (!this.IsSaved) {
      // A batch is born Pending — no path creates it mid-lifecycle.
      if (this.Status && this.Status !== 'Pending') {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryBatchEntityServer.Validate',
            `A new batch must start at Status='Pending' (got '${this.Status}') — lifecycle transitions happen through the batching process.`,
            null,
          ),
        );
      }
    } else {
      const oldStatus = this.GetFieldByName('Status')?.OldValue as string | undefined;
      if (oldStatus && this.Status !== oldStatus && !(LEGAL_TRANSITIONS[oldStatus] ?? []).includes(this.Status)) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryBatchEntityServer.Validate',
            `Illegal batch status transition '${oldStatus}' → '${this.Status}'. Legal from '${oldStatus}': ${(LEGAL_TRANSITIONS[oldStatus] ?? []).filter(s => s !== oldStatus).join(', ') || '(terminal)'}.`,
            null,
          ),
        );
      }
    }

    // Approval audit pair: an Approved batch carries WHO and WHEN, together.
    if (this.Status === 'Approved' && (!this.ApprovedAt || !this.ApprovedByUserID)) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryBatchEntityServer.Validate',
          `An Approved batch must carry both ApprovedAt and ApprovedByUserID.`,
          null,
        ),
      );
    }

    return result;
  }

  /**
   * Cross-record coherence, checked at the moment the numbers become load-bearing: on the
   * Pending→Approved transition, TotalDebits/TotalCredits must foot against the summary JE's
   * lines and TotalEntries must equal the locked member count. The approver is signing these
   * control totals — a build-time drift (or a direct edit while Pending) must not survive into
   * an approval. Not checked on every Pending save (totals are legitimately in flux mid-build).
   */
  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();
    const oldStatus = this.GetFieldByName('Status')?.OldValue as string | undefined;
    const approving = this.IsSaved && this.Status === 'Approved' && oldStatus === 'Pending';
    if (!approving) return result;

    for (const message of await this.CheckControlTotalCoherence()) {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('JournalEntryBatchEntityServer.ValidateAsync', message, null));
    }

    return result;
  }

  /**
   * The control-total coherence check, shared by the Pending→Approved validation above AND the
   * engine's dispatch (`sendJournalEntryBatch` re-runs it before Approved→Sent, so a member-set or
   * footing drift AFTER approval — however it got past the DB immutability trigger — can never be
   * dispatched as if the CFO had signed it). Returns human-readable problems; empty = coherent.
   * Reads force-refresh so a stale in-memory member/summary cache cannot vouch for the batch.
   */
  public async CheckControlTotalCoherence(contextUser?: UserInfo): Promise<string[]> {
    const problems: string[] = [];
    const summary = await this.LoadSummaryJournalEntry(true, contextUser);
    if (!summary) {
      problems.push('The batch has no summary journal entry — regenerate or cancel it.');
      return problems;
    }
    const rv = this.ProviderToUse as unknown as IRunViewProvider;
    const lineRes = await rv.RunView<{ DebitAmount: number | null; CreditAmount: number | null }>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${summary.ID}'`, Fields: ['DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
      contextUser ?? this.ContextCurrentUser,
    );
    if (!lineRes.Success) throw new Error(`JournalEntryBatchEntityServer: could not load summary lines for coherence check: ${lineRes.ErrorMessage ?? 'unknown'}`);
    let dr = 0, cr = 0;
    for (const l of lineRes.Results ?? []) { dr += l.DebitAmount ?? 0; cr += l.CreditAmount ?? 0; }
    if (Math.abs(dr - (this.TotalDebits ?? 0)) > FOOT_TOLERANCE || Math.abs(cr - (this.TotalCredits ?? 0)) > FOOT_TOLERANCE) {
      problems.push(`Control totals do not foot against the summary journal entry (batch says ${this.TotalDebits}/${this.TotalCredits}, summary lines sum ${dr.toFixed(2)}/${cr.toFixed(2)}). Regenerate the batch.`);
    }

    const members = await this.LoadMembers(true, contextUser);
    // The summary JE also carries this JournalEntryBatchID (it rides the member lock machinery) — exclude it.
    const memberCount = members.filter(m => m.ID.toLowerCase() !== summary.ID.toLowerCase()).length;
    if (memberCount !== (this.TotalEntries ?? 0)) {
      problems.push(`TotalEntries (${this.TotalEntries}) does not match the locked member count (${memberCount}). Regenerate the batch.`);
    }

    return problems;
  }

  // ─── owned collections (read-only hydration — JE.Lines-style) ─────────────

  /**
   * The journal entries locked to this batch (INCLUDING the JournalEntryBatchSummary JE, which carries the
   * JournalEntryBatchID so it rides the same lock machinery). Lazy; cached per instance; `forceRefresh` to
   * re-read. READ-ONLY by convention: mutating members happens through their own entities /
   * the engine — the batch never writes other aggregates outside its sanctioned lock-release.
   */
  public async LoadMembers(forceRefresh = false, _contextUser?: UserInfo): Promise<readonly mjBizAppsAccountingJournalEntryEntity[]> {
    await this.Members.Load(forceRefresh);
    return this.Members.Items;
  }

  /** The netted JournalEntryBatchSummary journal entry this batch points at (null when none, e.g. cancelled). */
  public async LoadSummaryJournalEntry(forceRefresh = false, contextUser?: UserInfo): Promise<mjBizAppsAccountingJournalEntryEntity | null> {
    if (this._summary !== undefined && !forceRefresh) return this._summary;
    if (!this.SummaryJournalEntryID) { this._summary = null; return null; }
    const md = this.ProviderToUse as unknown as IMetadataProvider;
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser ?? this.ContextCurrentUser);
    this._summary = (await je.Load(this.SummaryJournalEntryID)) ? je : null;
    return this._summary;
  }

  // ─── Cancel — the entity-owned reverse of a preliminary lock ───────────────

  /**
   * Reverse an unapproved (Pending) batch in ONE provider transaction: clear the summary pointer,
   * return every member JE to the candidate pool (the sanctioned reversible Batched→Pending +
   * JournalEntryBatchID→NULL unlock), delete the summary JE (lines first), and mark this batch Cancelled.
   * Valid ONLY while Status='Pending' — approval makes the lock permanent (plan §7.3).
   */
  public async Cancel(contextUser?: UserInfo): Promise<boolean> {
    if (!this.IsSaved) throw new Error('JournalEntryBatchEntityServer.Cancel: the batch must be saved.');
    if (this.Status !== 'Pending') {
      throw new Error(`JournalEntryBatchEntityServer.Cancel: batch ${this.JournalEntryBatchNumber} is ${this.Status}; only a Pending (unapproved) batch can be cancelled/reversed.`);
    }
    const user = contextUser ?? this.ContextCurrentUser;
    const dbProvider = this.ProviderToUse as unknown as DatabaseProviderBase;
    await dbProvider.BeginTransaction();
    try {
      await this.TearDownSummaryAndUnlock(user);
      this.Status = 'Cancelled';
      if (!(await this.Save())) throw new Error(`Cancel: Pending→Cancelled failed: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
      await dbProvider.CommitTransaction();
      return true;
    } catch (e) {
      try { await dbProvider.RollbackTransaction(); } catch { /* rollback best-effort */ }
      throw e;
    }
  }

  /**
   * Shared teardown for Cancel and the engine's regenerate (batch MUST still be Pending):
   * clear the summary pointer (so 50023 doesn't trip), unlock the members, delete the summary.
   * Owns NO transaction — the caller (Cancel, or regenerateJournalEntryBatch's rebuild transaction) does.
   */
  public async TearDownSummaryAndUnlock(contextUser?: UserInfo): Promise<void> {
    const user = contextUser ?? this.ContextCurrentUser;
    const summaryId = this.SummaryJournalEntryID;
    if (summaryId) {
      this.SummaryJournalEntryID = null;
      if (!(await this.Save())) throw new Error(`batch teardown: clearing SummaryJournalEntryID failed: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }

    // Release OUR locks: every Batched JE in the batch's orbit returns to Pending — INCLUDING the
    // summary JE, which must be unlocked BEFORE its lines can be deleted below (a line delete on a
    // still-Batched JE trips the 50006 lock trigger, whose ROLLBACK the provider transaction
    // machinery cannot survive — proven live 2026-07-29).
    const rv = this.ProviderToUse as unknown as IRunViewProvider;
    const md = this.ProviderToUse as unknown as IMetadataProvider;
    const res = await rv.RunView<{ ID: string }>(
      { EntityName: JE_ENTITY, ExtraFilter: `JournalEntryBatchID='${this.ID}' AND Status='Batched'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true },
      user,
    );
    if (!res.Success) throw new Error(`batch teardown: member scan failed: ${res.ErrorMessage ?? 'unknown'}`);
    for (const row of res.Results ?? []) {
      const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
      await je.Load(row.ID);
      je.Status = 'Pending';
      je.JournalEntryBatchID = null;
      if (!(await je.Save())) throw new Error(`batch teardown: JE ${row.ID} Batched→Pending failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }

    if (summaryId) {
      const lineRes = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
        { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${summaryId}'`, ResultType: 'entity_object', BypassCache: true },
        user,
      );
      if (!lineRes.Success) throw new Error(`batch teardown: summary line scan failed: ${lineRes.ErrorMessage ?? 'unknown'}`);
      for (const line of lineRes.Results ?? []) {
        if (!(await line.Delete())) throw new Error(`batch teardown: delete summary line ${line.ID} failed: ${line.LatestResult?.CompleteMessage ?? 'unknown'}`);
      }
      const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
      if (!(await je.Load(summaryId))) throw new Error(`batch teardown: summary JE ${summaryId} not found`);
      if (!(await je.Delete())) throw new Error(`batch teardown: delete summary JE failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }

    // Force the next read to go to the database: the teardown above deleted rows this collection may
    // be holding, and a stale member list is a batch claiming to lock entries that are gone.
    await this.Members.Load(true);
    this._summary = undefined;
  }

  private async assignJournalEntryBatchNumber(): Promise<void> {
    if (!this.ContextCurrentUser) {
      throw new Error('JournalEntryBatchEntityServer.assignJournalEntryBatchNumber: ContextCurrentUser is required');
    }
    const batchNumber = await getNextJournalEntryBatchNumber(
      this.ContextCurrentUser,
      this.ProviderToUse as unknown as IMetadataProvider,
    );
    this.JournalEntryBatchNumber = batchNumber;
  }
}
