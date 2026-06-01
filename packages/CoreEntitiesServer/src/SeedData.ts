/**
 * Static seed data for new AccountingCompanyProfile rows.
 *
 * Deployments that need a different starter chart can override the
 * `AccountingCompanyProfileEntityServer` via @RegisterClass with a higher
 * priority and replace `getDefaultChartOfAccounts()` / `getDefaultRecurringTemplates()`.
 * Plan reference: §4.1 (COA), §4.9 (recurring templates).
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

export interface SeededRecurringTemplate {
  name: string;
  description: string;
  entryType:
    | 'FXRevaluation'
    | 'PeriodEndAccrual'
    | 'CommissionAccrual'
    | 'PartnerRevShare'
    | 'Manual';
  amountCalculationType: 'Fixed' | 'Formula' | 'ExternalLookup';
}

export const DEFAULT_RECURRING_TEMPLATES: ReadonlyArray<SeededRecurringTemplate> = [
  {
    name: 'Monthly FX Revaluation',
    description:
      'Revalues open foreign-currency balances at period-end spot rate; reverses at start of next period to avoid compounding.',
    entryType: 'FXRevaluation',
    amountCalculationType: 'ExternalLookup',
  },
  {
    name: 'Monthly Prepaid Amortization',
    description:
      'Amortizes prepaid balances on a straight-line basis. Customize per deployment to point at your prepaid schedule.',
    entryType: 'PeriodEndAccrual',
    amountCalculationType: 'Formula',
  },
  {
    name: 'Monthly Depreciation Accrual',
    description:
      'Records depreciation accruals. First-class FixedAsset entity is out of scope for v1; deployments wire to their own register.',
    entryType: 'PeriodEndAccrual',
    amountCalculationType: 'Formula',
  },
  {
    name: 'Monthly Sales Tax Liability Snapshot',
    description:
      'Rolls forward open TaxLiability balances each period.',
    entryType: 'PeriodEndAccrual',
    amountCalculationType: 'ExternalLookup',
  },
];
