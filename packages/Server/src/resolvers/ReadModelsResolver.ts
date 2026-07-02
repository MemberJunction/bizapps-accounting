/**
 * ReadModelsResolver — the thin, read-only GraphQL boundary for the Block 6
 * read-model VIEWS (the `vw_*` reporting views in `__mj_BizAppsAccounting`),
 * powering the Stage-2 Explorer dashboards (Trial Balance / AR, Revenue & Tax,
 * Batch Status, Intercompany Flow).
 *
 * WHY a thin resolver SELECT (not MJ Queries):
 *   - These `vw_*` are reporting DB views, NOT entities (no CodeGen, no entity metadata).
 *   - Stage 1 (BatchDispatch) established the engine→resolver→thin-GQL-client→thin-UI
 *     transport for this app; this mirrors it for the read side, so the whole app has ONE
 *     transport convention. (MJ Queries would mean new `MJ: Queries` metadata + generated
 *     types + a codegen run, and a different invocation path — needless divergence for a
 *     handful of parameterized read views.)
 *   - It needs ZERO schema/codegen: the views already exist (migrations V0.1.1–V0.1.3) and
 *     the demo seed verifies all six populate (see test-harnesses/server/seed-demo.ts).
 *
 * Per the MJ Transport-Layer guide this resolver is thin: it (1) extracts the per-request
 * user via `ResolverBase.GetUserFromPayload`, (2) runs a parameterized SELECT through the
 * provider's `ExecuteSQL` (named-object params, like SequenceService), and (3) maps rows to a
 * typed `@ObjectType`. No business logic lives here — the views ARE the logic.
 */
