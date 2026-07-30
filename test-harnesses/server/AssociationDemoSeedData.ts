/**
 * DEV/TEST FIXTURE — lives in test-harnesses/ ON PURPOSE (ruled by Marcelo 2026-07-27): demo
 * seed data must not ship in a production package, so this module sits OUTSIDE every package
 * build (never compiled into a dist/, never published; consumed only by seed-demo.ts via tsx).
 *
 * AssociationDemoSeedData.ts — deterministic, idempotent demo seed (master-plan Block 4).
 *
 * Populates realistic multi-company AR-subledger data so the Explorer GUI (and the upcoming
 * Playwright tier) have meaningful fixtures AND so the Block-6 read-model views light up with
 * real numbers. Everything keys off STATIC UUID CONSTANTS, so re-running `seedAssociationDemo`
 * skips/reuses rather than duplicating (check-existence-by-ID).
 *
 * WHAT IT SEEDS (all through the MJ app path — typed entities + .Save(); raw SQL only for the
 * tiny dimension-link + ERP-mapping plumbing that has no entity surface in this seed):
 *   • 3 "Assoc Demo" companies (AccountingCompanyProfile) — each new profile fires W1
 *     (AccountingCompanyProfileEntityServer.Save) → its ~10-account COA.
 *     (Periods retired 2026-07-06 — CH-1; temporal placement is by EffectiveDate.)
 *   • 4 customer Organizations (MJ_BizApps_Common) formerly used for line counterparty tagging (column REMOVED 2026-07-29, Amith — orders-side concern); kept as demo Organizations.
 *   • Company 1 — AR activity (→ vw_AROpenByCustomer, vw_ARAging): balanced JEs across the aging
 *     buckets (~15/45/75/120 days), a partial payment (one customer partially open), and a fully
 *     settled customer (absent from vw_AROpenByCustomer by its HAVING <> 0).
 *   • Company 1 — a deferred-revenue waterfall (→ vw_DefRevRollforward): a deferral then releases
 *     across 2 periods.
 *   • Company 1 — sales-tax liability (→ vw_SalesTaxLiability): a TaxAuthority + TaxJurisdiction +
 *     two TaxLiability rows (accrued-only and partially remitted).
 *   • Companies 2 & 3 — an intercompany flow (→ vw_IntercompanyFlow): 2 JEs sharing one
 *     IntercompanyFlowID, each tagging a counterparty Organization. NOTE (per Amith): Accounting
 *     does NOT generate/net intercompany — these are illustrative tagged JEs (as Payments would
 *     emit them); no netting/provisioning is called.
 *
 * All JEs self-balance (triggers 50001 + per-company 50019 enforce it) and are posted to GLPosted
 * (via buildBatch + approveBatch + sendBatch with the AutoApproveGate) so the views — which filter Batched/GLPosted
 * — show data. This is DEMO data: it PERSISTS by design (unlike the test harnesses, there is no
 * teardown). Idempotency comes entirely from the static IDs.
 *
 * CONNECTS TO:
 *   ENTITIES: AccountingCompanyProfile (W1) · GLAccount · JournalEntry (W2) · JournalEntryLine ·
 *             Tax{Authority,Jurisdiction,Liability} · MJ_BizApps_Common Organizations
 *   ENGINE:   buildBatch / sendBatch (Block 2 batching → GLPosted)
 *   VIEWS:    vw_TrialBalance_AR · vw_AROpenByCustomer · vw_ARAging · vw_DefRevRollforward ·
 *             vw_SalesTaxLiability · vw_IntercompanyFlow
 *   PLAN:     §Block 4 (MH: AssociationDemoSeedData)
 */

import { IMetadataProvider, IRunViewProvider, Metadata, RunView, UserInfo } from '@memberjunction/core';
import {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingDimensionEntity,
  mjBizAppsAccountingDimensionValueEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingJournalEntryTypeEntity,
  mjBizAppsAccountingTaxAuthorityEntity,
  mjBizAppsAccountingTaxJurisdictionEntity,
  mjBizAppsAccountingTaxLiabilityEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonOrganizationEntity } from '@mj-biz-apps/common-entities';

import {
  buildBatch, approveBatch, sendBatch, AutoApproveGate,
  GetBatchSummaryEntryType, LookupJournalEntryTypeByCode, JournalEntryEntityServer,
} from '@mj-biz-apps/accounting-core-entities-server';

// ─── Entity name constants ───────────────────────────────────────────────────
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JET_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Types';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const TAX_AUTH_ENTITY = 'MJ_BizApps_Accounting: Tax Authorities';
const TAX_JUR_ENTITY = 'MJ_BizApps_Accounting: Tax Jurisdictions';
const TAX_LIAB_ENTITY = 'MJ_BizApps_Accounting: Tax Liabilities';
const ORG_ENTITY = 'MJ_BizApps_Common: Organizations';

