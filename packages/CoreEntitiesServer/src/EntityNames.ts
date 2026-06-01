/**
 * Canonical MJ entity-name strings for BizApps Accounting.
 *
 * Used by EntityServer subclasses' @RegisterClass decorators and by every
 * `Metadata.GetEntityObject<T>(EntityNames.X, ctx)` call from the lifecycle
 * hooks. The names match what CodeGen produces from the schema-info row
 * (EntityNamePrefix='MJ_BizApps_Accounting: ') and the singularized table
 * names.
 */
export const EntityNames = {
  AccountingCompanyProfile: 'MJ_BizApps_Accounting: Accounting Company Profiles',
  GLAccount:                'MJ_BizApps_Accounting: GLAccounts',
  AccountingPeriod:         'MJ_BizApps_Accounting: Accounting Periods',
  JournalEntry:             'MJ_BizApps_Accounting: Journal Entries',
  JournalEntryLine:         'MJ_BizApps_Accounting: Journal Entry Lines',
  JournalEntryBatch:        'MJ_BizApps_Accounting: Journal Entry Batches',
  Dimension:                'MJ_BizApps_Accounting: Dimensions',
  DimensionValue:           'MJ_BizApps_Accounting: Dimension Values',
  JournalEntryLineDimension:'MJ_BizApps_Accounting: Journal Entry Line Dimensions',
  ChartOfAccountsMapping:   'MJ_BizApps_Accounting: Chart Of Accounts Mappings',
  RecurringJournalEntryTemplate:     'MJ_BizApps_Accounting: Recurring Journal Entry Templates',
  RecurringJournalEntryTemplateLine: 'MJ_BizApps_Accounting: Recurring Journal Entry Template Lines',
  RecurringJournalEntry:    'MJ_BizApps_Accounting: Recurring Journal Entries',
  TaxAuthority:             'MJ_BizApps_Accounting: Tax Authorities',
  TaxJurisdiction:          'MJ_BizApps_Accounting: Tax Jurisdictions',
  TaxRate:                  'MJ_BizApps_Accounting: Tax Rates',
  TaxLiability:             'MJ_BizApps_Accounting: Tax Liabilities',
  TaxRemittance:            'MJ_BizApps_Accounting: Tax Remittances',
  CustomerTaxProfile:       'MJ_BizApps_Accounting: Customer Tax Profiles',
  AccountBalance:           'MJ_BizApps_Accounting: Account Balances',
  AccountBalanceByDimension:'MJ_BizApps_Accounting: Account Balances By Dimension',
} as const;
