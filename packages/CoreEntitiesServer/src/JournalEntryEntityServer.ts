/**
 * Server-side subclass of JournalEntry.
 *
 * Pre-save: when this is a new record and EntryNumber is empty, calls the
 * DB-level atomic counter sproc `spAssignNextJournalEntryNumber` and writes
 * the resulting 'JE-{CompanyCode}-{FY}-{seq:000000}' onto the entity. The
 * resulting Save() flows through BaseEntity so `__mj.RecordChange` captures
 * the create.
 *
 * Subsequent saves (status transitions, GL roundtrip) do not re-number.
 *
 * Additional lifecycle hooks (FX gain/loss auto-emit, adjusting-entry
 * routing, reversal generation) live in this same class but are stubbed
 * here — see workflows-and-agents.plan.md W4–W6 for the full design.
 */

import { BaseEntity, EntitySaveOptions, LogError } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';

import { getNextJournalEntryNumber } from './SequenceService.js';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entries')
export class JournalEntryEntityServer extends mjBizAppsAccountingJournalEntryEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    if (!this.IsSaved && !this.Get('EntryNumber')) {
      await this.assignEntryNumber();
    }
    return super.Save(options);
  }

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

    const entryNumber = await getNextJournalEntryNumber(
      companyId,
      fiscalYear,
      this.ContextCurrentUser,
    );
    this.Set('EntryNumber', entryNumber);
  }

  /**
   * Pull fiscal year from the in-memory EffectiveDate. Caller must set
   * EffectiveDate before save (it's NOT NULL on the table anyway).
   */
  private deriveFiscalYear(): number {
    const raw = this.Get('EffectiveDate');
    if (!raw) {
      throw new Error(
        'JournalEntryEntityServer.deriveFiscalYear: EffectiveDate must be set before save (NOT NULL constraint)',
      );
    }
    const d = raw instanceof Date ? raw : new Date(raw as string);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`JournalEntryEntityServer.deriveFiscalYear: invalid EffectiveDate value: ${String(raw)}`);
    }
    return d.getUTCFullYear();
  }
}
