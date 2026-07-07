/**
 * Server-side subclass of JournalEntry — Block 0 + Block 1 lifecycle hooks.
 *
 *   W2 (Block 0) numbering: assign EntryNumber on a new record via the atomic sproc
 *       (GLOBAL per-fiscal-year sequence — D-SEQ 2026-07-06: JEs are multi-company).
 *   W6 (Block 1) generateReversal: create a new Pending JE (EntryType='Reversal', per
 *       trg_JE_ReversalConsistency 50012) with Dr/Cr swapped on every line, back-referenced both ways.
 *   W9 (Block 1) attachment validation: a non-null FileID must reference an existing __mj.File.
 *
 *   (W4 adjusting-entry routing was RETIRED 2026-07-06 with the AccountingPeriod removal —
 *    the ERP owns periods; there is nothing to route around. Engine-meeting ruling CH-1.)
 *
 * CONNECTS TO:
 *   CALLS:       SequenceService.getNextJournalEntryNumber → spAssignNextJournalEntryNumber
 *   DB TRIGGERS: trg_JE_ReversalConsistency / _Immutability (W6) · trg_*_BalancedOnLock (incl. AM-4 per-company)
 *   SIBLINGS:    validateJournalEntry (F1, ./JournalEntryValidation)
 *   ENTITY:      'MJ_BizApps_Accounting: Journal Entries'
 *   DOC:         docs/ARCHITECTURE.md#je-lifecycle
 */

import { BaseEntity, EntitySaveOptions, LogError, Metadata, RunView, UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';

import { getNextJournalEntryNumber } from './SequenceService.js';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const FILE_ENTITY = 'Files'; // __mj.File

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entries')
export class JournalEntryEntityServer extends mjBizAppsAccountingJournalEntryEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    await this.validateAttachment();            // W9
    if (!this.IsSaved && !this.EntryNumber) {
      await this.assignEntryNumber();           // W2
    }
    return super.Save(options);
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
    const fiscalYear = this.deriveFiscalYear();
    if (!this.ContextCurrentUser) {
      throw new Error('JournalEntryEntityServer.assignEntryNumber: ContextCurrentUser is required');
    }
    const entryNumber = await getNextJournalEntryNumber(fiscalYear, this.ContextCurrentUser);
    this.EntryNumber = entryNumber;
  }

  private deriveFiscalYear(): number {
    const effectiveDate = this.EffectiveDate;
    if (!effectiveDate) {
      throw new Error('JournalEntryEntityServer.deriveFiscalYear: EffectiveDate must be set before save (NOT NULL constraint)');
    }
    // Defensive: a raw-loaded value can arrive as an ISO string at runtime despite the Date type.
    const d = effectiveDate instanceof Date ? effectiveDate : new Date(effectiveDate);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`JournalEntryEntityServer.deriveFiscalYear: invalid EffectiveDate value: ${String(effectiveDate)}`);
    }
    return d.getUTCFullYear();
  }
}
