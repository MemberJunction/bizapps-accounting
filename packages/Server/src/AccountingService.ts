import { LogError, Metadata, RunView, TransactionGroupBase } from '@memberjunction/core';
import { UserInfo } from '@memberjunction/core';
import {
    mjBizAppsAccountingJournalEntryEntity,
    mjBizAppsAccountingJournalEntryLineEntity,
    mjBizAppsAccountingAccountingPeriodEntity
} from '@mj-biz-apps/accounting-entities';
import { JournalEntryEntityServer } from '@mj-biz-apps/accounting-core-entities-server';

/**
 * AccountingService Façade
 * 
 * Provides a high-level TypeScript API for downstream BizApps (Orders, Inventory)
 * to interact with the accounting system without needing to know the underlying
 * entity structure.
 * 
 * Implements the "Integration Contract" (BA-D27).
 */
export class AccountingService {
    private _contextUser: UserInfo;

    constructor(contextUser: UserInfo) {
        this._contextUser = contextUser;
    }

    /**
     * Create a Journal Entry with lines in a single operation.
     * Wraps header and lines in a transaction.
     */
    public async CreateJournalEntry(params: {
        CompanyID: string;
        AccountingPeriodID: string;
        EffectiveDate: Date;
        Description: string;
        EntryType: 'General' | 'Adjusting' | 'Reversal' | 'PaymentReceipt' | 'OpeningBalance';
        CurrencyCode: string;
        Lines: {
            GLAccountID: string;
            DebitAmount?: number;
            CreditAmount?: number;
            Description?: string;
            // Optional original currency amounts
            OriginalDebitAmount?: number;
            OriginalCreditAmount?: number;
            OriginalCurrencyCode?: string;
            ExchangeRateUsed?: number;
        }[];
    }): Promise<{ Success: boolean; JournalEntryID?: string; Message?: string }> {
        const md = new Metadata();
        const tg = await md.CreateTransactionGroup();

        try {
            const je = await md.GetEntityObject<JournalEntryEntityServer>(
                'MJ_BizApps_Accounting: Journal Entries',
                this._contextUser
            );
            je.NewRecord();
            je.TransactionGroup = tg;

            je.Set('CompanyID', params.CompanyID);
            je.Set('AccountingPeriodID', params.AccountingPeriodID);
            je.Set('EffectiveDate', params.EffectiveDate);
            je.Set('Description', params.Description);
            je.Set('EntryType', params.EntryType);
            je.Set('CurrencyCode', params.CurrencyCode);
            je.Set('Status', 'Pending');

            for (const lineParams of params.Lines) {
                const line = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(
                    'MJ_BizApps_Accounting: Journal Entry Lines',
                    this._contextUser
                );
                line.NewRecord();
                line.TransactionGroup = tg;

                line.Set('JournalEntryID', je.ID);
                line.Set('GLAccountID', lineParams.GLAccountID);
                line.Set('DebitAmount', lineParams.DebitAmount);
                line.Set('CreditAmount', lineParams.CreditAmount);
                line.Set('Description', lineParams.Description || params.Description);

                if (lineParams.OriginalCurrencyCode) {
                    line.Set('OriginalDebitAmount', lineParams.OriginalDebitAmount);
                    line.Set('OriginalCreditAmount', lineParams.OriginalCreditAmount);
                    line.Set('OriginalCurrencyCode', lineParams.OriginalCurrencyCode);
                    line.Set('ExchangeRateUsed', lineParams.ExchangeRateUsed);
                }
            }

            const success = await tg.Submit();
            if (success) {
                return { Success: true, JournalEntryID: je.ID };
            } else {
                return { Success: false, Message: 'Transaction failed during Submit' };
            }
        } catch (error: any) {
            LogError(`AccountingService.CreateJournalEntry: ${error.message}`);
            return { Success: false, Message: error.message };
        }
    }

    /**
     * Status change to GLPosted. This triggers the W7 balance check and lock.
     */
    public async PostJournalEntry(jeId: string): Promise<{ Success: boolean; Message?: string }> {
        const md = new Metadata();
        const je = await md.GetEntityObject<JournalEntryEntityServer>(
            'MJ_BizApps_Accounting: Journal Entries',
            this._contextUser
        );

        if (!await je.Load(jeId)) {
            return { Success: false, Message: `Journal Entry ${jeId} not found.` };
        }

        if (je.Status !== 'Pending') {
            return { Success: false, Message: `Only Pending Journal Entries can be posted. Current status: ${je.Status}` };
        }

        je.Set('Status', 'GLPosted');
        const saved = await je.Save();

        if (saved) {
            return { Success: true };
        } else {
            return { Success: false, Message: je.LatestResult?.Message || 'Failed to post Journal Entry' };
        }
    }
}
