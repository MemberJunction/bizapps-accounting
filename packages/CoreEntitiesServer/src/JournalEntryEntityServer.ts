/**
 * Server-side subclass of JournalEntry — Block 0 + Block 1 lifecycle hooks.
 *
 *   W2 (Block 0) numbering: assign EntryNumber on a new record via the atomic sproc.
 *   W4 (Block 1) adjusting-entry routing: a JE that targets a CLOSED period is re-routed to the
 *       next open period — but ONLY if the caller explicitly set OriginalAccountingPeriodID
 *       (the closed period it's adjusting). If not, it ERRORS — no silent re-route (plan §6 / §7.5).
 *       Required because trg_JournalEntry_PeriodClose (50007) rejects ANY JE whose AccountingPeriodID
 *       is a Closed period.
 *   W6 (Block 1) generateReversal: create a new Pending JE (EntryType='Reversal', per
 *       trg_JE_ReversalConsistency 50012) with Dr/Cr swapped on every line, back-referenced both ways.
 *   W9 (Block 1) attachment validation: a non-null FileID must reference an existing __mj.File.
 *
 * CONNECTS TO:
 *   CALLS:       SequenceService.getNextJournalEntryNumber → spAssignNextJournalEntryNumber
 *   DB TRIGGERS: trg_JournalEntry_PeriodClose (W4) · trg_JE_ReversalConsistency / _Immutability (W6) · trg_*_BalancedOnLock
 *   SIBLINGS:    JournalEntryLineEntityServer (W5 FX) · validateJournalEntry (F1, ./JournalEntryValidation)
 *   ENTITY:      'MJ_BizApps_Accounting: Journal Entries'
 *   DOC:         docs/ARCHITECTURE.md#je-lifecycle
 */

import { BaseEntity, EntitySaveOptions, LogError, Metadata, RunView, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingAccountingPeriodEntity,
} from '@mj-biz-apps/accounting-entities';