// ─── Deterministic static UUIDs (the whole idempotency story rides on these) ──
// Companies (also the __mj.Company PK — IsA, BA-D9).
const CO1 = 'a55c0de1-0001-4000-8000-000000000001'; // AR + DefRev + Tax demos
const CO2 = 'a55c0de1-0002-4000-8000-000000000002'; // intercompany leg 1
const CO3 = 'a55c0de1-0003-4000-8000-000000000003'; // intercompany leg 2

// Customer Organizations (counterparties on AR / intercompany lines).
const CUST_PARTIAL = 'a55c0de1-c001-4000-8000-000000000001'; // partial open balance
const CUST_OPEN = 'a55c0de1-c002-4000-8000-000000000002';    // fully open
const CUST_SETTLED = 'a55c0de1-c003-4000-8000-000000000003'; // fully settled → absent from vw_AROpenByCustomer
const CUST_AGING = 'a55c0de1-c004-4000-8000-000000000004';   // aging-bucket spread

// Tax authority / jurisdiction.
const TAX_AUTH = 'a55c0de1-7a00-4000-8000-000000000001';
const TAX_JUR = 'a55c0de1-7a00-4000-8000-000000000002';
const TAX_LIAB_PARTIAL = 'a55c0de1-7a00-4000-8000-000000000011'; // accrued 1000 / remitted 350
const TAX_LIAB_FULL = 'a55c0de1-7a00-4000-8000-000000000012';    // accrued 500 / remitted 0

// Intercompany flow id (shared across CO2 + CO3 JEs).
const IC_FLOW = 'a55c0de1-1c00-4000-8000-000000000001';

// Dimensions (global reference data) + a dimension-tagged Pending JE (added 2026-07-29 so the
// Dimensions pages and the workspace's dimension drill have demo data).
const DIM_DEPT = 'a55c0de1-d100-4000-8000-000000000001';
const DIM_PROGRAM = 'a55c0de1-d100-4000-8000-000000000002';
const DIMVAL_DEPT_MEMBERSHIP = 'a55c0de1-d1a0-4000-8000-000000000001';
const DIMVAL_DEPT_EVENTS = 'a55c0de1-d1a0-4000-8000-000000000002';
const DIMVAL_PROG_ANNUAL = 'a55c0de1-d1a0-4000-8000-000000000003';
const JE_DIMENSIONED = 'a55c0de1-1e00-4000-8000-000000000041';

// Journal entries — static so a re-run detects "already seeded" and skips the (now-locked) JEs.
// Company 1 AR:
const JE_AR_PARTIAL_CHARGE = 'a55c0de1-1e00-4000-8000-000000000001';
const JE_AR_PARTIAL_PAY = 'a55c0de1-1e00-4000-8000-000000000002';
const JE_AR_OPEN_CHARGE = 'a55c0de1-1e00-4000-8000-000000000003';
const JE_AR_SETTLED_CHARGE = 'a55c0de1-1e00-4000-8000-000000000004';
const JE_AR_SETTLED_PAY = 'a55c0de1-1e00-4000-8000-000000000005';
// Company 1 aging (4 charges, different ages):
const JE_AGE_15 = 'a55c0de1-1e00-4000-8000-000000000011';
const JE_AGE_45 = 'a55c0de1-1e00-4000-8000-000000000012';
const JE_AGE_75 = 'a55c0de1-1e00-4000-8000-000000000013';
const JE_AGE_120 = 'a55c0de1-1e00-4000-8000-000000000014';
// Company 1 deferred-revenue waterfall:
const JE_DEFER = 'a55c0de1-1e00-4000-8000-000000000021';
const JE_RELEASE = 'a55c0de1-1e00-4000-8000-000000000022';
// Intercompany legs:
const JE_IC_CO2 = 'a55c0de1-1e00-4000-8000-000000000031';
const JE_IC_CO3 = 'a55c0de1-1e00-4000-8000-000000000032';

// GL codes (W1 seeds these per company — see SeedData.DEFAULT_CHART_OF_ACCOUNTS).
const GL_CASH = '11101';
const GL_AR = '11201';
const GL_REVENUE = '40100';
const GL_DEFERRED = '21301';

const TARGET_SYSTEM = 'BusinessCentral' as const;

/**
 * Demo-seeded JournalEntryType rows (issue #24): the demo simulates ORDERS activity, and the
 * domain types (OrderBooking, PaymentReceipt) are orders' metadata to seed — so this demo
 * provisions them itself, idempotently, BY CODE (create-if-missing; if orders' own seed already
 * created the Code, its row is reused — never a duplicate, UQ Code guards it).
 */
