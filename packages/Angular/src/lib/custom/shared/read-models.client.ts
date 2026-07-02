/**
 * ReadModelsClient — a thin, strongly-typed transport for the Block-6 read-model
 * queries exposed by `ReadModelsResolver` in `@mj-biz-apps/accounting-server`.
 *
 * Mirrors the stage-1 `BatchDispatchClient` convention (and MJ's `GraphQL<Feature>Client`):
 * each method builds the gql document, calls `provider.ExecuteGQL(query, variables)`, and
 * returns typed rows. The Angular dashboards never see a gql string. Errors are caught,
 * logged, and surfaced as `[]` (the dashboards render an empty/error state) rather than thrown.
 */
import { LogError } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';

export interface TrialBalanceRow {
  GLAccountID: string;
  GLAccountCode: string;
  GLAccountName: string;
  AccountType: string;
  TotalDebits: number;
  TotalCredits: number;
  NetBalance: number;
  EntryCount: number;
}

export interface AROpenByCustomerRow {
  CustomerOrganizationID: string | null;
  CustomerName: string | null;
  OpenBalance: number;
  TotalCharges: number;
  TotalPayments: number;
  EntryCount: number;
}

export interface ARAgingRow {
  CustomerOrganizationID: string | null;
  CustomerName: string | null;
  Current_0_30: number;
  Days_31_60: number;
  Days_61_90: number;
  Days_Over_90: number;
  TotalOpen: number;
}

export interface DefRevRollforwardRow {
  AccountingPeriodID: string;
  FiscalYear: number;
  PeriodType: string;
  PeriodStart: string | null;
  PeriodEnd: string | null;
  OpeningBalance: number;
  Additions: number;
  Releases: number;
  NetChange: number;
  ClosingBalance: number;
}

export interface SalesTaxLiabilityRow {
  TaxAuthorityID: string;
  AuthorityCode: string;
  AuthorityName: string;
  TaxJurisdictionID: string;
  JurisdictionCode: string;
  JurisdictionName: string;
  FiscalYear: number;
  PeriodType: string;
  AccruedAmount: number;
  RemittedAmount: number;
  OutstandingLiability: number;
  Status: string;
  DueDate: string | null;
  FilingFrequency: string | null;
}

export interface BatchDispatchStatusRow {
  BatchID: string;
  BatchNumber: string;
  FiscalYear: number;
  PeriodType: string;
  TargetSystem: string;
  Status: string;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  ExternalBatchRef: string | null;
  BatchedAt: string | null;
  SentAt: string | null;
  AcknowledgedAt: string | null;
  SummaryLineCount: number;
}

export interface IntercompanyFlowRow {
  IntercompanyFlowID: string | null;
  JournalEntryID: string;
  EntryNumber: string;
  CompanyName: string;
  EntryType: string;
  Status: string;
  EffectiveDate: string | null;
  LineNumber: number;
  CounterpartyName: string | null;
  GLAccountCode: string;
  GLAccountName: string;
  AccountType: string;
  DebitAmount: number | null;
  CreditAmount: number | null;
  LineDescription: string | null;
}

export class ReadModelsClient {
  private dataProvider: GraphQLDataProvider;

  constructor(dataProvider: GraphQLDataProvider) {
    this.dataProvider = dataProvider;
  }

  public TrialBalance(companyID: string): Promise<TrialBalanceRow[]> {
    return this.run<TrialBalanceRow>(
      'AccountingTrialBalance',
      'GLAccountID GLAccountCode GLAccountName AccountType TotalDebits TotalCredits NetBalance EntryCount',
      companyID,
    );
  }

  public AROpenByCustomer(companyID: string): Promise<AROpenByCustomerRow[]> {
    return this.run<AROpenByCustomerRow>(
      'AccountingAROpenByCustomer',
      'CustomerOrganizationID CustomerName OpenBalance TotalCharges TotalPayments EntryCount',
      companyID,
    );
  }

  public ARAging(companyID: string): Promise<ARAgingRow[]> {
    return this.run<ARAgingRow>(
      'AccountingARAging',
      'CustomerOrganizationID CustomerName Current_0_30 Days_31_60 Days_61_90 Days_Over_90 TotalOpen',
      companyID,
    );
  }

  public DefRevRollforward(companyID: string): Promise<DefRevRollforwardRow[]> {
    return this.run<DefRevRollforwardRow>(
      'AccountingDefRevRollforward',
      'AccountingPeriodID FiscalYear PeriodType PeriodStart PeriodEnd OpeningBalance Additions Releases NetChange ClosingBalance',
      companyID,
    );
  }

  public SalesTaxLiability(companyID: string): Promise<SalesTaxLiabilityRow[]> {
    return this.run<SalesTaxLiabilityRow>(
      'AccountingSalesTaxLiability',
      'TaxAuthorityID AuthorityCode AuthorityName TaxJurisdictionID JurisdictionCode JurisdictionName FiscalYear PeriodType AccruedAmount RemittedAmount OutstandingLiability Status DueDate FilingFrequency',
      companyID,
    );
  }

  public BatchDispatchStatus(companyID: string): Promise<BatchDispatchStatusRow[]> {
    return this.run<BatchDispatchStatusRow>(
      'AccountingBatchDispatchStatus',
      'BatchID BatchNumber FiscalYear PeriodType TargetSystem Status TotalEntries TotalDebits TotalCredits ExternalBatchRef BatchedAt SentAt AcknowledgedAt SummaryLineCount',
      companyID,
    );
  }

  public IntercompanyFlow(companyID: string): Promise<IntercompanyFlowRow[]> {
    return this.run<IntercompanyFlowRow>(
      'AccountingIntercompanyFlow',
      'IntercompanyFlowID JournalEntryID EntryNumber CompanyName EntryType Status EffectiveDate LineNumber CounterpartyName GLAccountCode GLAccountName AccountType DebitAmount CreditAmount LineDescription',
      companyID,
    );
  }

  /** Shared executor: run a company-scoped read-model query and return its typed rows ([] on error). */
  private async run<T>(queryName: string, fields: string, companyID: string): Promise<T[]> {
    try {
      const query = `query ${queryName}($companyID: ID!) { ${queryName}(companyID: $companyID) { ${fields} } }`;
      const res = await this.dataProvider.ExecuteGQL(query, { companyID });
      return (res?.[queryName] as T[]) ?? [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`ReadModelsClient.${queryName} failed: ${msg}`);
      return [];
    }
  }
}
