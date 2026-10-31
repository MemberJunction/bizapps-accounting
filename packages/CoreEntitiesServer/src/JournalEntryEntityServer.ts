/**
 * Server-side subclass of JournalEntry — Block 0 + Block 1 lifecycle hooks.
 *
 *   Extended Server subclass adding visibility of child lines (`Lines` property),
 *   in-memory and async validation overrides for accounting invariants,
 *   automatic line persistence on Save(), line hydration on Load(), and lifecycle hooks:
 *
 *   - Line Visibility: `je.Lines` holds 0+ `JournalEntryLineEntityServer` instances.
 *   - Invariants Validated:
 *       1. At least 2 line items (double-entry requirement).
 *       2. Balanced overall debits and credits (SUM(Debits) === SUM(Credits) exactly).
 *       3. Single-company isolation (All line GLAccounts must match header CompanyID).
 *       4. Active GL Accounts (All line GLAccounts must be IsActive = 1).
 *       5. Reversal consistency (JournalEntryType Code='Reversal' <-> ReversesJournalEntryID —
 *          async, issue #24: the code lives on the type row the FK points at).
 *   - W6 (Block 1) GenerateReversal: create a new Pending JE with Dr/Cr swapped.
 *   - W9 (Block 1) attachment validation: a non-null FileID must reference an existing __mj.File.
 *   - Manual-entry approval (golive #353): a manual entry saved while its company has a
 *     ManualJournalEntryApprovalThreshold is routed for approval and its Task raised in the same
 *     transaction; see ManualJournalEntryApproval.ts.
 */

import {
  BaseEntity,
  DatabaseProviderBase,
  EntityDeleteOptions,
  EntitySaveOptions,
  IMetadataProvider,
  IRunViewProvider,
  LogError,
  UserInfo,
  ValidationErrorInfo,
  ValidationResult,
} from '@memberjunction/core';
import { EscapeSQLString, RegisterClass, UUIDsEqual } from '@memberjunction/global';
import {
  mjBizAppsAccountingJournalEntryEntity,
  JournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';

import { AccountingEngineBase, FiscalYearOf } from '@mj-biz-apps/accounting-engine-base';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';

import { JournalEntryLineEntityServer } from './JournalEntryLineEntityServer.js';
import { laterBusinessDate, loadTodayBusiness } from './BusinessDay.js';
import { LookupJournalEntryTypeByID, RequireJournalEntryTypeID } from './JournalEntryTypes.js';
import {
  IsManualJournalEntry,
  ManualJournalEntryApprovalError,
  ManualJournalEntryApprovalService,
  type ManualJournalEntrySaveAction,
} from './ManualJournalEntryApproval.js';
import { getNextJournalEntryNumber } from './SequenceService.js';
import { isSqlGuid, sqlGuidLiteral } from './SqlGuards.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const FILE_ENTITY = 'Files'; // __mj.File

/**
 * The manual-entry approval columns (golive #353). Every layer of the approval gate — the batch
 * candidate filter, the explicit-ID refusal, the view drop and CK_JournalEntry_ApprovedBeforeBatch —
 * reads them, so no ordinary save may write them: only this entity's own approval routing (all five)
 * and the decision path (`SaveApprovalStamp`, the two stamp columns). trg_JournalEntry_ApprovalIntegrity
 * is the database floor under this rule.
 */
const APPROVAL_FIELDS = ['ApprovalLevel', 'ApprovalRequestedByUserID', 'ApprovalTaskID', 'ApprovedAt', 'ApprovedByUserID'] as const;
type ApprovalField = (typeof APPROVAL_FIELDS)[number];
const APPROVAL_STAMP_FIELDS: ReadonlySet<ApprovalField> = new Set<ApprovalField>(['ApprovedAt', 'ApprovedByUserID']);
const ALL_APPROVAL_FIELDS: ReadonlySet<ApprovalField> = new Set<ApprovalField>(APPROVAL_FIELDS);
const NO_APPROVAL_FIELDS: ReadonlySet<ApprovalField> = new Set<ApprovalField>();

/** The D25 origin pair. It decides whether an entry is manual, so it is fixed once the entry exists. */
const ORIGIN_PAIR_FIELDS = ['LinkedEntityID', 'LinkedRecordID'] as const;

/**
 * The legal JE status graph (plan §7 + the DB triggers' sanctioned carve-outs):
 *   Pending → Batched (the batch build's lock) · Batched → GLPosted (the batch DISPATCH — see the
 *   owning-batch check in ValidateAsync) · Batched → Pending (the reversible unlock the immutability
 *   trigger sanctions: JournalEntryBatchID cleared while the owning batch is Pending or Cancelled —
 *   the batch-side condition stays DB-enforced, 50004/50005; an Approved or Failed batch reaches
 *   Cancelled only through JournalEntryBatchEntityServer.Cancel, #183) · GLPosted is terminal.
 * The DB triggers freeze a LOCKED row but do not police a Pending row's transitions at all — without
 * this graph a direct client save could jump Pending→GLPosted with forged GLPostedAt/GLReferenceID
 * and the entry would look ERP-posted without ever being batched, approved, or dispatched.
 */
const JE_LEGAL_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  Pending: ['Pending', 'Batched'],
  Batched: ['Batched', 'GLPosted', 'Pending'],
  GLPosted: ['GLPosted'],
};