const DEMO_ENTRY_TYPES: { code: string; name: string; description: string }[] = [
  { code: 'OrderBooking', name: 'Order Booking', description: 'Association demo seed (orders-domain type; bizapps-orders owns this row in production — issue #24).' },
  { code: 'PaymentReceipt', name: 'Payment Receipt', description: 'Association demo seed (orders-domain type; bizapps-orders owns this row in production — issue #24).' },
  { code: 'RevenueRecognition', name: 'Revenue Recognition', description: 'Association demo seed (orders-domain type; bizapps-orders owns this row in production — issue #24).' },
  { code: 'IntercompanyFlow', name: 'Intercompany Flow', description: 'Association demo seed (payments-domain type; the emitting app owns this row in production — issue #24).' },
  { code: 'Refund', name: 'Refund', description: 'Orders-domain type (PaymentJournalEntryFactory books reversals with it; orders owns this row in production — issue #24, gap filed upstream 2026-07-30).' },
];
/** Populated by ensureDemoEntryTypes each run: type Code → ID. */
let entryTypeIdByCode = new Map<string, string>();

// ─── Result reporting ─────────────────────────────────────────────────────────
export interface DemoSeedReport {
  Companies: { ID: string; Name: string; Created: boolean }[];
  Customers: { ID: string; Name: string; Created: boolean }[];
  JournalEntriesCreated: number;
  JournalEntriesSkipped: number;
  BatchesPosted: number;
  TaxRows: { ID: string; Created: boolean }[];
  Notes: string[];
}

interface CompanyContext {
  companyId: string;
  glByCode: Map<string, string>;
}

/** A single JE line spec: a debit OR a credit on a GL account, optionally tagging a counterparty. */
interface LineSpec {
  glCode: string;
  debit?: number;
  credit?: number;
  counterparty?: string;
  /** Optional dimension tags — composed via the line's CreateDimension (encapsulated model). */
  dims?: { dimensionId: string; valueId: string }[];
}

/**
 * Seed the deterministic Association demo data. Idempotent: re-running updates/skips rather than
 * duplicating (everything is keyed by the static UUIDs above). Returns a structured report of what
 * was created vs. reused.
 */
export async function seedAssociationDemo(contextUser: UserInfo, provider: IMetadataProvider): Promise<DemoSeedReport> {
  const report: DemoSeedReport = {
    Companies: [],
    Customers: [],
    JournalEntriesCreated: 0,
    JournalEntriesSkipped: 0,
    BatchesPosted: 0,
    TaxRows: [],
    Notes: [],
  };

  const currencyCode = await resolveFunctionalCurrency(contextUser);

  // 1. Companies (each create fires W1 → COA + periods).
  const co1 = await ensureCompany(contextUser, CO1, 'Assoc Demo — Northwind Members', 'ADNW', currencyCode, report);
  const co2 = await ensureCompany(contextUser, CO2, 'Assoc Demo — Cascadia Chapter', 'ADCA', currencyCode, report);
  const co3 = await ensureCompany(contextUser, CO3, 'Assoc Demo — Sierra Chapter', 'ADSI', currencyCode, report);

  // 2. Customer Organizations (counterparties).
  await ensureOrganization(contextUser, CUST_PARTIAL, 'Assoc Demo Customer — Acme Partial', report);
  await ensureOrganization(contextUser, CUST_OPEN, 'Assoc Demo Customer — Globex Open', report);
  await ensureOrganization(contextUser, CUST_SETTLED, 'Assoc Demo Customer — Initech Settled', report);
  await ensureOrganization(contextUser, CUST_AGING, 'Assoc Demo Customer — Umbrella Aging', report);

  // 1b. Every demo company gets a CFO approver (the seed user). Without one, ANY scope-All UI
  // batch build fails the TasksAppApprovalGate precondition the moment a demo company has a
  // Pending JE — this is what let the dimension-tagged demo JE break every batch spec 2026-07-30.
  await ensureCompanyCFO(contextUser, CO1);
  await ensureCompanyCFO(contextUser, CO2);
  await ensureCompanyCFO(contextUser, CO3);

  // 2b. Ensure the orders-domain JournalEntryType rows this demo books with exist (issue #24).
  await ensureDemoEntryTypes(contextUser, provider);

  // 3. Ensure each company's GL accounts carry an inline ERP mapping so buildBatch can post.
  await ensureGLMapping(contextUser, co1);
  await ensureGLMapping(contextUser, co2);
  await ensureGLMapping(contextUser, co3);

  // 4. The transactional demos. Each is guarded by a sentinel JE id so a re-run posts nothing twice.
  await seedArActivity(contextUser, co1, report, provider);
  await seedDeferredRevenue(contextUser, co1, report, provider);
  await seedSalesTax(contextUser, co1, report);
  await seedIntercompany(contextUser, co2, co3, report, provider);

  // 5. Dimensions + a tagged Pending JE — AFTER the batching phases so it STAYS Pending.
  await seedDimensions(contextUser, co1, report);

  return report;
}

