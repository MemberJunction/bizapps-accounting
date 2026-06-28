import { LogError, Metadata, RunView, UserInfo } from '@memberjunction/core';
import {
    mjBizAppsAccountingAccountBalanceEntity
} from '@mj-biz-apps/accounting-entities';

/**
 * Service for accounting reporting (Read-Model Views).
 * 
 * Implements logic for Trial Balance and related reports as defined in BA-D27.
 * Provides a programmatic alternative to vwTrialBalance for server-side consumers.
 */
export class ReportingService {
    /**
     * Retrieves the Trial Balance for a specific period and company.
     * 
     * Joins Account Balance data with GL Account metadata to provide a high-level report.
     */
    public async getTrialBalance(params: {
        companyId: string,
        periodId: string
    }, contextUser: UserInfo): Promise<any[]> {
        const rv = new RunView();

        // 1. Fetch all materialized balances for the period
        const result = await rv.RunView<mjBizAppsAccountingAccountBalanceEntity>({
            EntityName: 'MJ_BizApps_Accounting: Account Balances',
            ExtraFilter: `CompanyID = '${params.companyId}' AND AccountingPeriodID = '${params.periodId}'`,
            ResultType: 'simple'
        }, contextUser);

        if (!result.Success) {
            LogError(`Reporting: Failed to load account balances for period ${params.periodId}: ${result.ErrorMessage}`);
            return [];
        }

        // 2. Format trial balance rows
        // In a production MJ environment, 'GLAccount' and 'GLAccountCode' would be virtual fields 
        // populated by the UI-View or a specific reporting sproc.
        return result.Results.map(balance => {
            const debit = Number(balance.Get('DebitBalance') || 0);
            const credit = Number(balance.Get('CreditBalance') || 0);
            const net = Number(balance.Get('NetBalance') || 0);

            return {
                AccountID: balance.Get('GLAccountID'),
                AccountCode: balance.Get('GLAccountCode'),
                AccountName: balance.Get('GLAccount'),
                Debit: debit,
                Credit: credit,
                NetBalance: net,
                IsBalanced: (debit - credit - net) === 0
            };
        });
    }
}
