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
 */

import {
  BaseEntity,
  DatabaseProviderBase,
  EntitySaveOptions,
  IMetadataProvider,
  IRunViewProvider,
  LogError,
  UserInfo,
  ValidationErrorInfo,
  ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingJournalEntryEntity,
  JournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';

import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';

import { JournalEntryLineEntityServer } from './JournalEntryLineEntityServer.js';
import { LookupJournalEntryTypeByID, RequireJournalEntryTypeID } from './JournalEntryTypes.js';
import { getNextJournalEntryNumber } from './SequenceService.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const FILE_ENTITY = 'Files'; // __mj.File

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
      throw new Error(`JournalEntryEntityServer.hydrateLineDimensions: failed to load dimension tags for JE ${this.ID}: ${res.ErrorMessage ?? 'unknown error'}`);
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

  /** Synchronous in-memory validation of double-entry rules & invariants. */
  public override Validate(): ValidationResult {
    const result = super.Validate();
    const lines = this.Lines.Items as JournalEntryLineEntityServer[];

    // Rule 1: A JE must have at least 2 line items
    if (lines.length < 2) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryEntityServer.Validate',
          `A Journal Entry must have at least 2 line items (double-entry invariant). Found ${lines.length} line(s).`,
          null,
        ),
      );
    }

    // Rule 2: Equal debits and credits overall, compared AT PENNY PRECISION.
    //
    // This was `totalDebits !== totalCredits` — exact float equality on accumulated sums — and it
    // rejected entries that balance perfectly. A four-line entry of
    //
    //     Dr AR 302.59  /  Cr Sales 233.51 + Cr Tax 25.30 + Cr Shipping 43.78
    //
    // sums on the credit side to 302.59000000000003 in IEEE-754, so the comparison failed while the
    // error message printed both sides as "302.59" — telling the caller two identical numbers were
    // unequal. It stayed latent while entries had two or three lines and friendly amounts; the
    // first four-line entry from bizapps-orders (goods, tax and shipping on one line) hit it.
    //
    // DebitAmount and CreditAmount are DECIMAL(18,2), so a penny IS the unit of account here and
    // anything finer is an artefact of summing in binary floating point. Half a penny is therefore
    // the correct tolerance: tight enough that no real imbalance passes — the smallest storable
    // discrepancy is a whole penny, two hundred times the epsilon — and loose enough that
    // accumulation order cannot decide whether a balanced entry is accepted.
    const totalDebits = lines.reduce((sum, l) => sum + (l.DebitAmount ?? 0), 0);
    const totalCredits = lines.reduce((sum, l) => sum + (l.CreditAmount ?? 0), 0);
    if (Math.abs(totalDebits - totalCredits) >= 0.005) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryEntityServer.Validate',
          `Unbalanced Journal Entry: total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)}).`,
          null,
        ),
      );
    }

    // Rule 3: Line-level validations
    for (const line of lines) {
      const lineVal = line.Validate();
      if (!lineVal.Success) {
        result.Success = false;
        for (const err of lineVal.Errors) {
          result.Errors.push(err);
        }
      }
    }

    // Rule 4 (reversal consistency) moved to ValidateAsync (issue #24): the 'Reversal'
    // discriminator now lives on the JournalEntryType row EntryTypeID points at, and reading
    // it is a DB lookup. trg_JE_ReversalConsistency (50012) remains the un-bypassable floor.

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
            'JournalEntry typed \'Reversal\' must specify ReversesJournalEntryID.',
            null,
          ),
        );
      }
      if (this.ReversesJournalEntryID && !isReversalType) {
        result.Success = false;
        result.Errors.push(
          new ValidationErrorInfo(
            'JournalEntryEntityServer.ValidateAsync',
            'JournalEntry specifying ReversesJournalEntryID must be typed with JournalEntryType Code=\'Reversal\'.',
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

    // Rule 6: Single-Company Isolation (Line GLAccounts must match header CompanyID) & Active GL Accounts
    const lines = this.Lines.Items as JournalEntryLineEntityServer[];
    if (lines.length > 0 && this.CompanyID) {
      const glIds = [...new Set(lines.map(l => l.GLAccountID).filter(Boolean))];
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
                  `Line ${line.LineNumber || ''}: GL Account ${line.GLAccountID} not found.`,
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
                  `Line ${line.LineNumber || ''}: GL Account ${gl.Code || gl.ID} is inactive.`,
                  null,
                ),
              );
            }
            if (gl.CompanyID && gl.CompanyID.toLowerCase() !== this.CompanyID.toLowerCase()) {
              result.Success = false;
              result.Errors.push(
                new ValidationErrorInfo(
                  'JournalEntryEntityServer.ValidateAsync',
                  `Line ${line.LineNumber || ''}: GL Account ${gl.Code || gl.ID} belongs to company ${gl.CompanyID}, but Journal Entry belongs to company ${this.CompanyID} (single-company isolation rule D3).`,
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
        LogError(`JournalEntryEntityServer.Save: EntryNumber assignment failed: ${err}`);
        return false;
      }
    }

    try {
      await dbProvider.BeginTransaction();

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
      const saved = await super.Save(options);
      if (!saved) {
        throw new Error(
          `Failed to save JournalEntry: ${this.LatestResult?.CompleteMessage ?? 'unknown error'}`,
        );
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
    }
  }

  // ─── W2: numbering (plan D19) ─────────────────────────────────────────────

  private async assignEntryNumber(): Promise<void> {
    if (!this.ContextCurrentUser) {
      throw new Error('JournalEntryEntityServer.assignEntryNumber: ContextCurrentUser is required');
    }
    if (!this.CompanyID) {
      throw new Error('JournalEntryEntityServer.assignEntryNumber: CompanyID must be set before save (journal entries are single-company, plan D3)');
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
   * start this equals the calendar year. All date-part math in UTC (repo convention).
   */
  private async deriveFiscalYear(): Promise<number> {
    const effectiveDate = this.EffectiveDate;
    if (!effectiveDate) {
      throw new Error('JournalEntryEntityServer.deriveFiscalYear: EffectiveDate must be set before save (NOT NULL constraint)');
    }
    // Defensive: a raw-loaded value can arrive as an ISO string at runtime despite the Date type.
    const d = effectiveDate instanceof Date ? effectiveDate : new Date(effectiveDate);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`JournalEntryEntityServer.deriveFiscalYear: invalid EffectiveDate value: ${String(effectiveDate)}`);
    }
    await AccountingEngineBase.Instance.ConfigEx({ contextUser: this.ContextCurrentUser, provider: this.ProviderToUse as unknown as IMetadataProvider });
    const acp = AccountingEngineBase.Instance.CompanyProfiles.find(
      p => p.ID?.toLowerCase() === this.CompanyID?.toLowerCase()
    );
    const startMonth = acp?.FiscalYearStartMonth ?? 1;
    const startDay = acp?.FiscalYearStartDay ?? 1;
    const beforeFYStart =
      d.getUTCMonth() + 1 < startMonth ||
      (d.getUTCMonth() + 1 === startMonth && d.getUTCDate() < startDay);
    return beforeFYStart ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  }

  // ─── W9: attachment validation ────────────────────────────────────────────

  private async ValidateAttachment(): Promise<void> {
    const fileId = this.FileID;
    if (!fileId) return;
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ ID: string }>(
      { EntityName: FILE_ENTITY, ExtraFilter: `ID='${fileId}'`, Fields: ['ID'], ResultType: 'simple' },
      this.ContextCurrentUser,
    );
    if (res.Success && res.Results.length === 0) {
      throw new Error(`JournalEntry.FileID ${fileId} does not reference an existing file (W9).`);
    }
  }

  // ─── W6: reversal generation ──────────────────────────────────────────────

  /**
   * Create a new Pending JE that reverses this one (Dr/Cr swapped, dimension tags carried),
   * back-referenced both ways. Uses the encapsulated pattern: the reversal is assembled as a
   * JournalEntryEntityServer with Lines + Dimensions and persisted in ONE transactional Save().
   */
  public async GenerateReversal(
    reason: string,
    contextUser?: UserInfo,
  ): Promise<mjBizAppsAccountingJournalEntryEntity> {
    if (!this.IsSaved) {
      throw new Error('GenerateReversal: the JournalEntry must be saved before it can be reversed.');
    }
    const user = contextUser ?? this.ContextCurrentUser;
    const provider = this.ProviderToUse as unknown as IMetadataProvider;

    // Guards (defense-in-depth; the UI also hides the action): a reversal entry cannot itself be
    // reversed (an ever-growing reverse-the-reverse chain), and an already-reversed entry cannot
    // be reversed again (double-reversing would orphan the back-pointer).
    const reversalTypeId = await RequireJournalEntryTypeID('Reversal', user, provider);
    if (this.EntryTypeID?.toLowerCase() === reversalTypeId.toLowerCase() || this.ReversesJournalEntryID) {
      throw new Error('GenerateReversal: a reversal entry cannot itself be reversed.');
    }
    if (this.ReversedByJournalEntryID) {
      throw new Error(`GenerateReversal: ${this.EntryNumber} has already been reversed (by JE ${this.ReversedByJournalEntryID}).`);
    }

    // Make sure this JE's own lines (+ dimension tags) are hydrated to copy from.
    if (this.Lines.Count === 0) {
      await this.LoadLines(user);
    }

    const reversal = await provider.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, user);
    reversal.NewRecord();
    reversal.CompanyID = this.CompanyID;
    reversal.EffectiveDate = new Date();
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
      throw new Error(`GenerateReversal: failed to save reversal: ${reversal.LatestResult?.CompleteMessage ?? 'unknown'}`);
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