// type-graphql decorators are re-exported through @memberjunction/server (`export * from 'type-graphql'`),
// matching the generated + BatchDispatch resolvers — type-graphql is not a direct dep of this package.
import {
  Resolver, Query, Arg, Ctx, ObjectType, Field, ID, Int, Float,
  AppContext, ResolverBase,
} from '@memberjunction/server';
import { LogError, Metadata, UserInfo } from '@memberjunction/core';
import { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';

const SCHEMA = '__mj_BizAppsAccounting';

// ─── object types (one per view, fields = the view's columns) ────────────────

@ObjectType()
export class TrialBalanceRow {
  @Field(() => ID) GLAccountID: string;
  @Field() GLAccountCode: string;
  @Field() GLAccountName: string;
  @Field() AccountType: string;
  @Field(() => Float) TotalDebits: number;
  @Field(() => Float) TotalCredits: number;
  @Field(() => Float) NetBalance: number;
  @Field(() => Int) EntryCount: number;
}

@ObjectType()
export class AROpenByCustomerRow {
  @Field(() => ID, { nullable: true }) CustomerOrganizationID?: string;
  @Field({ nullable: true }) CustomerName?: string;
  @Field(() => Float) OpenBalance: number;
  @Field(() => Float) TotalCharges: number;
  @Field(() => Float) TotalPayments: number;
  @Field(() => Int) EntryCount: number;
}

@ObjectType()
export class ARAgingRow {
  @Field(() => ID, { nullable: true }) CustomerOrganizationID?: string;
  @Field({ nullable: true }) CustomerName?: string;
  @Field(() => Float) Current_0_30: number;
  @Field(() => Float) Days_31_60: number;
  @Field(() => Float) Days_61_90: number;
  @Field(() => Float) Days_Over_90: number;
  @Field(() => Float) TotalOpen: number;
}

@ObjectType()
export class DefRevRollforwardRow {
  @Field(() => ID) AccountingPeriodID: string;
  @Field(() => Int) FiscalYear: number;
  @Field() PeriodType: string;
  @Field({ nullable: true }) PeriodStart?: string;
  @Field({ nullable: true }) PeriodEnd?: string;
  @Field(() => Float) OpeningBalance: number;
  @Field(() => Float) Additions: number;
  @Field(() => Float) Releases: number;
  @Field(() => Float) NetChange: number;
  @Field(() => Float) ClosingBalance: number;
}

@ObjectType()
export class SalesTaxLiabilityRow {
  @Field(() => ID) TaxAuthorityID: string;
  @Field() AuthorityCode: string;
  @Field() AuthorityName: string;
  @Field(() => ID) TaxJurisdictionID: string;
  @Field() JurisdictionCode: string;
  @Field() JurisdictionName: string;
  @Field(() => Int) FiscalYear: number;
  @Field() PeriodType: string;
  @Field(() => Float) AccruedAmount: number;
  @Field(() => Float) RemittedAmount: number;
  @Field(() => Float) OutstandingLiability: number;
  @Field() Status: string;
  @Field({ nullable: true }) DueDate?: string;
  @Field({ nullable: true }) FilingFrequency?: string;
}

@ObjectType()
export class BatchDispatchStatusRow {
  @Field(() => ID) BatchID: string;
  @Field() BatchNumber: string;
  @Field(() => Int) FiscalYear: number;
  @Field() PeriodType: string;
  @Field() TargetSystem: string;
  @Field() Status: string;
  @Field(() => Int) TotalEntries: number;
  @Field(() => Float) TotalDebits: number;
  @Field(() => Float) TotalCredits: number;
  @Field({ nullable: true }) ExternalBatchRef?: string;
  @Field({ nullable: true }) BatchedAt?: string;
  @Field({ nullable: true }) SentAt?: string;
  @Field({ nullable: true }) AcknowledgedAt?: string;
  @Field(() => Int) SummaryLineCount: number;
}

@ObjectType()
export class IntercompanyFlowRow {
  @Field(() => ID, { nullable: true }) IntercompanyFlowID?: string;
  @Field(() => ID) JournalEntryID: string;
  @Field() EntryNumber: string;
  @Field() CompanyName: string;
  @Field() EntryType: string;
  @Field() Status: string;
  @Field({ nullable: true }) EffectiveDate?: string;
  @Field(() => Int) LineNumber: number;
  @Field({ nullable: true }) CounterpartyName?: string;
  @Field() GLAccountCode: string;
  @Field() GLAccountName: string;
  @Field() AccountType: string;
  @Field(() => Float, { nullable: true }) DebitAmount?: number;
  @Field(() => Float, { nullable: true }) CreditAmount?: number;
  @Field({ nullable: true }) LineDescription?: string;
}

@Resolver()
export class ReadModelsResolver extends ResolverBase {
  /** Trial balance (per GL account) over committed JEs for a company. (vw_TrialBalance_AR) */
  @Query(() => [TrialBalanceRow])
  async AccountingTrialBalance(
    @Arg('companyID', () => ID) companyID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<TrialBalanceRow[]> {
    return this.runView<TrialBalanceRow>(
      userPayload,
      `SELECT GLAccountID, GLAccountCode, GLAccountName, AccountType, TotalDebits, TotalCredits, NetBalance, EntryCount
         FROM ${SCHEMA}.vw_TrialBalance_AR WHERE CompanyID = @CompanyID ORDER BY GLAccountCode`,
      'AccountingTrialBalance',
      companyID,
    );
  }

  /** Open AR balance per customer for a company. (vw_AROpenByCustomer) */
  @Query(() => [AROpenByCustomerRow])
  async AccountingAROpenByCustomer(
    @Arg('companyID', () => ID) companyID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<AROpenByCustomerRow[]> {
    return this.runView<AROpenByCustomerRow>(
      userPayload,
      `SELECT CustomerOrganizationID, CustomerName, OpenBalance, TotalCharges, TotalPayments, EntryCount
         FROM ${SCHEMA}.vw_AROpenByCustomer WHERE CompanyID = @CompanyID ORDER BY OpenBalance DESC`,
      'AccountingAROpenByCustomer',
      companyID,
    );
  }

  /** Open AR bucketed by age per customer for a company. (vw_ARAging) */
  @Query(() => [ARAgingRow])
  async AccountingARAging(
    @Arg('companyID', () => ID) companyID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<ARAgingRow[]> {
    return this.runView<ARAgingRow>(
      userPayload,
      `SELECT CustomerOrganizationID, CustomerName, Current_0_30, Days_31_60, Days_61_90, Days_Over_90, TotalOpen
         FROM ${SCHEMA}.vw_ARAging WHERE CompanyID = @CompanyID ORDER BY TotalOpen DESC`,
      'AccountingARAging',
      companyID,
    );
  }

  /** Deferred-revenue rollforward per period for a company. (vw_DefRevRollforward) */
  @Query(() => [DefRevRollforwardRow])
  async AccountingDefRevRollforward(
    @Arg('companyID', () => ID) companyID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<DefRevRollforwardRow[]> {
    return this.runView<DefRevRollforwardRow>(
      userPayload,
      `SELECT AccountingPeriodID, FiscalYear, PeriodType, PeriodStart, PeriodEnd,
              OpeningBalance, Additions, Releases, NetChange, ClosingBalance
         FROM ${SCHEMA}.vw_DefRevRollforward WHERE CompanyID = @CompanyID ORDER BY PeriodStart`,
      'AccountingDefRevRollforward',
      companyID,
    );
  }

  /** Accrued vs remitted sales-tax liability for a company. (vw_SalesTaxLiability) */
  @Query(() => [SalesTaxLiabilityRow])
  async AccountingSalesTaxLiability(
    @Arg('companyID', () => ID) companyID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<SalesTaxLiabilityRow[]> {
    return this.runView<SalesTaxLiabilityRow>(
      userPayload,
      `SELECT TaxAuthorityID, AuthorityCode, AuthorityName, TaxJurisdictionID, JurisdictionCode, JurisdictionName,
              FiscalYear, PeriodType, AccruedAmount, RemittedAmount, OutstandingLiability, Status, DueDate, FilingFrequency
         FROM ${SCHEMA}.vw_SalesTaxLiability WHERE CompanyID = @CompanyID
        ORDER BY AuthorityCode, JurisdictionCode`,
      'AccountingSalesTaxLiability',
      companyID,
    );
  }

  /** Batch lifecycle + control totals for a company (read-only summary). (vw_BatchDispatchStatus) */
  @Query(() => [BatchDispatchStatusRow])
  async AccountingBatchDispatchStatus(
    @Arg('companyID', () => ID) companyID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<BatchDispatchStatusRow[]> {
    return this.runView<BatchDispatchStatusRow>(
      userPayload,
      `SELECT BatchID, BatchNumber, FiscalYear, PeriodType, TargetSystem, Status, TotalEntries, TotalDebits, TotalCredits,
              ExternalBatchRef, BatchedAt, SentAt, AcknowledgedAt, SummaryLineCount
         FROM ${SCHEMA}.vw_BatchDispatchStatus WHERE CompanyID = @CompanyID ORDER BY BatchedAt DESC`,
      'AccountingBatchDispatchStatus',
      companyID,
    );
  }

  /** All legs of intercompany flows for a company. (vw_IntercompanyFlow) */
  @Query(() => [IntercompanyFlowRow])
  async AccountingIntercompanyFlow(
    @Arg('companyID', () => ID) companyID: string,
    @Ctx() { userPayload }: AppContext,
  ): Promise<IntercompanyFlowRow[]> {
    return this.runView<IntercompanyFlowRow>(
      userPayload,
      `SELECT IntercompanyFlowID, JournalEntryID, EntryNumber, CompanyName, EntryType, Status, EffectiveDate,
              LineNumber, CounterpartyName, GLAccountCode, GLAccountName, AccountType, DebitAmount, CreditAmount, LineDescription
         FROM ${SCHEMA}.vw_IntercompanyFlow WHERE CompanyID = @CompanyID
        ORDER BY IntercompanyFlowID, JournalEntryID, LineNumber`,
      'AccountingIntercompanyFlow',
      companyID,
    );
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  /**
   * Run a read-only, company-scoped SELECT against a `vw_*` view and return the typed rows.
   * Auth: resolves the per-request user; an unauthenticated request returns []. Params bind
   * BY NAME (object), matching SequenceService — never positional/array (see its note).
   */
  private async runView<T>(
    userPayload: AppContext['userPayload'],
    sql: string,
    description: string,
    companyID: string,
  ): Promise<T[]> {
    try {
      const user = this.GetUserFromPayload(userPayload);
      if (!user) return [];
      const provider = this.sqlProvider();
      const rows = await provider.ExecuteSQL(sql, { CompanyID: companyID }, { description }, user);
      return (rows ?? []) as T[];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      LogError(`ReadModelsResolver.${description} failed: ${msg}`);
      return [];
    }
  }

  /** The active SQL Server provider (the read views are SQL-Server-only reporting views). */
  private sqlProvider(): SQLServerDataProvider {
    const provider = Metadata.Provider;
    if (!provider) throw new Error('ReadModelsResolver: Metadata.Provider is not initialized.');
    return provider as SQLServerDataProvider;
  }
}
