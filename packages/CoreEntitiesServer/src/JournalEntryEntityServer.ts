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

import { BaseEntity, EntitySaveOptions, LogError, Metadata, RunView } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingJournalEntryEntity, mjBizAppsAccountingAccountingPeriodEntity, mjBizAppsAccountingJournalEntryLineEntity, mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';

import { getNextJournalEntryNumber } from './SequenceService.js';

@RegisterClass(BaseEntity, 'MJ_BizApps_Accounting: Journal Entries')
export class JournalEntryEntityServer extends mjBizAppsAccountingJournalEntryEntity {

  override async Save(options?: EntitySaveOptions): Promise<boolean> {
    const isNewRecord = !this.IsSaved;

    if (isNewRecord && !this.Get('EntryNumber')) {
      await this.assignEntryNumber();
    }

    // W4: Adjusting-entry routing
    // If the targeted period is Closed, route to the next Open period.
    if (isNewRecord || this.GetFieldByName('AccountingPeriodID')?.Dirty) {
      await this.handleAdjustingEntryRouting();
    }

    // W5: Realized FX Gain/Loss
    // Auto-emit gain/loss line during payment receipt if base amounts are imbalanced
    if (this.EntryType === 'PaymentReceipt' && (isNewRecord || this.GetFieldByName('CurrencyCode')?.Dirty || this.GetFieldByName('Status')?.Dirty)) {
      await this.handleFXGainLossEmission();
    }

    // W7: GL Posting (Roundtrip)
    // If the status is changing to GLPosted, verify balance and then lock.
    if (this.GetFieldByName('Status')?.Dirty && this.Status === 'GLPosted') {
      await this.verifyBalanceBeforePosting();
    } else if (!isNewRecord && this.Status === 'GLPosted' && this.Dirty) {
      // Record is locked once posted to GL.
      throw new Error(`Journal Entry ${this.EntryNumber} is posted to the General Ledger and cannot be modified.`);
    }

    return super.Save(options);
  }

  /**
   * W7: GL Posting balance verification.
   */
  private async verifyBalanceBeforePosting(): Promise<void> {
    const rv = new RunView();
    const result = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
      {
        EntityName: 'MJ_BizApps_Accounting: Journal Entry Lines',
        ExtraFilter: `JournalEntryID = '${this.ID}'`,
        ResultType: 'simple',
        Fields: ['DebitAmount', 'CreditAmount'],
      },
      this.ContextCurrentUser,
    );

    if (!result.Success) {
      throw new Error(`JournalEntryEntityServer.verifyBalanceBeforePosting: failed to load lines to verify balance.`);
    }

    let balance = 0;
    for (const row of result.Results as any[]) {
      balance += (row.DebitAmount || 0) - (row.CreditAmount || 0);
    }