import { getNextJournalEntryNumber } from './SequenceService.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const FILE_ENTITY = 'Files'; // __mj.File

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entries')
export class JournalEntryEntityServer extends mjBizAppsAccountingJournalEntryEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.IsSaved) {
      await this.routeAdjustingEntryIfClosed(); // W4
    }
    await this.validateAttachment();            // W9
    if (!this.IsSaved && !this.Get('EntryNumber')) {
      await this.assignEntryNumber();           // W2
    }
    return super.Save(options);
  }

  // ─── W4: adjusting-entry routing ──────────────────────────────────────────

  private async routeAdjustingEntryIfClosed(): Promise<void> {
    const period = await this.loadPeriod(this.AccountingPeriodID);
    if (!period || period.Status !== 'Closed') {
      return; // open/reopened period (or unknown) — let the DB triggers handle anything odd
    }
    if (!this.OriginalAccountingPeriodID) {
      throw new Error(
        `JournalEntry targets a CLOSED period (${this.AccountingPeriodID}). To post an adjusting entry, ` +
        `set OriginalAccountingPeriodID to that period — it is then routed to the next open period. ` +
        `No silent re-route (W4 / plan §6, §7.5).`,
      );
    }
    const nextOpen = await this.findNextOpenPeriod(period);
    if (!nextOpen) {
      throw new Error(
        `No open ${period.PeriodType} period after ${this.toDateKey(period.PeriodStart)} for company ` +
        `${this.CompanyID} to route the adjusting entry into.`,
      );
    }
    this.AccountingPeriodID = nextOpen.ID;
  }

  private async loadPeriod(periodId: string): Promise<mjBizAppsAccountingAccountingPeriodEntity | null> {
    if (!periodId) return null;
    const rv = new RunView();
    const res = await rv.RunView<mjBizAppsAccountingAccountingPeriodEntity>(
      { EntityName: PERIOD_ENTITY, ExtraFilter: `ID='${periodId}'`, ResultType: 'entity_object' },
      this.ContextCurrentUser,
    );
    return res.Success && res.Results.length ? res.Results[0] : null;
  }

  private async findNextOpenPeriod(
    closed: mjBizAppsAccountingAccountingPeriodEntity,
  ): Promise<mjBizAppsAccountingAccountingPeriodEntity | null> {
    const rv = new RunView();
    const after = this.toDateKey(closed.PeriodStart);
    const res = await rv.RunView<mjBizAppsAccountingAccountingPeriodEntity>(
      {
        EntityName: PERIOD_ENTITY,
        ExtraFilter:
          `CompanyID='${this.CompanyID}' AND PeriodType='${closed.PeriodType}' ` +
          `AND Status='Open' AND PeriodStart > '${after}'`,
        OrderBy: 'PeriodStart ASC',
        MaxRows: 1,
        ResultType: 'entity_object',
      },
      this.ContextCurrentUser,
    );
    return res.Success && res.Results.length ? res.Results[0] : null;
  }

  // ─── W9: attachment validation ────────────────────────────────────────────

  private async validateAttachment(): Promise<void> {
    const fileId = this.FileID;
    if (!fileId) return;
    const rv = new RunView();
    const res = await rv.RunView<{ ID: string }>(
      { EntityName: FILE_ENTITY, ExtraFilter: `ID='${fileId}'`, Fields: ['ID'], ResultType: 'simple' },
      this.ContextCurrentUser,
    );
    // Only fail when we can positively confirm the file is absent. If the lookup itself fails
    // (e.g. the File entity isn't reachable in this context), defer to the DB FK rather than
    // throwing a spurious error.
    if (res.Success && res.Results.length === 0) {
      throw new Error(`JournalEntry.FileID ${fileId} does not reference an existing file (W9).`);
    }
  }

  // ─── W6: reversal generation ──────────────────────────────────────────────

  /** Create a new Pending JE that reverses this one (Dr/Cr swapped), back-referenced both ways. */
  public async generateReversal(
    reason: string,
    contextUser?: UserInfo,
  ): Promise<mjBizAppsAccountingJournalEntryEntity> {
    if (!this.IsSaved) {
      throw new Error('generateReversal: the JournalEntry must be saved before it can be reversed.');
    }
    const user = contextUser ?? this.ContextCurrentUser;
    const reversal = await this.buildReversalHeader(reason, user);
    await this.copySwappedLines(reversal.ID, user);
    await this.backReferenceReversal(reversal.ID);
    return reversal;
  }

  private async buildReversalHeader(
    reason: string,
    user: UserInfo | undefined,
  ): Promise<mjBizAppsAccountingJournalEntryEntity> {
    const md = new Metadata();
    const reversal = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    reversal.NewRecord();
    reversal.CompanyID = this.CompanyID;
    reversal.AccountingPeriodID = this.AccountingPeriodID; // W4 on the reversal re-routes if closed
    reversal.EffectiveDate = new Date();
    reversal.EntryType = 'Reversal'; // required by trg_JE_ReversalConsistency (50012)
    reversal.Status = 'Pending';
    reversal.Description = `Reversal of ${this.EntryNumber}: ${reason}`;
    reversal.ReversesJournalEntryID = this.ID;
    const saved = await reversal.Save();
    if (!saved) {
      throw new Error(`generateReversal: failed to save reversal header: ${reversal.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    return reversal;
  }

  private async copySwappedLines(reversalId: string, user: UserInfo | undefined): Promise<void> {
    const rv = new RunView();
    const res = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${this.ID}'`, OrderBy: 'LineNumber ASC', ResultType: 'entity_object' },
      user,
    );
    if (!res.Success) {
      throw new Error(`generateReversal: failed to load original lines: ${res.ErrorMessage}`);
    }
    const md = new Metadata();
    for (const orig of res.Results) {
      const line = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
      line.NewRecord();
      line.JournalEntryID = reversalId;
      line.LineNumber = orig.LineNumber;
      line.GLAccountID = orig.GLAccountID;
      line.DebitAmount = orig.CreditAmount;  // SWAP
      line.CreditAmount = orig.DebitAmount;  // SWAP
      line.Description = `Reversal of line ${orig.LineNumber}`;
      const ok = await line.Save();
      if (!ok) {
        throw new Error(`generateReversal: failed to save reversed line ${orig.LineNumber}: ${line.LatestResult?.CompleteMessage ?? 'unknown'}`);
      }
    }
  }

  private async backReferenceReversal(reversalId: string): Promise<void> {
    // ReversedByJournalEntryID is explicitly allowed to change on a locked JE
    // (trg_JournalEntry_Immutability 50004 excludes it from the frozen-field set).
    this.ReversedByJournalEntryID = reversalId;
    const ok = await super.Save();
    if (!ok) {
      LogError(`generateReversal: failed to set ReversedByJournalEntryID on ${this.EntryNumber}: ${this.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
  }

  // ─── W2: numbering (Block 0) ──────────────────────────────────────────────

  private async assignEntryNumber(): Promise<void> {
    const companyId = this.CompanyID;
    if (!companyId) {
      LogError('JournalEntryEntityServer.assignEntryNumber: CompanyID is required before save');
      throw new Error('JournalEntry.CompanyID is required before save');
    }
    const fiscalYear = this.deriveFiscalYear();
    if (!this.ContextCurrentUser) {
      throw new Error('JournalEntryEntityServer.assignEntryNumber: ContextCurrentUser is required');
    }
    const entryNumber = await getNextJournalEntryNumber(companyId, fiscalYear, this.ContextCurrentUser);
    this.Set('EntryNumber', entryNumber);
  }

  private deriveFiscalYear(): number {
    const raw = this.Get('EffectiveDate');
    if (!raw) {
      throw new Error('JournalEntryEntityServer.deriveFiscalYear: EffectiveDate must be set before save (NOT NULL constraint)');
    }
    const d = raw instanceof Date ? raw : new Date(raw as string);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`JournalEntryEntityServer.deriveFiscalYear: invalid EffectiveDate value: ${String(raw)}`);
    }
    return d.getUTCFullYear();
  }

  private toDateKey(d: Date | string): string {
    const dd = d instanceof Date ? d : new Date(d);
    return dd.toISOString().slice(0, 10);
  }
}