/** Idempotent: set the company's CFO approver to the seed user when unset. */
async function ensureCompanyCFO(contextUser: UserInfo, companyId: string): Promise<void> {
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
  if (!(await acp.Load(companyId))) return;
  if (acp.ApprovalCFOUserID) return;
  acp.ApprovalCFOUserID = contextUser.ID;
  if (!(await acp.Save())) throw new Error(`ensureCompanyCFO: ${acp.LatestResult?.CompleteMessage ?? 'save failed'}`);
}

// ─── Dimensions (global reference data + one tagged Pending JE) ──────────────

async function ensureDimension(contextUser: UserInfo, id: string, code: string, name: string, order: number): Promise<void> {
  const md = new Metadata();
  const dim = await md.GetEntityObject<mjBizAppsAccountingDimensionEntity>('MJ_BizApps_Accounting: Dimensions', contextUser);
  if (await dim.Load(id)) return;
  dim.NewRecord();
  dim.ID = id;
  dim.Code = code;
  dim.Name = name;
  dim.DisplayOrder = order;
  dim.IsActive = true;
  if (!(await dim.Save())) throw new Error(`ensureDimension: save failed for ${code}: ${dim.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

async function ensureDimensionValue(contextUser: UserInfo, id: string, dimensionId: string, code: string, name: string): Promise<void> {
  const md = new Metadata();
  const v = await md.GetEntityObject<mjBizAppsAccountingDimensionValueEntity>('MJ_BizApps_Accounting: Dimension Values', contextUser);
  if (await v.Load(id)) return;
  v.NewRecord();
  v.ID = id;
  v.DimensionID = dimensionId;
  v.Code = code;
  v.Name = name;
  v.IsActive = true;
  if (!(await v.Save())) throw new Error(`ensureDimensionValue: save failed for ${code}: ${v.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

/**
 * Seed 2 dimensions (Department, Program) + 3 values, and ONE dimension-tagged Pending JE in CO1.
 * The JE deliberately stays Pending (runs AFTER the batching phases): it feeds the workspace's
 * candidate pool and the dimension drill. Guarded by its static ID like every other phase.
 */
async function seedDimensions(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport): Promise<void> {
  await ensureDimension(contextUser, DIM_DEPT, 'DEPT', 'Department', 1);
  await ensureDimension(contextUser, DIM_PROGRAM, 'PROG', 'Program', 2);
  await ensureDimensionValue(contextUser, DIMVAL_DEPT_MEMBERSHIP, DIM_DEPT, 'MEMB', 'Membership');
  await ensureDimensionValue(contextUser, DIMVAL_DEPT_EVENTS, DIM_DEPT, 'EVTS', 'Events');
  await ensureDimensionValue(contextUser, DIMVAL_PROG_ANNUAL, DIM_PROGRAM, 'ANNUAL', 'Annual Conference');

  if (await jeExists(contextUser, JE_DIMENSIONED)) {
    report.Notes.push('Dimension-tagged JE already present — skipped (idempotent).');
    return;
  }
  await makeJE(contextUser, ctx, JE_DIMENSIONED, 'OrderBooking', [
    { glCode: GL_AR, debit: 350, dims: [ { dimensionId: DIM_DEPT, valueId: DIMVAL_DEPT_MEMBERSHIP }, { dimensionId: DIM_PROGRAM, valueId: DIMVAL_PROG_ANNUAL } ] },
    { glCode: GL_REVENUE, credit: 350, dims: [ { dimensionId: DIM_DEPT, valueId: DIMVAL_DEPT_EVENTS } ] },
  ]);
  report.JournalEntriesCreated += 1;
  report.Notes.push('Dimension-tagged Pending JE created (workspace candidate + dimension drill demo).');
}

// ─── Currency ──────────────────────────────────────────────────────────────

async function resolveFunctionalCurrency(contextUser: UserInfo): Promise<string> {
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>(
    { EntityName: CURRENCY_ENTITY, Fields: ['Code'], OrderBy: 'Code ASC', MaxRows: 1, ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const code = cur.Results?.[0]?.Code;
  if (!code) throw new Error(`seedAssociationDemo: no Currency rows found (success=${cur.Success}). bizapps-common currencies must be seeded first.`);
  return code;
}

// ─── Companies ───────────────────────────────────────────────────────────────

async function ensureCompany(
  contextUser: UserInfo,
  companyId: string,
  name: string,
  companyCode: string,
  currencyCode: string,
  report: DemoSeedReport,
): Promise<CompanyContext> {
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, contextUser);
  const exists = await acp.Load(companyId);

  if (!exists) {
    acp.NewRecord();
    acp.ID = companyId; // deterministic PK (== __mj.Company.ID via IsA)
    acp.Name = name;
    acp.Description = 'Association demo seed (idempotent).';
    acp.CompanyCode = companyCode;
    acp.FunctionalCurrencyCode = currencyCode;
    acp.EntityType = 'Subsidiary';
    if (!(await acp.Save())) {
      throw new Error(`ensureCompany: ACP save failed for ${name}: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
  }
  report.Companies.push({ ID: companyId, Name: name, Created: !exists });

  const glByCode = await loadGLByCode(contextUser, companyId);
  return { companyId, glByCode };
}

async function loadGLByCode(contextUser: UserInfo, companyId: string): Promise<Map<string, string>> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; Code: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return new Map((res.Results ?? []).map(r => [r.Code, r.ID]));
}

// ─── Customers (Organizations) ───────────────────────────────────────────────

async function ensureOrganization(contextUser: UserInfo, orgId: string, name: string, report: DemoSeedReport): Promise<void> {
  const md = new Metadata();
  const org = await md.GetEntityObject<mjBizAppsCommonOrganizationEntity>(ORG_ENTITY, contextUser);
  const exists = await org.Load(orgId);
  if (!exists) {
    org.NewRecord();
    org.ID = orgId;
    org.Name = name;
    org.Status = 'Active';
    if (!(await org.Save())) {
      throw new Error(`ensureOrganization: save failed for ${name}: ${org.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
  }
  report.Customers.push({ ID: orgId, Name: name, Created: !exists });
}

// ─── GL ERP mapping (inline, idempotent) ──────────────────────────────────────
// buildBatch hard-fails on an unmapped GL account. W1 leaves ExternalAccountID null, so set it to the
// GL Code here. Idempotent: only saves when not already mapped.

async function ensureGLMapping(contextUser: UserInfo, ctx: CompanyContext): Promise<void> {
  const md = new Metadata();
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; Code: string; ExternalAccountID: string | null }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${ctx.companyId}'`, Fields: ['ID', 'Code', 'ExternalAccountID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  for (const row of res.Results ?? []) {
    if (row.ExternalAccountID) continue; // already mapped
    const gl = await md.GetEntityObject<mjBizAppsAccountingGLAccountEntity>(GL_ENTITY, contextUser);
    if (!(await gl.Load(row.ID))) continue;
    gl.ExternalSystem = TARGET_SYSTEM;
    gl.ExternalAccountID = row.Code;
    if (!(await gl.Save())) {
      throw new Error(`ensureGLMapping: GL ${row.Code} mapping save failed: ${gl.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
  }
}

// ─── JE primitives ─────────────────────────────────────────────────────────

/** Returns true if a JE with this static id already exists (so the seed phase can skip it). */
async function jeExists(contextUser: UserInfo, jeId: string): Promise<boolean> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `ID='${jeId}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return (res.Results?.length ?? 0) > 0;
}

/**
 * Ensure the demo's orders-domain JournalEntryType rows exist (create-if-missing BY CODE) and
 * refresh the Code→ID map makeJE resolves through. Reuses an existing row when the owning app
 * (orders) has already seeded the Code.
 */
async function ensureDemoEntryTypes(contextUser: UserInfo, provider: IMetadataProvider): Promise<void> {
  const map = new Map<string, string>();
  for (const t of DEMO_ENTRY_TYPES) {
    const existing = await LookupJournalEntryTypeByCode(t.code, contextUser, provider);
    if (existing) {
      map.set(t.code, existing.ID);
      continue;
    }
    const row = await provider.GetEntityObject<mjBizAppsAccountingJournalEntryTypeEntity>(JET_ENTITY, contextUser);
    row.NewRecord();
    row.Code = t.code;
    row.Name = t.name;
    row.Description = t.description;
    row.IsSystem = false;
    row.IsBatchSummary = false;
    row.IsActive = true;
    if (!(await row.Save())) throw new Error(`ensureDemoEntryTypes: save failed for '${t.code}': ${row.LatestResult?.CompleteMessage}`);
    map.set(t.code, row.ID);
  }
  entryTypeIdByCode = map;
}

/**
 * Create one balanced Pending JE with a deterministic id + balanced lines. Optional EffectiveDate
 * (defaults to now/UTC) and a demo intercompany-flow tag (carried on the D25 origin pair as a
 * soft LinkedRecordID grouping key — there is no IntercompanyFlow entity yet, so LinkedEntityID
 * stays unset and the tag is demo Description text instead). Returns the JE id.
 */
async function makeJE(
  contextUser: UserInfo,
  ctx: CompanyContext,
  jeId: string,
  entryType: string,
  lines: LineSpec[],
  opts: { effectiveDate?: Date; intercompanyFlowId?: string } = {},
): Promise<string> {
  const entryTypeId = entryTypeIdByCode.get(entryType);
  if (!entryTypeId) throw new Error(`makeJE: JournalEntryType '${entryType}' was not provisioned by ensureDemoEntryTypes.`);
  // PHASE-2 ENCAPSULATED MODEL (modernized 2026-07-29): lines are composed on the entity BEFORE
  // the single transactional Save() — the entity's Validate() rejects a header without >= 2 lines,
  // which is exactly what broke the old header-then-lines pattern here.
  const md = new Metadata();
  const je = await md.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, contextUser);
  je.NewRecord();
  je.ID = jeId;
  je.CompanyID = ctx.companyId; // single-company JE (plan D3)
  je.EffectiveDate = opts.effectiveDate ?? new Date();
  je.EntryTypeID = entryTypeId;
  je.Status = 'Pending';
  // The former JE.IntercompanyFlowID column dropped (D25); keep the flow tag readable in the demo.
  je.Description = opts.intercompanyFlowId
    ? `Association demo seed (intercompany flow ${opts.intercompanyFlowId})`
    : 'Association demo seed';
  for (const spec of lines) {
    const glId = ctx.glByCode.get(spec.glCode);
    if (!glId) throw new Error(`makeJE: GL code ${spec.glCode} not found for company ${ctx.companyId}`);
    const l = await je.CreateLine(contextUser); // assigns LineNumber 1..n itself
    l.GLAccountID = glId;
    if (spec.debit != null) l.DebitAmount = spec.debit;
    if (spec.credit != null) l.CreditAmount = spec.credit;
    for (const dim of spec.dims ?? []) {
      const d = await l.CreateDimension(contextUser);
      d.DimensionID = dim.dimensionId;
      d.DimensionValueID = dim.valueId;
    }
  }
  if (!(await je.Save())) throw new Error(`makeJE save failed (${jeId}): ${je.LatestResult?.CompleteMessage}`);
  return je.ID;
}

/** Build + approve + dispatch one SINGLE-COMPANY batch (D7) per company with Pending JEs → they become GLPosted. */
async function postPending(contextUser: UserInfo, report: DemoSeedReport, provider: IMetadataProvider): Promise<void> {
  const summaryType = await GetBatchSummaryEntryType(contextUser, provider);
  const rv = new RunView(provider as unknown as IRunViewProvider);
  const res = await rv.RunView<{ CompanyID: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: `Status='Pending' AND EntryTypeID<>'${summaryType.ID}'`, Fields: ['CompanyID'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  const companyIds = [...new Set((res.Results ?? []).map(r => r.CompanyID))];
  if (companyIds.length === 0) throw new Error('postPending: no pending JEs to batch.');
  for (const companyId of companyIds) {
    const built = await buildBatch(companyId, TARGET_SYSTEM, contextUser.ID, contextUser, provider, AutoApproveGate);
    if (built === null) throw new Error(`postPending: buildBatch returned null for company ${companyId} (no pending JEs or all netted to zero).`);
    await approveBatch(built.batchId, contextUser.ID, contextUser, provider);
    const batch = await sendBatch(built.batchId, contextUser, { gate: AutoApproveGate, provider });
    if (batch.Status !== 'Posted') throw new Error(`postPending: batch should be Posted, got ${batch.Status}`);
    report.BatchesPosted += 1;
  }
}

// ─── AR activity (→ vw_AROpenByCustomer, vw_ARAging) ──────────────────────────
// Open-balance demo lives in monthPeriods[0]; aging spread in monthPeriods[1]. Each period posts
// once. A sentinel JE id guards the whole phase per period so re-runs do nothing.

async function seedArActivity(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport, provider: IMetadataProvider): Promise<void> {
  await seedArOpenBalances(contextUser, ctx, report, provider);
  await seedArAging(contextUser, ctx, report, provider);
}

async function seedArOpenBalances(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport, provider: IMetadataProvider): Promise<void> {
  if (await jeExists(contextUser, JE_AR_PARTIAL_CHARGE)) {
    report.JournalEntriesSkipped += 5;
    report.Notes.push('AR open-balance JEs already present — skipped (idempotent).');
    return;
  }
  // Acme: charge 500 then pay 200 → 300 open.
  await makeJE(contextUser, ctx, JE_AR_PARTIAL_CHARGE, 'OrderBooking', [{ glCode: GL_AR, debit: 500, counterparty: CUST_PARTIAL }, { glCode: GL_REVENUE, credit: 500 }]);
  await makeJE(contextUser, ctx, JE_AR_PARTIAL_PAY, 'PaymentReceipt', [{ glCode: GL_CASH, debit: 200 }, { glCode: GL_AR, credit: 200, counterparty: CUST_PARTIAL }]);
  // Globex: charge 1000 → 1000 open.
  await makeJE(contextUser, ctx, JE_AR_OPEN_CHARGE, 'OrderBooking', [{ glCode: GL_AR, debit: 1000, counterparty: CUST_OPEN }, { glCode: GL_REVENUE, credit: 1000 }]);
  // Initech: charge 400 + pay 400 → net 0 → absent from vw_AROpenByCustomer (HAVING).
  await makeJE(contextUser, ctx, JE_AR_SETTLED_CHARGE, 'OrderBooking', [{ glCode: GL_AR, debit: 400, counterparty: CUST_SETTLED }, { glCode: GL_REVENUE, credit: 400 }]);
  await makeJE(contextUser, ctx, JE_AR_SETTLED_PAY, 'PaymentReceipt', [{ glCode: GL_CASH, debit: 400 }, { glCode: GL_AR, credit: 400, counterparty: CUST_SETTLED }]);
  await postPending(contextUser, report, provider);
  report.JournalEntriesCreated += 5;
}

async function seedArAging(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport, provider: IMetadataProvider): Promise<void> {
  if (await jeExists(contextUser, JE_AGE_15)) {
    report.JournalEntriesSkipped += 4;
    report.Notes.push('AR aging JEs already present — skipped (idempotent).');
    return;
  }
  // 4 charges spanning the aging buckets — EffectiveDate ~15/45/75/120 days ago (UTC).
  await makeJE(contextUser, ctx, JE_AGE_15, 'OrderBooking', [{ glCode: GL_AR, debit: 100, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 100 }], { effectiveDate: daysAgoUtc(15) });
  await makeJE(contextUser, ctx, JE_AGE_45, 'OrderBooking', [{ glCode: GL_AR, debit: 200, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 200 }], { effectiveDate: daysAgoUtc(45) });
  await makeJE(contextUser, ctx, JE_AGE_75, 'OrderBooking', [{ glCode: GL_AR, debit: 300, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 300 }], { effectiveDate: daysAgoUtc(75) });
  await makeJE(contextUser, ctx, JE_AGE_120, 'OrderBooking', [{ glCode: GL_AR, debit: 400, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 400 }], { effectiveDate: daysAgoUtc(120) });
  await postPending(contextUser, report, provider);
  report.JournalEntriesCreated += 4;
}

// ─── Deferred-revenue waterfall (→ vw_DefRevRollforward) ──────────────────────
// Defer 300 ~60 days ago (Cr DefRev), release 120 ~30 days ago (Dr DefRev) — the view is
// month-grained on EffectiveDate, so the two land in different months.

async function seedDeferredRevenue(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport, provider: IMetadataProvider): Promise<void> {
  if (await jeExists(contextUser, JE_DEFER)) {
    report.JournalEntriesSkipped += 2;
    report.Notes.push('Deferred-revenue waterfall JEs already present — skipped (idempotent).');
    return;
  }
  // Defer: Dr Cash 300 / Cr DefRev 300 (~60 days ago).
  await makeJE(contextUser, ctx, JE_DEFER, 'RevenueRecognition', [{ glCode: GL_CASH, debit: 300 }, { glCode: GL_DEFERRED, credit: 300 }], { effectiveDate: daysAgoUtc(60) });
  await postPending(contextUser, report, provider);
  // Release: Dr DefRev 120 / Cr Revenue 120 (~30 days ago).
  await makeJE(contextUser, ctx, JE_RELEASE, 'RevenueRecognition', [{ glCode: GL_DEFERRED, debit: 120 }, { glCode: GL_REVENUE, credit: 120 }], { effectiveDate: daysAgoUtc(30) });
  await postPending(contextUser, report, provider);
  report.JournalEntriesCreated += 2;
}

// ─── Sales-tax liability (→ vw_SalesTaxLiability) ─────────────────────────────
// No JE: the view reads TaxLiability directly. Two rows: partially remitted + accrued-only.

async function seedSalesTax(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport): Promise<void> {
  await ensureTaxAuthority(contextUser, report);
  await ensureTaxJurisdiction(contextUser, report);
  await ensureTaxLiability(contextUser, ctx, TAX_LIAB_PARTIAL, 1000, 350, 'PartiallyPaid', report);
  await ensureTaxLiability(contextUser, ctx, TAX_LIAB_FULL, 500, 0, 'Open', report);
}

async function ensureTaxAuthority(contextUser: UserInfo, report: DemoSeedReport): Promise<void> {
  const md = new Metadata();
  const auth = await md.GetEntityObject<mjBizAppsAccountingTaxAuthorityEntity>(TAX_AUTH_ENTITY, contextUser);
  const exists = await auth.Load(TAX_AUTH);
  if (!exists) {
    auth.NewRecord();
    auth.ID = TAX_AUTH;
    auth.Code = 'ASSOC-DEMO-CDTFA';
    auth.Name = 'Assoc Demo — CA Dept of Tax & Fee Admin';
    auth.CountryCode = 'US';
    auth.IsActive = true;
    if (!(await auth.Save())) throw new Error(`ensureTaxAuthority save failed: ${auth.LatestResult?.CompleteMessage}`);
  }
  report.TaxRows.push({ ID: TAX_AUTH, Created: !exists });
}

async function ensureTaxJurisdiction(contextUser: UserInfo, report: DemoSeedReport): Promise<void> {
  const md = new Metadata();
  const jur = await md.GetEntityObject<mjBizAppsAccountingTaxJurisdictionEntity>(TAX_JUR_ENTITY, contextUser);
  const exists = await jur.Load(TAX_JUR);
  if (!exists) {
    jur.NewRecord();
    jur.ID = TAX_JUR;
    jur.TaxAuthorityID = TAX_AUTH;
    jur.Code = 'ASSOC-DEMO-CA';
    jur.Name = 'Assoc Demo — California';
    jur.CountryCode = 'US';
    jur.RegionCode = 'CA';
    jur.IsActive = true;
    if (!(await jur.Save())) throw new Error(`ensureTaxJurisdiction save failed: ${jur.LatestResult?.CompleteMessage}`);
  }
  report.TaxRows.push({ ID: TAX_JUR, Created: !exists });
}

async function ensureTaxLiability(
  contextUser: UserInfo,
  ctx: CompanyContext,
  liabId: string,
  accrued: number,
  remitted: number,
  status: 'Filed' | 'Open' | 'Paid' | 'PartiallyPaid',
  report: DemoSeedReport,
): Promise<void> {
  const md = new Metadata();
  const liab = await md.GetEntityObject<mjBizAppsAccountingTaxLiabilityEntity>(TAX_LIAB_ENTITY, contextUser);
  const exists = await liab.Load(liabId);
  if (!exists) {
    liab.NewRecord();
    liab.ID = liabId;
    liab.CompanyID = ctx.companyId;
    liab.TaxAuthorityID = TAX_AUTH;
    liab.TaxJurisdictionID = TAX_JUR;
    liab.AccruedAmount = accrued;
    liab.RemittedAmount = remitted;
    liab.Status = status;
    if (!(await liab.Save())) throw new Error(`ensureTaxLiability save failed (${liabId}): ${liab.LatestResult?.CompleteMessage}`);
  }
  report.TaxRows.push({ ID: liabId, Created: !exists });
}

// ─── Intercompany flow (→ vw_IntercompanyFlow) ────────────────────────────────
// 2 JEs (one per company) sharing IC_FLOW, each tagging a counterparty Organization. NOT netted —
// illustrative tagged JEs only (per Amith; Accounting does not generate/net intercompany).

async function seedIntercompany(
  contextUser: UserInfo,
  co2: CompanyContext,
  co3: CompanyContext,
  report: DemoSeedReport,
  provider: IMetadataProvider,
): Promise<void> {
  if (await jeExists(contextUser, JE_IC_CO2)) {
    report.JournalEntriesSkipped += 2;
    report.Notes.push('Intercompany JEs already present — skipped (idempotent).');
    return;
  }
  // CO2 leg: Dr AR 250 (counterparty = CO3's customer-ish org) / Cr Rev 250.
  await makeJE(contextUser, co2, JE_IC_CO2, 'IntercompanyFlow', [{ glCode: GL_AR, debit: 250, counterparty: CUST_OPEN }, { glCode: GL_REVENUE, credit: 250 }], { intercompanyFlowId: IC_FLOW });
  await postPending(contextUser, report, provider);
  // CO3 leg: Dr Cash 250 / Cr AR 250 (counterparty).
  await makeJE(contextUser, co3, JE_IC_CO3, 'IntercompanyFlow', [{ glCode: GL_CASH, debit: 250 }, { glCode: GL_AR, credit: 250, counterparty: CUST_PARTIAL }], { intercompanyFlowId: IC_FLOW });
  await postPending(contextUser, report, provider);
  report.JournalEntriesCreated += 2;
}

// ─── UTC date helper ──────────────────────────────────────────────────────────

function daysAgoUtc(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
