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
 *       5. Reversal consistency (EntryType='Reversal' <-> ReversesJournalEntryID).
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
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';

import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';

import { JournalEntryLineEntityServer } from './JournalEntryLineEntityServer.js';
import { getNextJournalEntryNumber } from './SequenceService.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const FILE_ENTITY = 'Files'; // __mj.File

@RegisterClass(BaseEntity, JE_ENTITY)
export class JournalEntryEntityServer extends mjBizAppsAccountingJournalEntryEntity {
  private _lines: JournalEntryLineEntityServer[] = [];
  private _deletedLines: JournalEntryLineEntityServer[] = [];

  /**
   * Child JournalEntryLine instances attached to this Journal Entry.
   * Gives full visibility of lines at the Journal Entry header level.
   */
  get Lines(): JournalEntryLineEntityServer[] {
    return this._lines;
  }

  /** Appends a line to this Journal Entry and sets its parent reference. */
  public AddLine(line: JournalEntryLineEntityServer): void {
    if (!line) return;
    line.ParentJournalEntry = this;
    if (this.ID) {
      line.JournalEntryID = this.ID;
    }
    if (!line.LineNumber) {
      line.LineNumber = this._lines.length + 1;
    }
    this._lines.push(line);
  }

  /** Removes a line by object instance or array index. Tracks saved lines for deletion on Save(). */
  public RemoveLine(lineOrIndex: JournalEntryLineEntityServer | number): void {
    let removedLine: JournalEntryLineEntityServer | null = null;
    if (typeof lineOrIndex === 'number') {
      if (lineOrIndex >= 0 && lineOrIndex < this._lines.length) {
        removedLine = this._lines.splice(lineOrIndex, 1)[0];
      }
    } else {
      const idx = this._lines.indexOf(lineOrIndex);
      if (idx >= 0) {
        removedLine = this._lines.splice(idx, 1)[0];
      }
    }

    if (removedLine && removedLine.IsSaved) {
      this._deletedLines.push(removedLine);
    }

    // Re-sequence remaining line numbers
    this._lines.forEach((l, index) => {
      l.LineNumber = index + 1;
    });
  }

  /** Instantiates a new line, attaches it to this JE, and returns it. */
  public async CreateLine(user?: UserInfo): Promise<JournalEntryLineEntityServer> {
    const provider = this.ProviderToUse as unknown as IMetadataProvider;
    const line = await provider.GetEntityObject<JournalEntryLineEntityServer>(
      JEL_ENTITY,
      user ?? this.ContextCurrentUser,
    );
    line.NewRecord();
    line.JournalEntryID = this.ID;
    line.LineNumber = this._lines.length + 1;
    this.AddLine(line);
    return line;
  }

  /** Loads child lines from database for this Journal Entry if saved. */
  public async LoadLines(user?: UserInfo): Promise<JournalEntryLineEntityServer[]> {
    if (!this.IsSaved || !this.ID) {
      return this._lines;
    }
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<JournalEntryLineEntityServer>(
      {
        EntityName: JEL_ENTITY,
        ExtraFilter: `JournalEntryID='${this.ID}'`,
        OrderBy: 'LineNumber ASC',
        ResultType: 'entity_object',
      },
      user ?? this.ContextCurrentUser,
    );
    if (res.Success && res.Results) {
      this._lines = res.Results;
      for (const line of this._lines) {
        line.ParentJournalEntry = this;
      }
      this._deletedLines = [];
    }
    return this._lines;
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
    const lines = this._lines || [];

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

    // Rule 2: Equal debits and credits overall (exact balance required)
    const totalDebits = lines.reduce((sum, l) => sum + (l.DebitAmount ?? 0), 0);
    const totalCredits = lines.reduce((sum, l) => sum + (l.CreditAmount ?? 0), 0);
    if (totalDebits !== totalCredits) {
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

    // Rule 4: Reversal consistency
    if (this.EntryType === 'Reversal' && !this.ReversesJournalEntryID) {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryEntityServer.Validate',
          'JournalEntry with EntryType="Reversal" must specify ReversesJournalEntryID.',
          null,
        ),
      );
    }
    if (this.ReversesJournalEntryID && this.EntryType !== 'Reversal') {
      result.Success = false;
      result.Errors.push(
        new ValidationErrorInfo(
          'JournalEntryEntityServer.Validate',
          'JournalEntry specifying ReversesJournalEntryID must have EntryType="Reversal".',
          null,
        ),
      );
    }

