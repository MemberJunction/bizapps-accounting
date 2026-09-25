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
 *   - The approved-content seal (#183): Pending→Approved writes `ApprovedContentHash`, a SHA-256 of
 *     what the approver signed; `CheckControlTotalCoherence` recomputes and compares it at dispatch.
 *   - `Cancel()`: reverse a Pending, Approved or Failed batch — delete the summary JE, return the
 *     member JEs to the candidate pool, mark Cancelled — in ONE provider transaction. The member
 *     unlock is the batch releasing ITS OWN locks (the reversible Batched→Pending transition the
 *     DB triggers sanction exactly for this), so it is legitimately batch-owned.
 *
 * WHAT DELIBERATELY STAYS IN THE ENGINE (multi-aggregate orchestration — JournalEntryBatchEngine.ts):
 *   build/regenerate (gather candidates → net → create summary → lock N independent JEs → raise
 *   the approval task) and dispatch (gate + ERP poster seam). Those compose MANY aggregates and
 *   run behind Remote Operations per the engine+transaction ruling (Marcelo 2026-07-21).
 */

import { createHash } from 'node:crypto';

import { BaseEntity, DatabaseProviderBase, EntitySaveOptions, IMetadataProvider, IRunViewProvider, LogStatus, UserInfo, ValidationErrorInfo, ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingJournalEntryBatchEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';

import { getNextJournalEntryBatchNumber } from './SequenceService.js';
import { sqlGuidLiteral } from './SqlGuards.js';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

/** Cent-level tolerance — amounts are decimal(18,2). */
const FOOT_TOLERANCE = 0.005;

/**
 * The legal batch status graph (plan §7): Pending → Approved | Cancelled · Approved → Sent |
 * Cancelled · Sent → Posted | Failed · Failed → Sent (retry) | Cancelled · Posted / Cancelled /
 * Archived are terminal. The DB immutability trigger freezes Approved/Sent/Posted/Failed/Archived
 * content but does not police the transition GRAPH itself — that is this entity's always-applies
 * invariant, so a direct client save can never jump Pending→Sent (skip approval) or resurrect a
 * terminal batch.
 *
 * `Archived` (golive #214) is the terminal state for a batch that must NEVER reach the ERP:
 * reachable from Pending, Approved and Failed, it makes no ERP call and — unlike Cancelled —
 * leaves the member entries locked at `Batched`. NOT reachable from `Sent`: a sent batch may
 * still be posting in the ERP, so its outcome is Posted or Failed, never an operator's choice.
 *
 * `Cancelled` from Approved or Failed (#183) is the correction path for a batch whose frozen
 * content is wrong: it releases the members back to the candidate pool so a new batch can be
 * built and approved. Not from `Sent`, for the same reason as Archived.
 */
const LEGAL_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  Pending: ['Pending', 'Approved', 'Cancelled', 'Archived'],
  Approved: ['Approved', 'Sent', 'Cancelled', 'Archived'],
  Sent: ['Sent', 'Posted', 'Failed'],
  Failed: ['Failed', 'Sent', 'Cancelled', 'Archived'],
  Posted: ['Posted'],
  Cancelled: ['Cancelled'],
  Archived: ['Archived'],
};

/** The statuses that may move to `target` — its incoming edges in LEGAL_TRANSITIONS. */
function legalFrom(target: string): string[] {
  return Object.entries(LEGAL_TRANSITIONS)
    .filter(([from, to]) => from !== target && to.includes(target))
    .map(([from]) => from);
}

/** The statuses an operator may archive from — the `→ Archived` edges of LEGAL_TRANSITIONS. */
const ARCHIVABLE_FROM = legalFrom('Archived');

/** The statuses a batch may be cancelled from — the `→ Cancelled` edges of LEGAL_TRANSITIONS. */
const CANCELLABLE_FROM = legalFrom('Cancelled');

/**
 * The `→ Cancelled` edges that only {@link JournalEntryBatchEntityServer.Cancel} may take. Cancelling
 * past approval must run the teardown, the ERP check and the approver's authorization together; a
 * plain save that sets Status would skip all three.
 */
const CANCEL_ONLY_FROM: ReadonlyArray<string> = ['Approved', 'Failed'];

/**
 * Options for {@link JournalEntryBatchEntityServer.Cancel}. Both matter only once the batch has
 * been approved; a Pending cancel (a CFO rejection) needs neither.
 */
export interface JournalEntryBatchCancelOptions {
  /** Why the batch is being cancelled. Required from Approved or Failed (CK_JournalEntryBatch_CancelAudit). */
  reason?: string | null;
  /**
   * Required `true` to cancel a Failed batch: the operator has checked the ERP and this batch's
   * number has NOT posted there. Cancel releases the members, the next build batches them again
   * under a NEW document number, and a journal that did post would then post twice. The attestation
   * is persisted (ERPNotPostedConfirmedAt / ERPNotPostedConfirmedByUserID).
   */
  confirmNotAlreadyPostedInERP?: boolean;
  /**
   * Runs inside Cancel's transaction, after the members are released — for work that must commit
   * or roll back with the cancel, such as recording it on the batch's approval Task.
   */
  onCancelled?: () => Promise<void>;
}

/** One summary line, as the footing check and the seal read it. */
interface SummaryLineContent {
  ID: string;
  GLAccountID: string;
  DebitAmount: number | null;
  CreditAmount: number | null;
}

/** One dimension tag on a summary line, as the seal reads it. */
interface SummaryLineDimensionContent {
  JournalEntryLineID: string;
  DimensionID: string;
  DimensionValueID: string;
}

/** Everything the approver signs, read from the database. */
interface ApprovedContent {
  summary: mjBizAppsAccountingJournalEntryEntity;
  lines: SummaryLineContent[];
  dimensions: SummaryLineDimensionContent[];
  /** Member entry IDs, lower-cased, EXCLUDING the summary entry. */
  memberIds: string[];
}

const lowerId = (id: string | null | undefined): string | null => id?.toLowerCase() ?? null;
const money = (amount: number | null | undefined): string => (amount ?? 0).toFixed(2);

@RegisterClass(BaseEntity, BATCH_ENTITY)
export class JournalEntryBatchEntityServer extends mjBizAppsAccountingJournalEntryBatchEntity {

  // `Members` is a READ-ONLY RelatedRecordCollection on the generated class now. It replaces
  // `_members`, a hand-rolled lazy cache with its own forceRefresh flag and its own invalidation —
  // which is `Load(force)` and `IsLoaded` written again, per aggregate. Read-only and OnRemove
  // 'refuse' make the comment this class already carried — "the batch never writes other aggregates"
  // — something the collection enforces rather than something a reader has to honour.
  private _summary: mjBizAppsAccountingJournalEntryEntity | null | undefined = undefined;

  /**
   * Set by {@link MarkBuiltByBatchingProcess}. Transient — never a field, never persisted; it
   * describes THIS in-memory instance's provenance, not the row.
   */
  private _builtByBatchingProcess = false;

  /**
   * Set only while {@link Cancel} is saving the cancel update. Transient, like
   * `_builtByBatchingProcess`: it is what lets the Approved/Failed → Cancelled edge through
   * {@link Validate}, so the generic form or the GraphQL update cannot take that edge on its own.
   */
  private _cancelling = false;

  /**
   * Declare that the batching process is creating this batch (golive #193).
   *
   * Build is the create verb for a batch: the header, its netted summary journal entry, the lock
   * on every member entry and the CFO approval task are one transaction, and a batch that skipped
   * it is a header with control totals someone typed and nothing underneath. Explorer's generic
   * New form offered exactly that, and the empty Pending batches it left behind were indistinguishable
   * from real ones until someone tried to dispatch them.
   *
   * Called at the engine's single create site. Anything else that saves a NEW batch is rejected by
   * {@link Validate} with a message naming where to go instead.
   */
  public MarkBuiltByBatchingProcess(): void {
    this._builtByBatchingProcess = true;
  }

  /** BaseEntity SKIPS ValidateAsync by default — opt in, or the coherence check never runs on Save. */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  /** The status this record was loaded with, before any unsaved change. */
  private get loadedStatus(): string | undefined {
    return this.GetFieldByName('Status')?.OldValue as string | undefined;
  }

  /** True while an unsaved Pending→Approved change is pending on this instance. */
  private get isApproving(): boolean {
    return this.IsSaved && this.Status === 'Approved' && this.loadedStatus === 'Pending';
  }

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.IsSaved && !this.JournalEntryBatchNumber) {
      await this.assignJournalEntryBatchNumber();
    }
    this.stampTransitionAudit();
    // The seal is written by the approval itself, never by a caller: whatever this field held
    // while the batch was Pending is overwritten with the hash of what is actually being approved.
    if (this.isApproving) {
      this.ApprovedContentHash = await this.ComputeApprovedContentHash();
    }
    return super.Save(options);
  }

  /**
   * WHO and WHEN belong to the transition, not the caller: the approval, archive and cancel audit
   * fields are filled from context when the caller didn't supply them.
   */
  private stampTransitionAudit(): void {
    if (!this.IsSaved || this.Status === this.loadedStatus) return;
    const userId = this.ContextCurrentUser?.ID;
    if (this.Status === 'Approved') {
      if (!this.ApprovedAt) this.ApprovedAt = new Date();
      if (!this.ApprovedByUserID && userId) this.ApprovedByUserID = userId;
    } else if (this.Status === 'Archived') {
      if (!this.ArchivedAt) this.ArchivedAt = new Date();
      if (!this.ArchivedByUserID && userId) this.ArchivedByUserID = userId;
    } else if (this.Status === 'Cancelled') {
      if (!this.CancelledAt) this.CancelledAt = new Date();
      if (!this.CancelledByUserID && userId) this.CancelledByUserID = userId;
    }
  }

  /** Always-applies batch invariants: legal status transitions + the audit fields each transition carries. */
  public override Validate(): ValidationResult {
    const result = super.Validate();
    const fail = (message: string) => {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('JournalEntryBatchEntityServer.Validate', message, null));
    };

    for (const message of this.IsSaved ? this.transitionProblems() : this.creationProblems()) fail(message);

    // Approval audit pair: an Approved batch carries WHO and WHEN, together.
    if (this.Status === 'Approved' && (!this.ApprovedAt || !this.ApprovedByUserID)) {
      fail(`An Approved batch must carry both ApprovedAt and ApprovedByUserID.`);
    }

    // Archive audit triple: an Archived batch says WHY it will never post, plus who and when.
    // Enforced at the DB too (CK_JournalEntryBatch_ArchiveAudit) — the reason is required by #214.
    if (this.Status === 'Archived' && (!this.ArchiveReason?.trim() || !this.ArchivedAt || !this.ArchivedByUserID)) {
      fail(`An Archived batch must carry a non-blank ArchiveReason plus ArchivedAt and ArchivedByUserID.`);
    }

    // Cancel audit triple, once the batch had been approved: cancelling then discards a summary
    // the approver signed, so it says why. Enforced at the DB too (CK_JournalEntryBatch_CancelAudit).
    if (this.Status === 'Cancelled' && this.ApprovedAt && (!this.CancelReason?.trim() || !this.CancelledAt || !this.CancelledByUserID)) {
      fail(`A batch cancelled after approval must carry a non-blank CancelReason plus CancelledAt and CancelledByUserID.`);
    }

    // ERP-check attestation, once the batch had been sent: it may already be in the ERP, and cancelling
    // releases its entries to post again. Enforced at the DB too (CK_JournalEntryBatch_CancelERPCheck).
    if (this.Status === 'Cancelled' && this.SentAt && (!this.ERPNotPostedConfirmedAt || !this.ERPNotPostedConfirmedByUserID)) {
      fail(`A batch cancelled after it was sent must carry ERPNotPostedConfirmedAt and ERPNotPostedConfirmedByUserID — the attestation that it had not posted in the ERP.`);
    }

    return result;
  }

  /** A NEW batch: built by the batching process, and born Pending. */
  private creationProblems(): string[] {
    const problems: string[] = [];
    // Build is the create verb — a batch is never a blank record someone fills in (#193).
    if (!this._builtByBatchingProcess) {
      problems.push(
        `A journal entry batch cannot be created directly — it is BUILT from pending journal entries, ` +
          `together with its netted summary entry, the lock on each member entry and the approval task. ` +
          `Use Build JE batch on the Accounting app's Batches page.`,
      );
    }
    // A batch is born Pending — no path creates it mid-lifecycle.
    if (this.Status && this.Status !== 'Pending') {
      problems.push(`A new batch must start at Status='Pending' (got '${this.Status}') — lifecycle transitions happen through the batching process.`);
    }
    return problems;
  }

  /**
   * A SAVED batch: the status change, if any, is an edge of LEGAL_TRANSITIONS — and a cancel past
   * approval comes through {@link Cancel}, never a plain save.
   */
  private transitionProblems(): string[] {
    const oldStatus = this.loadedStatus;
    if (!oldStatus || this.Status === oldStatus) return [];
    if (!(LEGAL_TRANSITIONS[oldStatus] ?? []).includes(this.Status)) {
      const legal = (LEGAL_TRANSITIONS[oldStatus] ?? []).filter(s => s !== oldStatus).join(', ') || '(terminal)';
      return [`Illegal batch status transition '${oldStatus}' → '${this.Status}'. Legal from '${oldStatus}': ${legal}.`];
    }
    if (this.Status === 'Cancelled' && CANCEL_ONLY_FROM.includes(oldStatus) && !this._cancelling) {
      return [
        `A ${oldStatus} batch is cancelled only through Cancel (the Cancel action), which releases its journal entries, ` +
          `deletes its summary and records who may cancel and why — setting Status directly would skip all of that.`,
      ];
    }
    return [];
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
    if (!this.isApproving) return result;

    for (const message of await this.CheckControlTotalCoherence()) {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('JournalEntryBatchEntityServer.ValidateAsync', message, null));
    }

    return result;
  }

  /**
   * The coherence check, shared by the Pending→Approved validation above AND the engine's dispatch
   * (`sendJournalEntryBatch` re-runs it before Approved|Failed→Sent). Returns human-readable
   * problems; empty = coherent. Reads force-refresh so a stale in-memory member/summary cache
   * cannot vouch for the batch.
   *
   * It checks that the batch agrees with itself — the control totals foot, the member count
   * matches, the summary entry carries the batch's date and company — and, once the batch has been
   * approved, that its content still hashes to the {@link ApprovedContentHash} written at approval.
   * The last is what makes it mean "unchanged since approval" rather than "coherent right now".
   */
  public async CheckControlTotalCoherence(contextUser?: UserInfo): Promise<string[]> {
    const content = await this.loadApprovedContent(contextUser);
    if (!content) return ['The batch has no summary journal entry — regenerate or cancel it.'];
    return [
      ...this.footingProblems(content.lines),
      ...this.memberCountProblems(content.memberIds),
      ...this.summaryHeaderProblems(content.summary),
      ...this.sealProblems(content),
    ];
  }

  private footingProblems(lines: SummaryLineContent[]): string[] {
    let dr = 0, cr = 0;
    for (const l of lines) { dr += l.DebitAmount ?? 0; cr += l.CreditAmount ?? 0; }
    if (Math.abs(dr - (this.TotalDebits ?? 0)) <= FOOT_TOLERANCE && Math.abs(cr - (this.TotalCredits ?? 0)) <= FOOT_TOLERANCE) return [];
    return [`Control totals do not foot against the summary journal entry (batch says ${this.TotalDebits}/${this.TotalCredits}, summary lines sum ${dr.toFixed(2)}/${cr.toFixed(2)}). Regenerate the batch.`];
  }

  private memberCountProblems(memberIds: string[]): string[] {
    if (memberIds.length === (this.TotalEntries ?? 0)) return [];
    return [`TotalEntries (${this.TotalEntries}) does not match the locked member count (${memberIds.length}). Regenerate the batch.`];
  }

  /**
   * The ERP receives the batch's PostingDate as the journal date, while the subledger records the
   * summary entry's EffectiveDate. Both are set from the same value at build; a batch whose header
   * has moved away from its summary would post to one period and record another.
   */
  private summaryHeaderProblems(summary: mjBizAppsAccountingJournalEntryEntity): string[] {
    const problems: string[] = [];
    const postingDay = ToCalendarDay(this.PostingDate);
    const summaryDay = ToCalendarDay(summary.EffectiveDate);
    if (postingDay !== summaryDay) {
      problems.push(`The batch posts on ${postingDay} but its summary journal entry is dated ${summaryDay}. Regenerate or cancel the batch.`);
    }
    if (lowerId(summary.CompanyID) !== lowerId(this.CompanyID)) {
      problems.push(`The batch's company does not match its summary journal entry's company. Regenerate or cancel the batch.`);
    }
    return problems;
  }

  /**
   * Compare the content now with the seal written at approval. Skipped while this save IS the
   * approval (the seal is being written by it), and for a batch approved before the seal existed,
   * which has none to compare against — the other checks still run for it.
   */
  private sealProblems(content: ApprovedContent): string[] {
    if (this.isApproving || this.Status === 'Pending') return [];
    if (!this.ApprovedContentHash) {
      LogStatus(`JournalEntryBatchEntityServer: batch ${this.JournalEntryBatchNumber} was approved before the approved-content seal existed; checking control totals, member count and summary header only.`);
      return [];
    }
    if (this.hashContent(content) === this.ApprovedContentHash) return [];
    return [`Batch ${this.JournalEntryBatchNumber} no longer matches the content that was approved — its header, summary entry, summary lines or member set changed after approval. Cancel it and build a new batch.`];
  }

  /**
   * The approved-content seal: a SHA-256 over the batch header fields the ERP post depends on, the
   * summary entry's company and date, every summary line with its dimension tags, and the member
   * set. Written on Pending→Approved by {@link Save}. Null when there is no summary to seal — the
   * approval's coherence check then refuses the save.
   *
   * Lines are sealed by GLAccountID, not by the ERP account number the poster sends. That is enough
   * while a GL account's ERP mapping cannot change under a batch; if it becomes editable, the number
   * sent should be sealed too.
   */
  public async ComputeApprovedContentHash(contextUser?: UserInfo): Promise<string | null> {
    const content = await this.loadApprovedContent(contextUser);
    return content ? this.hashContent(content) : null;
  }

  /**
   * A canonical serialisation of the approved content, then its hex SHA-256. Arrays with a fixed
   * field order (not objects) and sorted collections (ordinal, not locale, comparison), lower-cased
   * IDs, two-decimal amounts and calendar days, so the same content always yields the same string
   * whatever order the database returned it in.
   */
  private hashContent(content: ApprovedContent): string {
    const tagsByLine = new Map<string, string[]>();
    for (const d of content.dimensions) {
      const key = lowerId(d.JournalEntryLineID) ?? '';
      tagsByLine.set(key, [...(tagsByLine.get(key) ?? []), `${lowerId(d.DimensionID)}:${lowerId(d.DimensionValueID)}`]);
    }
    const lines = content.lines
      .map(l => [lowerId(l.ID) ?? '', lowerId(l.GLAccountID), money(l.DebitAmount), money(l.CreditAmount), (tagsByLine.get(lowerId(l.ID) ?? '') ?? []).sort()] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const canonical = JSON.stringify([
      [lowerId(this.ID), lowerId(this.CompanyID), ToCalendarDay(this.PostingDate), lowerId(this.SummaryJournalEntryID), this.TargetSystem, this.TotalEntries, money(this.TotalDebits), money(this.TotalCredits)],
      [lowerId(content.summary.ID), lowerId(content.summary.CompanyID), ToCalendarDay(content.summary.EffectiveDate)],
      lines,
      [...content.memberIds].sort(),
    ]);
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /** Read everything the approver signs, fresh from the database. Null when there is no summary entry. */
  private async loadApprovedContent(contextUser?: UserInfo): Promise<ApprovedContent | null> {
    const user = contextUser ?? this.ContextCurrentUser;
    const summary = await this.LoadSummaryJournalEntry(true, user);
    if (!summary) return null;
    const [{ lines, dimensions }, members] = await Promise.all([
      this.loadSummaryLines(summary.ID, user),
      this.LoadMembers(true, user),
    ]);
    // The summary JE also carries this JournalEntryBatchID (it rides the member lock machinery) — exclude it.
    const summaryId = lowerId(summary.ID);
    const memberIds = members.map(m => lowerId(m.ID) ?? '').filter(id => id !== summaryId);
    return { summary, lines, dimensions, memberIds };
  }

  /** The summary's lines, then their dimension tags filtered by the line IDs just read (no subquery, so it runs on any provider). */
  private async loadSummaryLines(summaryId: string, user: UserInfo | undefined): Promise<{ lines: SummaryLineContent[]; dimensions: SummaryLineDimensionContent[] }> {
    const rv = this.ProviderToUse as unknown as IRunViewProvider;
    const lineRes = await rv.RunView<SummaryLineContent>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID=${sqlGuidLiteral(summaryId, 'summary journal entry')}`, Fields: ['ID', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple', BypassCache: true },
      user,
    );
    if (!lineRes.Success) throw new Error(`JournalEntryBatchEntityServer: could not load summary lines: ${lineRes.ErrorMessage ?? 'unknown'}`);
    const lines = lineRes.Results ?? [];
    if (lines.length === 0) return { lines, dimensions: [] };

    const lineIds = lines.map(l => sqlGuidLiteral(l.ID, 'summary journal entry line')).join(', ');
    const dimRes = await rv.RunView<SummaryLineDimensionContent>(
      { EntityName: JELD_ENTITY, ExtraFilter: `JournalEntryLineID IN (${lineIds})`, Fields: ['JournalEntryLineID', 'DimensionID', 'DimensionValueID'], ResultType: 'simple', BypassCache: true },
      user,
    );
    if (!dimRes.Success) throw new Error(`JournalEntryBatchEntityServer: could not load summary line dimensions: ${dimRes.ErrorMessage ?? 'unknown'}`);
    return { lines, dimensions: dimRes.Results ?? [] };
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

  // ─── Cancel — the entity-owned reverse of the batch's lock ─────────────────

  /**
   * Reverse a Pending, Approved or Failed batch in ONE provider transaction: mark it Cancelled and
   * clear its summary pointer in one save, then return every member JE to the candidate pool (the
   * sanctioned Batched→Pending + JournalEntryBatchID→NULL unlock) and delete the summary JE.
   *
   * The status changes FIRST because that is what the triggers key on: trg_JournalEntry_Immutability
   * releases a member only while its batch is Pending or Cancelled, and
   * trg_JournalEntryBatch_Immutability lets an Approved or Failed batch clear its summary pointer only
   * in the update that cancels it.
   *
   * From Approved or Failed a reason is required, since the cancel discards a summary the approver
   * signed. From Failed the caller must also confirm the batch has not posted in the ERP (see
   * {@link JournalEntryBatchCancelOptions.confirmNotAlreadyPostedInERP}). WHO may cancel past approval
   * is the engine's check (cancelJournalEntryBatch), which knows the approver; this method is the
   * mechanics. If anything fails the transaction rolls back and the instance is reloaded, so it never
   * claims a Cancelled state the database does not hold.
   */
  public async Cancel(contextUser?: UserInfo, options: JournalEntryBatchCancelOptions = {}): Promise<boolean> {
    if (!this.IsSaved) throw new Error('JournalEntryBatchEntityServer.Cancel: the batch must be saved.');
    this.assertCancellable(options);
    const user = contextUser ?? this.ContextCurrentUser;
    const summaryId = this.SummaryJournalEntryID;
    const dbProvider = this.ProviderToUse as unknown as DatabaseProviderBase;
    await dbProvider.BeginTransaction();
    try {
      await this.markCancelled(options, user);
      await this.ReleaseMembersAndDeleteSummary(summaryId, user);
      if (options.onCancelled) await options.onCancelled();
      await dbProvider.CommitTransaction();
      return true;
    } catch (e) {
      try { await dbProvider.RollbackTransaction(); } catch { /* rollback best-effort */ }
      await this.reloadAfterRollback();
      throw e;
    }
  }

  /** Put the instance back to what the database holds after a rolled-back Cancel. Best-effort: the original error is what the caller needs. */
  private async reloadAfterRollback(): Promise<void> {
    try {
      await this.Load(this.ID);
    } catch {
      /* the rollback is authoritative; a failed reload leaves a stale instance, never a wrong database */
    }
    this._summary = undefined;
  }

  private assertCancellable(options: JournalEntryBatchCancelOptions): void {
    const label = this.JournalEntryBatchNumber ?? this.ID;
    if (!CANCELLABLE_FROM.includes(this.Status)) {
      throw new Error(`JournalEntryBatchEntityServer.Cancel: batch ${label} is ${this.Status}; only a ${CANCELLABLE_FROM.join(' / ')} batch can be cancelled.`);
    }
    if (this.Status !== 'Pending' && !options.reason?.trim()) {
      throw new Error(`JournalEntryBatchEntityServer.Cancel: batch ${label} is ${this.Status}; cancelling it discards an approved summary, so a reason is required.`);
    }
    if (this.Status === 'Failed' && options.confirmNotAlreadyPostedInERP !== true) {
      throw new Error(
        `JournalEntryBatchEntityServer.Cancel: batch ${label} is Failed, and a Failed batch may already be in the ERP. ` +
          `Confirm in the ERP that document ${label} has not posted, then cancel with that confirmation — otherwise its entries would post again in the next batch.`,
      );
    }
  }

  /**
   * The single update that commits the batch to cancelling: status, cleared summary pointer, the
   * audit triple and — for a batch that had been sent — the ERP-check attestation.
   */
  private async markCancelled(options: JournalEntryBatchCancelOptions, user: UserInfo | undefined): Promise<void> {
    const fromStatus = this.Status;
    const now = new Date();
    this.SummaryJournalEntryID = null;
    this.CancelReason = options.reason?.trim() || null;
    this.CancelledAt = now;
    this.CancelledByUserID = user?.ID ?? null;
    if (this.SentAt && options.confirmNotAlreadyPostedInERP === true) {
      this.ERPNotPostedConfirmedAt = now;
      this.ERPNotPostedConfirmedByUserID = user?.ID ?? null;
    }
    this.Status = 'Cancelled';
    this._cancelling = true;
    try {
      if (!(await this.Save())) throw new Error(`Cancel: ${fromStatus}→Cancelled failed: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
    } finally {
      this._cancelling = false;
    }
  }

  /**
   * Close a batch that must NEVER reach the ERP (golive #214): mark it Archived with a required
   * reason, and leave everything else exactly where it is. Legal from Pending, Approved and Failed.
   *
   * The contrast with `Cancel()` is the whole point and is load-bearing: Cancel RELEASES the member
   * entries back to the candidate pool, so the nightly/monthly runs pick them up again. Archive must
   * NOT — the entries stay at `Batched` with their JournalEntryBatchID, which keeps them out of every
   * candidate pool (those filter `Status='Pending'`) and, once this save lands, out of reach of
   * trg_JournalEntry_Immutability's unlock (it sanctions Batched→Pending only while the owning batch
   * is Pending or Cancelled). No teardown means no transaction: this is a single-row update.
   */
  public async Archive(reason: string, contextUser?: UserInfo): Promise<boolean> {
    if (!this.IsSaved) throw new Error('JournalEntryBatchEntityServer.Archive: the batch must be saved.');
    if (!ARCHIVABLE_FROM.includes(this.Status)) {
      throw new Error(`JournalEntryBatchEntityServer.Archive: batch ${this.JournalEntryBatchNumber} is ${this.Status}; only a ${ARCHIVABLE_FROM.join(' / ')} batch can be archived.`);
    }
    if (!reason?.trim()) {
      throw new Error(`JournalEntryBatchEntityServer.Archive: an archive reason is required — it is the only record of why batch ${this.JournalEntryBatchNumber} will never post.`);
    }
    this.ArchiveReason = reason.trim();
    this.ArchivedAt = new Date();
    this.ArchivedByUserID = (contextUser ?? this.ContextCurrentUser)?.ID ?? null;
    this.Status = 'Archived';
    if (!(await this.Save())) throw new Error(`Archive: →Archived failed: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
    return true;
  }

  /**
   * Teardown for the engine's regenerate (batch MUST still be Pending): clear the summary pointer
   * (so 50023 doesn't trip), unlock the members, delete the summary. The batch stays Pending.
   * Owns NO transaction — regenerateJournalEntryBatch's rebuild transaction does.
   */
  public async TearDownSummaryAndUnlock(contextUser?: UserInfo): Promise<void> {
    const user = contextUser ?? this.ContextCurrentUser;
    const summaryId = this.SummaryJournalEntryID;
    if (summaryId) {
      this.SummaryJournalEntryID = null;
      if (!(await this.Save())) throw new Error(`batch teardown: clearing SummaryJournalEntryID failed: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    await this.ReleaseMembersAndDeleteSummary(summaryId, user);
  }

  /**
   * Release OUR locks and remove the summary: every Batched JE in the batch's orbit returns to
   * Pending — INCLUDING the summary JE, which must be unlocked BEFORE its lines can be deleted (a
   * line delete on a still-Batched JE trips the 50006 lock trigger, whose ROLLBACK the provider
   * transaction machinery cannot survive — proven live 2026-07-29). The batch must already be
   * Pending or Cancelled, with its summary pointer cleared; owns NO transaction.
   */
  public async ReleaseMembersAndDeleteSummary(summaryId: string | null, contextUser?: UserInfo): Promise<void> {
    const user = contextUser ?? this.ContextCurrentUser;
    await this.releaseMembers(user);
    if (summaryId) await this.deleteSummary(summaryId, user);

    // Force the next read to go to the database: the teardown above deleted rows this collection may
    // be holding, and a stale member list is a batch claiming to lock entries that are gone.
    await this.Members.Load(true);
    this._summary = undefined;
  }

  private async releaseMembers(user: UserInfo | undefined): Promise<void> {
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
  }

  private async deleteSummary(summaryId: string, user: UserInfo | undefined): Promise<void> {
    const rv = this.ProviderToUse as unknown as IRunViewProvider;
    const md = this.ProviderToUse as unknown as IMetadataProvider;
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
