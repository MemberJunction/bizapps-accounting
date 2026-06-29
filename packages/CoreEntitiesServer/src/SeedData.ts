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

// Minimal AR-subledger starter chart (Block 0 — AD-8 + plan Conflict-Resolution §C1).
// Trimmed from the original 23-account illustrative set down to the essential
// AR-subledger accounts. The dropped accounts are GL/P&L accounts the ERP owns and
// that sync from Business Central rather than being seeded here (AD-1: subledger, not
// a GL): Accounts Payable (21101), VAT Payable (21202), Bad Debt (50300), Refunds
// (90100), the commission/partner-rev-share *expense* legs (50100/50200), Deferred
// Costs (11301), and the extra revenue accounts (40300/40400/40500/40900).
//
// The intercompany Due-To/Due-From accounts (formerly 11211 / 21501) are intentionally
// NOT in this single-company starter set: per §C1 they are PER-COMPANY-PAIR accounts
// provisioned separately (mechanism = open question OQ-A), not a flat seed, and the
// balancing legs are generated upstream (Orders/Payments), not by Accounting.
export const DEFAULT_CHART_OF_ACCOUNTS: ReadonlyArray<SeededGLAccount> = [
  { code: '11101', name: 'Operating Cash',            accountType: 'Asset' },
  { code: '11201', name: 'Accounts Receivable',       accountType: 'Asset' },
  { code: '21201', name: 'Sales Tax Payable',         accountType: 'Liability' },
  { code: '21301', name: 'Deferred Revenue',          accountType: 'Liability' },
  { code: '21401', name: 'Commission Payable',        accountType: 'Liability' },
  { code: '21402', name: 'Partner Rev Share Payable', accountType: 'Liability' },
  { code: '40100', name: 'Sales Revenue',             accountType: 'Revenue' },
  { code: '40200', name: 'Subscription Revenue',      accountType: 'Revenue' },
  { code: '50400', name: 'Realized FX Gain/Loss',     accountType: 'Expense' },
  { code: '50500', name: 'Unrealized FX Gain/Loss',   accountType: 'Expense' },
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
