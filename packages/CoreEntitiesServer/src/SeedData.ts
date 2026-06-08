/**
 * Static seed data for new AccountingCompanyProfile rows.
 *
 * Deployments that need a different starter chart can override the
 * `AccountingCompanyProfileEntityServer` via @RegisterClass with a higher
 * priority and replace `getChartOfAccountsToSeed()`.
 * Plan reference: §4.1 (COA).
 */

export interface SeededGLAccount {
  code: string;
  name: string;
  accountType:
    | 'Asset'
    | 'Liability'
    | 'Equity'
    | 'Revenue'
    | 'Expense'
    | 'ContraAsset'
    | 'ContraLiability'
    | 'ContraRevenue'
    | 'ContraExpense'
    | 'Statistical';
}

export const DEFAULT_CHART_OF_ACCOUNTS: ReadonlyArray<SeededGLAccount> = [
  { code: '11101', name: 'Operating Cash',                       accountType: 'Asset' },
  { code: '11201', name: 'Accounts Receivable',                  accountType: 'Asset' },
  { code: '11211', name: 'Accounts Receivable - Intercompany',   accountType: 'Asset' },
  { code: '11301', name: 'Deferred Costs',                       accountType: 'Asset' },
  { code: '21101', name: 'Accounts Payable',                     accountType: 'Liability' },
  { code: '21201', name: 'Sales Tax Payable',                    accountType: 'Liability' },
  { code: '21202', name: 'VAT Payable',                          accountType: 'Liability' },
  { code: '21301', name: 'Deferred Revenue',                     accountType: 'Liability' },
  { code: '21401', name: 'Commission Payable',                   accountType: 'Liability' },
  { code: '21402', name: 'Partner Rev Share Payable',            accountType: 'Liability' },
  { code: '21501', name: 'Intercompany Payable',                 accountType: 'Liability' },
  { code: '40100', name: 'Sales Revenue',                        accountType: 'Revenue' },
  { code: '40200', name: 'Subscription Revenue',                 accountType: 'Revenue' },
  { code: '40300', name: 'Services Revenue',                     accountType: 'Revenue' },
  { code: '40400', name: 'Distribution Income',                  accountType: 'Revenue' },
  { code: '40500', name: 'Management Fee Revenue',               accountType: 'Revenue' },
  { code: '40900', name: 'Other Revenue',                        accountType: 'Revenue' },
  { code: '50100', name: 'Sales Commission Expense',             accountType: 'Expense' },
  { code: '50200', name: 'Partner Revenue Share Cost',           accountType: 'Expense' },
  { code: '50300', name: 'Bad Debt Expense',                     accountType: 'Expense' },
  { code: '50400', name: 'Realized FX Gain/Loss',                accountType: 'Expense' },
  { code: '50500', name: 'Unrealized FX Gain/Loss',              accountType: 'Expense' },
  { code: '90100', name: 'Refunds',                              accountType: 'ContraRevenue' },
];

/** Which GLAccount.Code the AccountingCompanyProfile points at by default. */
export const DEFAULT_GL_ACCOUNT_REFS = {
  AROpen:           '11201',
  DeferredRevenue:  '21301',
  SalesTaxPayable:  '21201',
  RealizedFXGainLoss:   '50400',
  UnrealizedFXGainLoss: '50500',
} as const;

// NOTE: Recurring-JE template seeds were removed when the Recurring* tables were
// dropped (BA-D18 revision). Period-end accruals are now handled either by the
// ScheduledJournalEntry waterfall (finite, known-amount: amortization, etc.) or
// by programmatic engine actions (FX mark-to-market). See plan §4.9 / §6.4.