    return result;
  }

  /** Async validation for DB lookups (Company alignment, active GL Accounts, File attachment). */
  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();

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
    const lines = this._lines || [];
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

      // 1. Save header record first
      const savedHeader = await super.Save(options);
      if (!savedHeader) {
        throw new Error(
          `Failed to save JournalEntry header: ${this.LatestResult?.CompleteMessage ?? 'unknown error'}`,
        );
      }

      // 2. Process pending line deletions
      if (this._deletedLines && this._deletedLines.length > 0) {
        for (const line of this._deletedLines) {
          const deleted = await line.Delete(options);
          if (!deleted) {
            throw new Error(
              `Failed to delete line ${line.LineNumber}: ${line.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );
          }
        }
        this._deletedLines = [];
      }

      // 3. Save attached active lines
      if (this._lines && this._lines.length > 0) {
        let lineNum = 1;
        for (const line of this._lines) {
          line.JournalEntryID = this.ID;
          line.LineNumber = lineNum++;

          const savedLine = await line.Save(options);
          if (!savedLine) {
            throw new Error(
              `Failed to save line ${line.LineNumber}: ${line.LatestResult?.CompleteMessage ?? 'unknown error'}`,
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
    this.EntryNumber = await getNextJournalEntryNumber(this.CompanyID, fiscalYear, this.ContextCurrentUser);
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

  /** Create a new Pending JE that reverses this one (Dr/Cr swapped), back-referenced both ways. */
  public async GenerateReversal(
    reason: string,
    contextUser?: UserInfo,
  ): Promise<mjBizAppsAccountingJournalEntryEntity> {
    if (!this.IsSaved) {
      throw new Error('GenerateReversal: the JournalEntry must be saved before it can be reversed.');
    }
    const user = contextUser ?? this.ContextCurrentUser;
    const reversal = await this.BuildReversalHeader(reason, user);
    await this.CopySwappedLines(reversal.ID, user);
    await this.BackReferenceReversal(reversal.ID);
    return reversal;
  }

  private async BuildReversalHeader(
    reason: string,
    user: UserInfo | undefined,
  ): Promise<mjBizAppsAccountingJournalEntryEntity> {
    const provider = this.ProviderToUse as unknown as IMetadataProvider;
    const reversal = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    reversal.NewRecord();
    reversal.CompanyID = this.CompanyID;
    reversal.EffectiveDate = new Date();
    reversal.EntryType = 'Reversal';
    reversal.Status = 'Pending';
    reversal.Description = `Reversal of ${this.EntryNumber}: ${reason}`;
    reversal.ReversesJournalEntryID = this.ID;
    const saved = await reversal.Save();
    if (!saved) {
      throw new Error(`GenerateReversal: failed to save reversal header: ${reversal.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return reversal;
  }

  private async CopySwappedLines(reversalId: string, user: UserInfo | undefined): Promise<void> {
    const viewProvider = this.ProviderToUse as unknown as IRunViewProvider;
    const metaProvider = this.ProviderToUse as unknown as IMetadataProvider;

    const res = await viewProvider.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${this.ID}'`, OrderBy: 'LineNumber ASC', ResultType: 'entity_object' },
      user,
    );
    if (!res.Success) {
      throw new Error(`GenerateReversal: failed to load original lines: ${res.ErrorMessage}`);
    }
    for (const orig of res.Results) {
      const line = await metaProvider.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
      line.NewRecord();
      line.JournalEntryID = reversalId;
      line.LineNumber = orig.LineNumber;
      line.GLAccountID = orig.GLAccountID;
      line.DebitAmount = orig.CreditAmount; // SWAP
      line.CreditAmount = orig.DebitAmount; // SWAP
      line.Description = `Reversal of line ${orig.LineNumber}`;
      const ok = await line.Save();
      if (!ok) {
        throw new Error(`GenerateReversal: failed to save reversed line ${orig.LineNumber}: ${line.LatestResult?.CompleteMessage ?? 'unknown'}`);
      }
    }
  }

  private async BackReferenceReversal(reversalId: string): Promise<void> {
    this.ReversedByJournalEntryID = reversalId;
    const ok = await super.Save();
    if (!ok) {
      LogError(`GenerateReversal: failed to set ReversedByJournalEntryID on ${this.EntryNumber}: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
  }
}
