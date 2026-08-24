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
 *   - `Approve()`: the CFO sign-off — record the decision on the approval Task AND flip this batch
 *     Pending→Approved — in ONE provider transaction, so the two halves can never come apart.
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

import { IsApprovalOutcome, type TaskDecisionOutcomeCode } from '@mj-biz-apps/tasks-core';

import { getNextJournalEntryBatchNumber } from './SequenceService.js';
// Type-only: the gate is a SEAM the caller supplies, never a concrete gate this entity constructs.
// (Type-only also keeps the engine→entity value import from becoming a runtime cycle.)
import type { JournalEntryBatchApprovalGate } from './JournalEntryBatchEngine.js';

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

    const fail = (message: string) => {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('JournalEntryBatchEntityServer.ValidateAsync', message, null));
    };

    const summary = await this.LoadSummaryJournalEntry();
    if (!summary) {
      fail('Cannot approve a batch with no summary journal entry — regenerate or cancel it.');
      return result;
    }
    const rv = this.ProviderToUse as unknown as IRunViewProvider;
    const lineRes = await rv.RunView<{ DebitAmount: number | null; CreditAmount: number | null }>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${summary.ID}'`, Fields: ['DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
      this.ContextCurrentUser,
    );
    if (!lineRes.Success) throw new Error(`JournalEntryBatchEntityServer: could not load summary lines for coherence check: ${lineRes.ErrorMessage ?? 'unknown'}`);
    let dr = 0, cr = 0;
    for (const l of lineRes.Results ?? []) { dr += l.DebitAmount ?? 0; cr += l.CreditAmount ?? 0; }
    if (Math.abs(dr - (this.TotalDebits ?? 0)) > FOOT_TOLERANCE || Math.abs(cr - (this.TotalCredits ?? 0)) > FOOT_TOLERANCE) {
      fail(`Control totals do not foot against the summary journal entry (batch says ${this.TotalDebits}/${this.TotalCredits}, summary lines sum ${dr.toFixed(2)}/${cr.toFixed(2)}). Regenerate the batch.`);
    }

    const members = await this.LoadMembers();
    // The summary JE also carries this JournalEntryBatchID (it rides the member lock machinery) — exclude it.
    const memberCount = members.filter(m => m.ID.toLowerCase() !== summary.ID.toLowerCase()).length;
    if (memberCount !== (this.TotalEntries ?? 0)) {
      fail(`TotalEntries (${this.TotalEntries}) does not match the locked member count (${memberCount}). Regenerate the batch.`);
    }

    return result;
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

  // ─── Approve — the two halves of a sign-off, atomically ───────────────────

  /**
   * The CFO sign-off, in ONE provider transaction: record the terminal decision against the batch's
   * approval Task (through the gate) AND flip this batch Pending→Approved. Returns true on success.
   *
   * WHY IT LIVES HERE: approving is two writes that were never coupled — `gate.recordDecision(...)`
   * (what `assertApproved` reads) and the batch's own Status (what `sendJournalEntryBatch` reads).
   * Nothing implied the other, so BOTH half-approved states were reachable and both were hit in
   * practice: Approved-with-no-decision (send clears its status check, then the gate throws) and
   * decision-recorded-while-Pending (the gate is satisfied, then send throws on the status). Both
   * refusals are correct; the batch simply sat half-approved until someone ran the missing half by
   * hand. One transaction removes the state rather than teaching every caller to do both.
   *
   * The gate is a PARAMETER, not a field: `sendJournalEntryBatch` already treats it as a seam
   * (`options.gate`), and constructing a concrete gate in here would couple this accounting entity
   * to the Tasks app. The gate's own writes ride this transaction — its reads see the uncommitted
   * Task on the same provider — so a failure in EITHER half rolls back BOTH.
   *
   * NOT in scope (deliberately, and separately analysed): concurrency. Two approvers racing will
   * still both succeed — the read-then-write underneath has no atomic guard. This closes the
   * half-approved hole, not the double-approve one.
   */
  public async Approve(
    outcome: TaskDecisionOutcomeCode,
    decidedByPersonId: string | undefined,
    notes: string | undefined,
    gate: JournalEntryBatchApprovalGate,
    contextUser?: UserInfo,
  ): Promise<boolean> {
    this.assertApprovable(outcome);
    const user = contextUser ?? this.ContextCurrentUser;
    // Required, not optional: the gate reads the Task on this user's behalf and the approval is
    // audited to them. Undefined here would surface much later as an unattributed gate query.
    if (!user) throw new Error('JournalEntryBatchEntityServer.Approve: a context user is required.');
    const dbProvider = this.ProviderToUse as unknown as DatabaseProviderBase;
    await dbProvider.BeginTransaction();
    try {
      // Decision first: it is the half that can legitimately refuse (no approval Task on the batch),
      // and refusing before the status write keeps the failure cheap.
      await gate.recordDecision(this.ID, outcome, decidedByPersonId, notes, user);
      this.Status = 'Approved';
      // Save() stamps ApprovedAt and (from ContextCurrentUser) ApprovedByUserID; fill the approver
      // from the user this call was given, so an entity without a context user still audits.
      if (!this.ApprovedByUserID) this.ApprovedByUserID = user.ID;
      if (!(await this.Save())) throw new Error(`Approve: Pending→Approved failed: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
      await dbProvider.CommitTransaction();
      return true;
    } catch (e) {
      try { await dbProvider.RollbackTransaction(); } catch { /* rollback best-effort */ }
      throw e;
    }
  }

  /**
   * Pre-transaction guards for `Approve`. The outcome check is the load-bearing one: the parameter
   * is the WHOLE TaskDecisionOutcomeCode union (ApprovedWithConditions approves too), so a
   * rejection code would otherwise record a rejection and flip the batch to Approved. `IsApprovalOutcome`
   * asks tasks-core what the code MEANS instead of re-deciding it here from literals.
   *
   * The Pending check is the precondition `approveJournalEntryBatch` already enforced — kept so this
   * is a like-for-like replacement, not a widening. It is NOT a concurrency guard (two racing
   * approvers both read Pending and both pass); that hole is deferred and analysed separately.
   */
  private assertApprovable(outcome: TaskDecisionOutcomeCode): void {
    if (!this.IsSaved) throw new Error('JournalEntryBatchEntityServer.Approve: the batch must be saved.');
    if (!IsApprovalOutcome(outcome)) {
      throw new Error(`JournalEntryBatchEntityServer.Approve: '${outcome}' is not an approval outcome — Approve() only records a decision that approves. Reject through the decision/cancel path.`);
    }
    if (this.Status !== 'Pending') {
      throw new Error(`JournalEntryBatchEntityServer.Approve: batch ${this.JournalEntryBatchNumber} is ${this.Status}; only a Pending batch can be approved.`);
    }
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