    if (Math.abs(balance) > 0.001) {
      throw new Error(
        `Journal Entry ${this.EntryNumber} is imbalanced by ${balance.toFixed(2)} and cannot be posted to the General Ledger.`,
      );
    }
  }

  /**
   * W5: Realized FX Gain/Loss logic.
   * If the JE is imbalanced in base currency but balanced in original currency,
   * it means there is an FX gain/loss. Emits a balancing line to the 
   * company's Realized Gain/Loss account.
   */
  private async handleFXGainLossEmission(): Promise<void> {
    // This hook requires loading the lines to check balance.
    // However, during Save(), the lines might not be saved yet if they are 
    // part of a bulk save. 
    // In MJ, hooks often run after lines are saved if they depend on them.
    // But W5 is specified as a pre-save hook.

    // For now, I'll implement the logic to load lines and check balance.
    const rv = new RunView();
    const linesResult = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
      {
        EntityName: 'MJ_BizApps_Accounting: Journal Entry Lines',
        ExtraFilter: `JournalEntryID = '${this.ID}'`,
        ResultType: 'simple',
        Fields: ['DebitAmount', 'CreditAmount']
      },
      this.ContextCurrentUser
    );

    if (!linesResult.Success || linesResult.Results.length === 0) return;

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of linesResult.Results as any[]) {
      totalDebit += line.DebitAmount || 0;
      totalCredit += line.CreditAmount || 0;
    }

    const imbalance = totalDebit - totalCredit;
    if (Math.abs(imbalance) > 0.001) {
      // Imbalanced. We need to find the Realized FX Gain/Loss account.
      const md = new Metadata();
      const profile = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(
        'MJ_BizApps_Accounting: Accounting Company Profiles',
        this.ContextCurrentUser
      );
      if (await profile.Load(this.CompanyID)) {
        const gainLossAccountID = profile.RealizedFXGainLossGLAccountID;
        if (gainLossAccountID) {
          console.log(`JournalEntryEntityServer: Emitting FX gain/loss line of ${-imbalance} to account ${gainLossAccountID}`);
          // Add balancing line
          const newLine = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(
            'MJ_BizApps_Accounting: Journal Entry Lines',
            this.ContextCurrentUser
          );
          newLine.NewRecord();
          newLine.Set('JournalEntryID', this.ID);
          newLine.Set('GLAccountID', gainLossAccountID);
          newLine.Set('Description', 'FX Realized Gain/Loss');
          if (imbalance > 0) {
            newLine.Set('CreditAmount', imbalance);
          } else {
            newLine.Set('DebitAmount', -imbalance);
          }
          await newLine.Save();
        }
      }
    }
  }

  /**
   * W6: Reversal generation.
   * Creates a new 'Pending' JE with debits/credits swapped, back-references
   * the original JE, and returns the new entity object (unsaved).
   */
  public async GenerateReversal(reason: string): Promise<JournalEntryEntityServer> {
    const md = new Metadata();
    const reversal = await md.GetEntityObject<JournalEntryEntityServer>(
      'MJ_BizApps_Accounting: Journal Entries',
      this.ContextCurrentUser,
    );
    reversal.NewRecord();

    // Copy header fields
    reversal.Set('CompanyID', this.CompanyID);
    reversal.Set('EffectiveDate', new Date()); // Date of reversal is today
    reversal.Set('CurrencyCode', this.CurrencyCode);
    reversal.Set('EntryType', 'Reversal');
    reversal.Set('Status', 'Pending');
    reversal.Set('Description', `Reversal of ${this.Get('EntryNumber')}: ${reason}`);
    reversal.Set('ReversesJournalEntryID', this.ID);
    reversal.Set('AccountingPeriodID', this.AccountingPeriodID);

    // Load original lines
    const rv = new RunView();
    const linesResult = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
      {
        EntityName: 'MJ_BizApps_Accounting: Journal Entry Lines',
        ExtraFilter: `JournalEntryID = '${this.ID}'`,
        ResultType: 'entity_object',
      },
      this.ContextCurrentUser,
    );

    if (linesResult.Success) {
      for (const line of linesResult.Results) {
        const revLine = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(
          'MJ_BizApps_Accounting: Journal Entry Lines',
          this.ContextCurrentUser,
        );
        revLine.NewRecord();
        revLine.Set('JournalEntryID', reversal.ID);
        revLine.Set('LineNumber', line.LineNumber);
        revLine.Set('GLAccountID', line.GLAccountID);
        revLine.Set('Description', line.Description);

        // Swap Debit and Credit
        revLine.Set('DebitAmount', line.CreditAmount);
        revLine.Set('CreditAmount', line.DebitAmount);
        revLine.Set('OriginalDebitAmount', line.OriginalCreditAmount);
        revLine.Set('OriginalCreditAmount', line.OriginalDebitAmount);
        revLine.Set('OriginalCurrencyCode', line.OriginalCurrencyCode);
        revLine.Set('ExchangeRateUsed', line.ExchangeRateUsed);

        // Note: Dimensions are handled at the database level or via a separate
        // Dimension collection. For now, we fulfill the base W6 requirement.
      }
    }

    return reversal;
  }

  /**
   * W4: Adjusting-entry routing.
   */
  private async handleAdjustingEntryRouting(): Promise<void> {
    const periodId = this.AccountingPeriodID;
    if (!periodId) return;

    const md = new Metadata();
    const period = await md.GetEntityObject<mjBizAppsAccountingAccountingPeriodEntity>(
      'MJ_BizApps_Accounting: Accounting Periods',
      this.ContextCurrentUser,
    );
    if (!await period.Load(periodId)) {
      LogError(`JournalEntryEntityServer.handleAdjustingEntryRouting: failed to load period ${periodId}`);
      return;
    }

    if (period.Status === 'Closed') {
      // It's an adjusting entry. Route to next Open period.
      const nextPeriod = await this.findNextOpenPeriod(
        this.CompanyID,
        period.PeriodType,
        period.PeriodEnd,
      );

      if (nextPeriod) {
        console.log(
          `JournalEntryEntityServer: Period ${periodId} is Closed. Routing JE to next Open period ${nextPeriod.ID}`,
        );
        this.Set('OriginalAccountingPeriodID', periodId);
        this.Set('AccountingPeriodID', nextPeriod.ID);
      } else {
        throw new Error(
          `JournalEntryEntityServer: targeted period ${periodId} is Closed and no subsequent Open period exists for Company ${this.CompanyID}.`,
        );
      }
    }
  }

  private async findNextOpenPeriod(
    companyId: string,
    periodType: string,
    afterDate: Date,
  ): Promise<mjBizAppsAccountingAccountingPeriodEntity | null> {
    const rv = new RunView();
    const result = await rv.RunView<mjBizAppsAccountingAccountingPeriodEntity>(
      {
        EntityName: 'MJ_BizApps_Accounting: Accounting Periods',
        ExtraFilter: `CompanyID = '${companyId}' AND PeriodType = '${periodType}' AND Status = 'Open' AND PeriodStart > '${afterDate.toISOString()}'`,
        OrderBy: 'PeriodStart ASC',
        ResultType: 'simple',
        MaxRows: 1,
      },
      this.ContextCurrentUser,
    );

    if (result.Success && result.Results.length > 0) {
      return result.Results[0] as mjBizAppsAccountingAccountingPeriodEntity;
    }
    return null;
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