@RegisterClass(BaseEntity, JE_ENTITY)
export class JournalEntryEntityServer extends JournalEntryEntity {
  // `_lines` and `_deletedLines` are gone. `Lines` is a RelatedRecordCollection on the GENERATED
  // class, emitted from the RelatedRecordCollection metadata on the
  // 'Journal Entries -> Journal Entry Lines' relationship, so it exists on BOTH tiers — which is
  // what lets the browser compose an entry it previously had no type for. The collection also
  // tracks removals itself (OnRemove: 'delete'), which is what `_deletedLines` was for.

  /**
   * BaseEntity SKIPS ValidateAsync by default (DefaultSkipAsyncValidation = true) — opt in, or
   * the async invariants below (W9 attachment check, GL active/company alignment) silently
   * never run on Save. (Found via the live harness's GLAccount identity-lock test.)
   */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  /**
   * The approval columns the save in progress may write. Empty outside this entity's own approval
   * routing and `SaveApprovalStamp`, so a client save that types into them is refused by Validate.
   */
  private writableApprovalFields: ReadonlySet<ApprovalField> = NO_APPROVAL_FIELDS;

  // ─── Line Collection ─────────────────────────────────────────────────────────

  /**
   * Appends a line and sets the back-reference its own validation needs.
   *
   * A thin wrapper over `Lines.Add()` now. It survives because `ParentJournalEntry` does NOT come
   * from the collection: `JournalEntryLineEntityServer.ValidateAsync` reads it to enforce the
   * single-company isolation rule (D3), and a line added straight through `Lines.Add()` would have
   * it undefined — so the GL-account company check would silently pass on every line.
   *
   * `Lines.Add()` stamps JournalEntryID and the LineNumber sequence, so neither is done here.
   */
  public AddLine(line: JournalEntryLineEntityServer): void {
    if (!line) return;
    line.ParentJournalEntry = this;
    this.Lines.Add(line);
  }

  /**
   * Removes a line by instance or index.
   *
   * `Lines.Remove()` does everything the hand-rolled version did: it queues a persisted line for
   * deletion (OnRemove: 'delete' — what `_deletedLines` tracked) and re-applies the LineNumber
   * sequence so the survivors stay gap-free, which
   * `UQ_JournalEntryLine_JE_LineNumber` requires.
   */
  public RemoveLine(lineOrIndex: JournalEntryLineEntityServer | number): void {
    this.Lines.Remove(lineOrIndex as never);
  }

  /** Instantiates a new line, attaches it to this JE, and returns it. */
  public async CreateLine(user?: UserInfo): Promise<JournalEntryLineEntityServer> {
    const provider = this.ProviderToUse as unknown as IMetadataProvider;
    const line = await provider.GetEntityObject<JournalEntryLineEntityServer>(
      JEL_ENTITY,
      user ?? this.ContextCurrentUser,
    );
    line.NewRecord();
    this.AddLine(line);
    return line;
  }

  /**
   * Loads the lines (and their dimension tags — ONE bulk query) for a saved Journal Entry.
   *
   * `Lines.Load()` does the query now, with the OrderBy the metadata declares. What stays here is
   * everything the collection does not know about: the `ParentJournalEntry` back-reference each
   * line's own validation reads for the single-company rule (D3), and the bulk dimension hydration
   * that exists so N lines cost ONE dimension query instead of N.
   */
  public async LoadLines(user?: UserInfo): Promise<JournalEntryLineEntityServer[]> {
    if (!this.IsSaved || !this.ID) {
      return this.Lines.Items as JournalEntryLineEntityServer[];
    }
    // force: a second call must re-read rather than hand back a stale set — callers use this to
    // refresh after an external change.
    await this.Lines.Load(true);
    const lines = this.Lines.Items as JournalEntryLineEntityServer[];
    for (const line of lines) {
      line.ParentJournalEntry = this;
    }
    await this.hydrateLineDimensions(user);
    return lines;
  }

  /** One bulk JournalEntryLineDimension query for ALL lines, distributed onto each line's collection. */
  private async hydrateLineDimensions(user?: UserInfo): Promise<void> {
    const lineIds = this.Lines.Items.map(l => l.ID).filter(Boolean);
    if (lineIds.length === 0) return;
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const inList = lineIds.map(id => `'${id}'`).join(',');
    const res = await provider.RunView<mjBizAppsAccountingJournalEntryLineDimensionEntity>(
      {
        EntityName: JELD_ENTITY,
        ExtraFilter: `JournalEntryLineID IN (${inList})`,
        ResultType: 'entity_object',
      },
      user ?? this.ContextCurrentUser,
    );
    // Loud on failure: treating a failed query as "no dimensions" would silently strip tags
    // from everything that reads the hydrated collection (reversals, dispatch, UI).
    if (!res.Success) {
      throw new Error(`Could not load the dimensions on the lines of journal entry ${this.ID}: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    const byLine = new Map<string, mjBizAppsAccountingJournalEntryLineDimensionEntity[]>();
    for (const dim of res.Results ?? []) {
      const key = dim.JournalEntryLineID.toLowerCase();
      const arr = byLine.get(key) ?? [];
      arr.push(dim);
      byLine.set(key, arr);
    }
    for (const line of this.Lines.Items as JournalEntryLineEntityServer[]) {
      line.SetLoadedDimensions(byLine.get(line.ID.toLowerCase()) ?? []);
    }
  }

  // ─── Load Overrides ─────────────────────────────────────────────────────────

  public override async Load(ID: string, EntityRelationshipsToLoad?: string[]): Promise<boolean> {
    const ok = await super.Load(ID, EntityRelationshipsToLoad);
    if (ok) {
      await this.LoadLines();
    }
    return ok;
  }

  public override async LoadFromData(data: any, replaceOldValues?: boolean): Promise<boolean> {
    const ok = await super.LoadFromData(data, replaceOldValues);
    if (ok && this.IsSaved) {
      await this.LoadLines();
    }
    return ok;
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  /**
   * The one line-set rule the SHARED subclass deliberately cannot make.
   *
   * `super.Validate()` — `JournalEntryEntity` — already runs the double-entry invariants (at least
   * two lines, debits equal credits at penny precision) and fans out to each line's own `Validate()`.
   * All three were restated here, verbatim, in different words, so every unbalanced entry reported
   * itself twice; that copy is gone.
   *
   * What is left is a rule that only makes sense on this side. A line the operator has not touched
   * is quiet in the editor by design — the JE workspace opens with two blank rows, and nagging about
   * them would train people to ignore the error list. But a blank line that reaches a SAVE is a
   * defect: `GLAccountID` is NOT NULL, so it fails at the insert with a constraint message instead
   * of a sentence anyone can act on. Callers that compose entries programmatically never produce
   * one; this is here so that when something does, it says so.
   */
  public override Validate(): ValidationResult {
    const result = super.Validate();
    const fail = (message: string) => {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('JournalEntryEntityServer.Validate', message, null));
    };

    // Status-graph enforcement (2026-09-05 security sweep). See JE_LEGAL_TRANSITIONS for why the
    // DB triggers alone do not cover this (they never police a Pending row).
    if (!this.IsSaved) {
      // A JE is born Pending — every sanctioned creation path (manual entry, the engine,
      // reversals, the batch summary) starts there; lifecycle moves happen through the batch process.
      if (this.Status && this.Status !== 'Pending') {
        fail(`A new journal entry must start as Pending, not '${this.Status}'; it becomes Batched or GL-posted only through batching.`);
      }
    } else {
      const oldStatus = this.GetFieldByName('Status')?.OldValue as string | undefined;
      if (oldStatus && this.Status !== oldStatus) {
        if (!(JE_LEGAL_TRANSITIONS[oldStatus] ?? []).includes(this.Status)) {
          fail(`A journal entry cannot go from ${oldStatus} to ${this.Status}. From ${oldStatus} it can go to: ${(JE_LEGAL_TRANSITIONS[oldStatus] ?? []).filter(s => s !== oldStatus).join(', ') || 'nothing; it is final'}.`);
        } else if (oldStatus === 'Batched' && this.Status === 'Pending' && this.JournalEntryBatchID) {
          fail(`A batched journal entry returns to Pending only when its batch releases it, and that clears its batch link (JournalEntryBatchID) in the same save.`);
        }
      }
    }

    // Manual-entry approval (golive #353, PR #463 review): the approval columns are written only by
    // this entity's approval routing and the decision path. Typed in by anyone else — e.g. the
    // entry's author filling in Approved At / Approved By on the form — the gate would read its
    // answer out of columns the gated person wrote.
    const forgedApprovalFields = APPROVAL_FIELDS.filter(f =>
      !this.writableApprovalFields.has(f) &&
      (this.IsSaved ? this.GetFieldByName(f)?.Dirty === true : this.Get(f) !== null && this.Get(f) !== undefined),
    );
    if (forgedApprovalFields.length > 0) {
      fail(
        `${forgedApprovalFields.join(', ')} cannot be set directly. A manual journal entry's approval is raised when the entry is saved ` +
        'and recorded through Approve or Reject (Accounting.RecordManualJournalEntryDecision).',
      );
    }

    // The D25 origin pair decides whether the entry is manual and so needs approval; it is set once,
    // by the booking path that creates the entry, and never changed afterwards (trg 50039 under it).
    if (this.IsSaved) {
      const changedPair = ORIGIN_PAIR_FIELDS.filter(f => this.GetFieldByName(f)?.Dirty === true);
      if (changedPair.length > 0) {
        fail(`${changedPair.join(' and ')} cannot change once a journal entry exists: they record the booking that created it, and an entry without them is a manual entry.`);
      }
    }

    const blank = (this.Lines.Items as JournalEntryLineEntityServer[])
      .map((line, i) => ({ line, number: i + 1 }))
      .filter(({ line }) => line.IsEmpty);

    for (const { number } of blank) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryEntityServer.Validate',
          `Line ${number} is blank — a journal entry cannot be saved with an empty line. Remove it, or give it an account and an amount.`,
          null,
        ),
      );
    }

    return result;
  }

  /** Async validation for DB lookups (Company alignment, active GL Accounts, File attachment). */
  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();

    // Rule 4: Reversal consistency — the 'Reversal' discriminator is the TYPE row's Code
    // (issue #24), so the paired check reads the row EntryTypeID points at.
    try {
      const type = this.EntryTypeID
        ? await LookupJournalEntryTypeByID(this.EntryTypeID, this.ContextCurrentUser, this.ProviderToUse as unknown as IMetadataProvider)
        : null;
      const isReversalType = type?.Code === 'Reversal';
      if (isReversalType && !this.ReversesJournalEntryID) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryEntityServer.ValidateAsync',
            'A Reversal entry must name the journal entry it reverses (ReversesJournalEntryID).',
            null,
          ),
        );
      }
      if (this.ReversesJournalEntryID && !isReversalType) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryEntityServer.ValidateAsync',
            'An entry that reverses another journal entry must have the Reversal entry type.',
            null,
          ),
        );
      }
    } catch (e: any) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo('JournalEntryEntityServer.ValidateAsync', e.message || String(e), null),
      );
    }

    // Rule 5: W9 Attachment validation
    try {
      await this.ValidateAttachment();
    } catch (e: any) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo('JournalEntryEntityServer.ValidateAsync', e.message || String(e), null),
      );
    }

    // Rule 7: status-graph, data-driven half (2026-09-05 security sweep) — Batched→GLPosted is the
    // batch DISPATCH transition and is only legal while the owning batch has itself been dispatched.
    try {
      const transitionError = await this.validateGLPostedTransition();
      if (transitionError) {
        result.Success = false;
        result.Errors.push(new ValidationErrorInfo('JournalEntryEntityServer.ValidateAsync', transitionError, null));
      }
    } catch (e: any) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo('JournalEntryEntityServer.ValidateAsync', e.message || String(e), null),
      );
    }

    // Rule 8 (golive #353, PR #463 review): a new entry's origin pair must name a real source record.
    // The pair is what marks an entry as booked rather than manual, so a pair pointing at nothing would
    // switch manual-entry approval off for an entry no booking created.
    try {
      const originError = await this.validateOriginPair();
      if (originError) {
        result.Success = false;
        result.Errors.push(new ValidationErrorInfo('JournalEntryEntityServer.ValidateAsync', originError, null));
      }
    } catch (e: unknown) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo('JournalEntryEntityServer.ValidateAsync', e instanceof Error ? e.message : String(e), null),
      );
    }

    // Rule 6: Single-Company Isolation (Line GLAccounts must match header CompanyID) & Active GL Accounts
    const lines = this.Lines.Items as JournalEntryLineEntityServer[];
    if (lines.length > 0 && this.CompanyID) {
      const allGlIds = [...new Set(lines.map(l => l.GLAccountID).filter(Boolean))];
      // GLAccountID values are client-set and interpolated into the filter below — validate each as
      // a plain UUID (a malformed one can never be a valid FK, so refusing loses nothing).
      const glIds = allGlIds.filter(id => isSqlGuid(id));
      for (const bad of allGlIds.filter(id => !isSqlGuid(id))) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryEntityServer.ValidateAsync',
            `A line's GL account ID '${bad}' is not a valid ID.`,
            null,
          ),
        );
      }
      if (glIds.length > 0) {
        const provider = this.ProviderToUse as unknown as IRunViewProvider;
        const inList = glIds.map(id => `'${id}'`).join(',');
        const res = await provider.RunView<{ ID: string; CompanyID: string; Code: string; IsActive: boolean }>(
          {
            EntityName: GL_ENTITY,
            ExtraFilter: `ID IN (${inList})`,
            Fields: ['ID', 'CompanyID', 'Code', 'IsActive'],
            ResultType: 'simple',
          },
          this.ContextCurrentUser,
        );

        if (res.Success && res.Results) {
          const glMap = new Map(res.Results.map(gl => [gl.ID.toLowerCase(), gl]));
          for (const line of lines) {
            if (!line.GLAccountID) continue;
            const gl = glMap.get(line.GLAccountID.toLowerCase());
            if (!gl) {
              result.Success = false;
              result.Errors.push(
                new ValidationErrorInfo(
                  'JournalEntryEntityServer.ValidateAsync',
                  `Line ${line.LineNumber || ''}: GL account ${line.GLAccountID} was not found.`,
                  null,
                ),
              );
              continue;
            }
            if (!gl.IsActive) {
              result.Success = false;
              result.Errors.push(
                new ValidationErrorInfo(
                  'JournalEntryEntityServer.ValidateAsync',
                  `Line ${line.LineNumber || ''}: GL account ${gl.Code || gl.ID} is inactive. Pick an active account.`,
                  null,
                ),
              );
            }
            if (gl.CompanyID && gl.CompanyID.toLowerCase() !== this.CompanyID.toLowerCase()) {
              result.Success = false;
              result.Errors.push(
                new ValidationErrorInfo(
                  'JournalEntryEntityServer.ValidateAsync',
                  `Line ${line.LineNumber || ''}: GL account ${gl.Code || gl.ID} belongs to company ${gl.CompanyID}, but this journal entry belongs to company ${this.CompanyID}. Every line must use an account of the entry's company.`,
                  null,
                ),
              );
            }
          }
        }
      }
    }

    return result;
  }

  // ─── Save Override ──────────────────────────────────────────────────────────

  public override async Save(options?: EntitySaveOptions): Promise<boolean> {
    const dbProvider = this.ProviderToUse as unknown as DatabaseProviderBase;

    // W2 numbering (plan D19): assign the per-company, per-FY gap-free EntryNumber
    // before the header INSERT (EntryNumber is NOT NULL + UNIQUE).
    if (!this.IsSaved && !this.EntryNumber) {
      try {
        await this.assignEntryNumber();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        LogError(`JournalEntryEntityServer.Save: EntryNumber assignment failed: ${err}`);
        throw new Error(`Cannot number journal entry: ${msg}`);
      }
    }

    // Manual-entry approval (golive #353): decided BEFORE the transaction, from reads only, so an
    // entry nobody may approve is refused before anything is written, as numbering is above.
    const approval = await this.planApproval();

    // This save's own approval routing may write every approval column; a caller's allowance
    // (SaveApprovalStamp) is kept and restored afterwards.
    const callerWritableApprovalFields = this.writableApprovalFields;
    if (approval) this.writableApprovalFields = ALL_APPROVAL_FIELDS;

    try {
      await dbProvider.BeginTransaction();

      // The approval Task being replaced: the entry's content changed, or it no longer needs approval.
      const supersededTaskId = approval ? this.ApprovalTaskID : null;
      if (approval) this.applyApprovalAction(approval);

      // THE HEADER AND ITS LINES, AS ONE GRAPH.
      //
      // This used to be three hand-written steps — save the header, delete the queued lines, then
      // loop the active ones stamping JournalEntryID and LineNumber before saving each. MJ's graph
      // save is exactly that sequence, so the code is gone rather than adapted:
      //
      //   · removals run BEFORE inserts, so a LineNumber freed by a removal is available to the
      //     line about to take it — `UQ_JournalEntryLine_JE_LineNumber` needs that ordering, and
      //     the hand-written version happened to get it right by luck of statement order
      //   · the foreign key is stamped from the parent's key at execution time, so it is correct
      //     even when the header is new and its ID is minted during this very save
      //   · LineNumber comes from the declared Sequence policy
      //   · every line is still written by its OWN Save(), so JournalEntryLineEntityServer's
      //     dimension handling, validation and record-change tracking all fire exactly as before
      //
      // NOTE this deliberately does NOT pass IsGraphNodeSave. bizapps-orders does, because
      // OrderEntityServer prices and books its lines itself and must keep ownership of when they
      // are written. A journal entry has no such walk: the lines are complete when they arrive, so
      // letting the graph persist them is the whole point.
      const saved = await this.withLinesSavedThroughEntry(() => super.Save(options));
      if (!saved) {
        throw new Error(
          `The journal entry could not be saved: ${this.LatestResult?.CompleteMessage ?? 'unknown error'}`,
        );
      }

      if (approval) {
        const service = new ManualJournalEntryApprovalService(this.ProviderToUse as unknown as IMetadataProvider);
        if (supersededTaskId) await service.CloseSupersededTask(supersededTaskId, this.ContextCurrentUser);
        if (approval.Action === 'Raise') {
          // The Task links to the entry, so it is raised after the insert; its ID is stamped in the
          // same transaction, because the approval is read from this column, never from a Task Link.
          this.ApprovalTaskID = await service.RaiseApprovalTask(this, approval.Plan, this.ContextCurrentUser);
          if (!(await this.withLinesSavedThroughEntry(() => super.Save(options)))) {
            throw new Error(
              `The journal entry could not be linked to its approval task: ${this.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );
          }
        }
      }

      await dbProvider.CommitTransaction();
      return true;
    } catch (err) {
      LogError(`Exception during JournalEntryEntityServer.Save(): ${err}`);
      try {
        await dbProvider.RollbackTransaction();
      } catch (rollbackErr) {
        LogError(`Failed to rollback transaction during JournalEntryEntityServer.Save(): ${rollbackErr}`);
      }
      return false;
    } finally {
      this.writableApprovalFields = callerWritableApprovalFields;
    }
  }

  /**
   * Record an approval on this entry: the ONLY save that may set ApprovedAt / ApprovedByUserID.
   * Called by `ManualJournalEntryApprovalService.RecordDecision` after it has checked the decider
   * (never the requester; the role or the Approval CFO, read at decision time). Server-only: no
   * client save reaches it, and Validate refuses the same columns on every other save.
   */
  public async SaveApprovalStamp(approvedByUserID: string, approvedAt: Date): Promise<boolean> {
    if (!approvedByUserID) throw new Error('An approval must name the user who approved it.');
    this.ApprovedAt = approvedAt;
    this.ApprovedByUserID = approvedByUserID;
    const previous = this.writableApprovalFields;
    this.writableApprovalFields = APPROVAL_STAMP_FIELDS;
    try {
      return await this.Save();
    } finally {
      this.writableApprovalFields = previous;
    }
  }

  /** The lines are deleted with the entry, so the standalone-line approval guard lets them go. */
  public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
    return this.withLinesSavedThroughEntry(() => super.Delete(options));
  }

  // ─── Manual-entry approval (golive #353) ──────────────────────────────────

  /**
   * Run a write with every line (kept and removed) marked as going through this entry, so the
   * line-level approval guard defers to this entry's own approval routing.
   */
  private async withLinesSavedThroughEntry<T>(write: () => Promise<T>): Promise<T> {
    const lines = [...this.Lines.Items, ...this.Lines.Removed] as JournalEntryLineEntityServer[];
    for (const line of lines) line.SavingThroughJournalEntry = true;
    try {
      return await write();
    } finally {
      for (const line of lines) line.SavingThroughJournalEntry = false;
    }
  }

  /**
   * True when this save changes what an approval covers: a new entry, or a change to the company,
   * the effective date, the entry type, or any line's account, amounts or dimension tags (a line
   * added, removed or edited). Description and the batch/posting columns are not covered.
   */
  public HasApprovalRelevantChanges(): boolean {
    if (!this.IsSaved) return true;
    if (['CompanyID', 'EffectiveDate', 'EntryTypeID'].some(f => this.GetFieldByName(f)?.Dirty)) return true;
    if (this.Lines.Removed.length > 0) return true;
    return (this.Lines.Items as JournalEntryLineEntityServer[]).some(line =>
      !line.IsSaved ||
      ['GLAccountID', 'DebitAmount', 'CreditAmount'].some(f => line.GetFieldByName(f)?.Dirty) ||
      line.Dimensions.Dirty,
    );
  }

  /** Ask the approval service what this save must do; refuse the save when nobody may approve it. */
  private async planApproval(): Promise<ManualJournalEntrySaveAction | null> {
    // A booking-path entry (D25 origin pair set), a non-Pending one, or a save that changes nothing an
    // approval covers (a batch lock or release, a description) never needs routing: no query at all.
    if (!IsManualJournalEntry(this) || this.Status !== 'Pending' || !this.HasApprovalRelevantChanges()) return null;
    if (!this.ContextCurrentUser) {
      throw new Error('A manual journal entry cannot be saved without a signed-in user: its approval needs to know who raised it.');
    }
    const service = new ManualJournalEntryApprovalService(this.ProviderToUse as unknown as IMetadataProvider);
    try {
      return await service.PlanForSave(this, this.ContextCurrentUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogError(`JournalEntryEntityServer.Save: manual-entry approval routing failed: ${msg}`);
      throw err instanceof ManualJournalEntryApprovalError ? err : new Error(`Cannot route the journal entry's approval: ${msg}`);
    }
  }

  /** Stamp the approval routing onto the header (inside Save's transaction, before the write). */
  private applyApprovalAction(action: ManualJournalEntrySaveAction): void {
    const raise = action.Action === 'Raise';
    this.ApprovalLevel = raise ? action.Plan.Level : null;
    this.ApprovalRequestedByUserID = raise ? this.ContextCurrentUser.ID : null;
    // A changed entry's earlier approval does not cover the new content; RaiseApprovalTask stamps the new Task.
    this.ApprovalTaskID = null;
    this.ApprovedAt = null;
    this.ApprovedByUserID = null;
  }

  // ─── W2: numbering (plan D19) ─────────────────────────────────────────────

  private async assignEntryNumber(): Promise<void> {
    if (!this.ContextCurrentUser) {
      throw new Error('A journal entry number cannot be assigned without a signed-in user.');
    }
    if (!this.CompanyID) {
      throw new Error('Choose a company before saving the journal entry.');
    }
    const fiscalYear = await this.deriveFiscalYear();
    this.EntryNumber = await getNextJournalEntryNumber(
      this.CompanyID,
      fiscalYear,
      this.ContextCurrentUser,
      this.ProviderToUse as unknown as IMetadataProvider,
    );
  }

  /**
   * Fiscal year from the company's ACP settings: the FY containing EffectiveDate,
   * labeled by the calendar year the fiscal year STARTS in. For the default Jan-1
   * start this equals the calendar year. The rule is `FiscalYearOf` (accounting-engine-base),
   * shared with the deferred-revenue waterfall's year-to-date figure.
   */
  private async deriveFiscalYear(): Promise<number> {
    const effectiveDate = this.EffectiveDate;
    if (!effectiveDate) {
      throw new Error('Enter an effective date before saving the journal entry.');
    }
    // Defensive: a raw-loaded value can arrive as an ISO string at runtime despite the Date type.
    const d = effectiveDate instanceof Date ? effectiveDate : new Date(effectiveDate);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`The effective date '${String(effectiveDate)}' is not a valid date.`);
    }
    await AccountingEngineBase.Instance.ConfigEx({ contextUser: this.ContextCurrentUser, provider: this.ProviderToUse as unknown as IMetadataProvider });
    const day = ToCalendarDay(d);
    if (day === null) {
      throw new Error(`The effective date '${String(effectiveDate)}' cannot be read as a calendar day.`);
    }
    return FiscalYearOf(day, AccountingEngineBase.Instance.FiscalYearStartFor(this.CompanyID));
  }

  // ─── Status-graph hardening (data-driven half) ────────────────────────────

  /**
   * Batched→GLPosted is the engine's dispatch transition (markJournalEntriesGLPosted): it runs after
   * the owning batch has flipped Approved→Sent→Posted, so at the moment a member JE legitimately
   * becomes GLPosted its batch is Sent or Posted. An ad-hoc caller flipping a Batched JE to
   * GLPosted while its batch is still Pending/Approved (i.e. never dispatched) is forging a posting
   * — refuse it. Returns the problem, or null when the save is not that transition / is legitimate.
   */
  private async validateGLPostedTransition(): Promise<string | null> {
    if (!this.IsSaved) return null;
    const oldStatus = this.GetFieldByName('Status')?.OldValue as string | undefined;
    if (this.Status !== 'GLPosted' || oldStatus === 'GLPosted' || !oldStatus) return null;

    const batchId = this.JournalEntryBatchID;
    if (!batchId) {
      return 'A journal entry can be marked GL-posted only as part of a sent batch, and this entry is in no batch.';
    }
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ Status: string }>(
      {
        EntityName: BATCH_ENTITY,
        ExtraFilter: `ID=${sqlGuidLiteral(batchId, 'JournalEntryEntityServer.validateGLPostedTransition')}`,
        Fields: ['Status'],
        MaxRows: 1,
        ResultType: 'simple',
        BypassCache: true,
      },
      this.ContextCurrentUser,
    );
    // Loud on failure: silently skipping would reopen the forged-posting hole this check closes.
    if (!res.Success) {
      throw new Error(`Could not check batch ${batchId}, which holds this journal entry: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    const batchStatus = res.Results?.[0]?.Status;
    if (!batchStatus) {
      return `This journal entry cannot be marked GL-posted: its batch ${batchId} was not found.`;
    }
    if (batchStatus !== 'Sent' && batchStatus !== 'Posted') {
      return `This journal entry cannot be marked GL-posted: its batch ${batchId} is ${batchStatus}, and only a Sent or Posted batch can mark its entries GL-posted.`;
    }
    return null;
  }

  // ─── Origin pair (D25) ─────────────────────────────────────────────────────

  /**
   * On a NEW entry with an origin pair: the entity must exist and the record must exist in it. Returns
   * the problem, or null. A saved entry's pair cannot change (Validate), so it is checked only here.
   */
  private async validateOriginPair(): Promise<string | null> {
    if (this.IsSaved) return null;
    const entityId = this.LinkedEntityID;
    const recordId = this.LinkedRecordID;
    if (!entityId && !recordId) return null;
    if (!entityId || !recordId) {
      return 'LinkedEntityID and LinkedRecordID are set together or not at all.';
    }
    const provider = this.ProviderToUse as unknown as IMetadataProvider;
    const entity = provider.Entities.find(e => UUIDsEqual(e.ID, entityId));
    if (!entity) return `LinkedEntityID ${entityId} is not an entity.`;
    const keys = entity.PrimaryKeys;
    if (keys.length !== 1) {
      return `The source entity ${entity.Name} has a composite key, which a journal entry's origin pair cannot name.`;
    }
    const key = keys[0];
    let literal: string;
    if (key.NeedsQuotes) {
      if (key.Type.toLowerCase() === 'uniqueidentifier' && !isSqlGuid(recordId)) {
        return `LinkedRecordID '${recordId}' is not a valid ${entity.Name} ID.`;
      }
      literal = `'${EscapeSQLString(recordId)}'`;
    } else {
      if (!/^-?\d+$/.test(recordId)) return `LinkedRecordID '${recordId}' is not a valid ${entity.Name} ID.`;
      literal = recordId;
    }
    const res = await (this.ProviderToUse as unknown as IRunViewProvider).RunView<Record<string, unknown>>(
      {
        EntityName: entity.Name,
        ExtraFilter: `${key.Name}=${literal}`,
        Fields: [key.Name],
        MaxRows: 1,
        ResultType: 'simple',
        BypassCache: true,
      },
      this.ContextCurrentUser,
    );
    // Loud: treating a failed read as "the source exists" would let a made-up pair skip approval.
    if (!res.Success) {
      throw new Error(`Could not check the journal entry's source record (${entity.Name} ${recordId}): ${res.ErrorMessage ?? 'unknown error'}`);
    }
    if ((res.Results ?? []).length === 0) {
      return `The journal entry's source record (${entity.Name} ${recordId}) does not exist. An entry created by hand is a manual entry and leaves LinkedEntityID and LinkedRecordID empty.`;
    }
    return null;
  }

  // ─── W9: attachment validation ────────────────────────────────────────────

  private async ValidateAttachment(): Promise<void> {
    const fileId = this.FileID;
    if (!fileId) return;
    // fileId is client-set and interpolated into the filter — a plain UUID or the save fails (W9's
    // "must reference an existing file" already implies a well-formed id).
    const fileIdLiteral = sqlGuidLiteral(fileId, 'JournalEntry.FileID (W9)');
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ ID: string }>(
      { EntityName: FILE_ENTITY, ExtraFilter: `ID=${fileIdLiteral}`, Fields: ['ID'], ResultType: 'simple' },
      this.ContextCurrentUser,
    );
    if (res.Success && res.Results.length === 0) {
      throw new Error(`The attached file (${fileId}) does not exist. Remove the attachment or attach the file again.`);
    }
  }

  // ─── W6: reversal generation ──────────────────────────────────────────────

  /**
   * Create a new Pending JE that reverses this one (Dr/Cr swapped, dimension tags carried),
   * back-referenced both ways. Uses the encapsulated pattern: the reversal is assembled as a
   * JournalEntryEntityServer with Lines + Dimensions and persisted in ONE transactional Save().
   * The reversal's EffectiveDate is the later of today's BUSINESS day (`BusinessTimeZoneEngine`,
   * not the server clock's calendar day — issue #230) and the original's EffectiveDate, so a
   * reversal never lands in a period before the entry it reverses (issue #266).
   */
  public async GenerateReversal(
    reason: string,
    contextUser?: UserInfo,
  ): Promise<mjBizAppsAccountingJournalEntryEntity> {
    if (!this.IsSaved) {
      throw new Error('The journal entry must be saved before it can be reversed.');
    }
    const user = contextUser ?? this.ContextCurrentUser;
    const provider = this.ProviderToUse as unknown as IMetadataProvider;

    // Guards (defense-in-depth; the UI also hides the action): a reversal entry cannot itself be
    // reversed (an ever-growing reverse-the-reverse chain), and an already-reversed entry cannot
    // be reversed again (double-reversing would orphan the back-pointer).
    const reversalTypeId = await RequireJournalEntryTypeID('Reversal', user, provider);
    if (this.EntryTypeID?.toLowerCase() === reversalTypeId.toLowerCase() || this.ReversesJournalEntryID) {
      throw new Error('A reversal entry cannot itself be reversed.');
    }
    if (this.ReversedByJournalEntryID) {
      throw new Error(`Journal entry ${this.EntryNumber} has already been reversed (by journal entry ${this.ReversedByJournalEntryID}).`);
    }

    // Make sure this JE's own lines (+ dimension tags) are hydrated to copy from.
    if (this.Lines.Count === 0) {
      await this.LoadLines(user);
    }

    const reversal = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, user);
    reversal.NewRecord();
    reversal.CompanyID = this.CompanyID;
    reversal.EffectiveDate = laterBusinessDate(await loadTodayBusiness(user, provider, this.CompanyID), this.EffectiveDate);
    reversal.EntryTypeID = reversalTypeId;
    reversal.Status = 'Pending';
    reversal.Description = `Reversal of ${this.EntryNumber}: ${reason}`;
    reversal.ReversesJournalEntryID = this.ID;

    for (const orig of this.Lines.Items as JournalEntryLineEntityServer[]) {
      const line = await reversal.CreateLine(user);
      line.GLAccountID = orig.GLAccountID;
      line.DebitAmount = orig.CreditAmount; // SWAP
      line.CreditAmount = orig.DebitAmount; // SWAP
      line.Description = `Reversal of line ${orig.LineNumber}`;
      for (const origDim of orig.Dimensions) {
        const dim = await line.CreateDimension(user);
        dim.DimensionID = origDim.DimensionID;
        dim.DimensionValueID = origDim.DimensionValueID;
      }
    }

    if (!(await reversal.Save())) {
      throw new Error(`The reversal could not be saved: ${reversal.LatestResult?.CompleteMessage ?? 'unknown error'}`);
    }
    await this.BackReferenceReversal(reversal.ID);
    return reversal;
  }

  private async BackReferenceReversal(reversalId: string): Promise<void> {
    this.ReversedByJournalEntryID = reversalId;
    const ok = await super.Save();
    if (!ok) {
      LogError(`GenerateReversal: failed to set ReversedByJournalEntryID on ${this.EntryNumber}: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
  }
}
