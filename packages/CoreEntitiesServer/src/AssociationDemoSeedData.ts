/**
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
 *     (AccountingCompanyProfileEntityServer.Save) → its ~10-account COA + 17 periods.
 *   • 4 customer Organizations (MJ_BizApps_Common) used as JournalEntryLine.CounterpartyOrganizationID.
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
 * All JEs self-balance (the balanced-on-lock trigger 50001 enforces it) and are posted to GLPosted
 * (via buildBatch + sendBatch with the AutoApproveGate) so the views — which filter Batched/GLPosted
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

import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingTaxAuthorityEntity,
  mjBizAppsAccountingTaxJurisdictionEntity,
  mjBizAppsAccountingTaxLiabilityEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonOrganizationEntity } from '@mj-biz-apps/common-entities';

import { buildBatch, sendBatch, AutoApproveGate } from './BatchingEngine.js';

// ─── Entity name constants ───────────────────────────────────────────────────
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
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

/** The JournalEntry.EntryType union (subset used by this seed; keep in sync with the generated entity). */
type JEEntryType = mjBizAppsAccountingJournalEntryEntity['EntryType'];

// ─── Result reporting ─────────────────────────────────────────────────────────
export interface DemoSeedReport {
  Companies: { ID: string; Name: string; Created: boolean }[];
  Customers: { ID: string; Name: string; Created: boolean }[];
  JournalEntriesCreated: number;
  JournalEntriesSkipped: number;
  PeriodsPosted: number;
  TaxRows: { ID: string; Created: boolean }[];
  Notes: string[];
}

interface CompanyContext {
  companyId: string;
  glByCode: Map<string, string>;
  monthPeriods: { ID: string; PeriodStart: string }[];
}

/** A single JE line spec: a debit OR a credit on a GL account, optionally tagging a counterparty. */
interface LineSpec {
  glCode: string;
  debit?: number;
  credit?: number;
  counterparty?: string;
}

/**
 * Seed the deterministic Association demo data. Idempotent: re-running updates/skips rather than
 * duplicating (everything is keyed by the static UUIDs above). Returns a structured report of what
 * was created vs. reused.
 */
export async function seedAssociationDemo(contextUser: UserInfo): Promise<DemoSeedReport> {
  const report: DemoSeedReport = {
    Companies: [],
    Customers: [],
    JournalEntriesCreated: 0,
    JournalEntriesSkipped: 0,
    PeriodsPosted: 0,
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

  // 3. Ensure each company's GL accounts carry an inline ERP mapping so buildBatch can post.
  await ensureGLMapping(contextUser, co1);
  await ensureGLMapping(contextUser, co2);
  await ensureGLMapping(contextUser, co3);

  // 4. The transactional demos. Each is guarded by a sentinel JE id so a re-run posts nothing twice.
  await seedArActivity(contextUser, co1, report);
  await seedDeferredRevenue(contextUser, co1, report);
  await seedSalesTax(contextUser, co1, report);
  await seedIntercompany(contextUser, co2, co3, report);

  return report;
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
  const monthPeriods = await loadOpenMonthPeriods(contextUser, companyId);
  if (monthPeriods.length < 7) {
    throw new Error(`ensureCompany: ${name} has ${monthPeriods.length} open month periods; need >= 7 (W1 should seed 12).`);
  }
  return { companyId, glByCode, monthPeriods };
}

async function loadGLByCode(contextUser: UserInfo, companyId: string): Promise<Map<string, string>> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; Code: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple', BypassCache: true },
    contextUser,
  );
  return new Map((res.Results ?? []).map(r => [r.Code, r.ID]));
}

async function loadOpenMonthPeriods(contextUser: UserInfo, companyId: string): Promise<{ ID: string; PeriodStart: string }[]> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; PeriodStart: string }>(
    {
      EntityName: PERIOD_ENTITY,
      ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`,
      Fields: ['ID', 'PeriodStart'],
      OrderBy: 'PeriodStart ASC',
      ResultType: 'simple',
      BypassCache: true,
    },
    contextUser,
  );
  return res.Results ?? [];
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
 * Create one balanced Pending JE with a deterministic id + balanced lines. Optional EffectiveDate
 * (defaults to now/UTC) and IntercompanyFlowID. Returns the JE id.
 */
async function makeJE(
  contextUser: UserInfo,
  ctx: CompanyContext,
  jeId: string,
  entryType: JEEntryType,
  lines: LineSpec[],
  opts: { effectiveDate?: Date; intercompanyFlowId?: string; periodId?: string } = {},
): Promise<string> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, contextUser);
  je.NewRecord();
  je.ID = jeId;
  je.CompanyID = ctx.companyId;
  je.AccountingPeriodID = opts.periodId ?? ctx.monthPeriods[0].ID;
  je.EffectiveDate = opts.effectiveDate ?? new Date();
  je.EntryType = entryType;
  je.Status = 'Pending';
  je.Description = 'Association demo seed';
  if (opts.intercompanyFlowId) je.IntercompanyFlowID = opts.intercompanyFlowId;
  if (!(await je.Save())) throw new Error(`makeJE save failed (${jeId}): ${je.LatestResult?.CompleteMessage}`);

  let lineNo = 0;
  for (const spec of lines) {
    lineNo += 1;
    const glId = ctx.glByCode.get(spec.glCode);
    if (!glId) throw new Error(`makeJE: GL code ${spec.glCode} not found for company ${ctx.companyId}`);
    const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, contextUser);
    l.NewRecord();
    l.JournalEntryID = je.ID;
    l.LineNumber = lineNo;
    l.GLAccountID = glId;
    l.DebitAmount = spec.debit ?? null;
    l.CreditAmount = spec.credit ?? null;
    if (spec.counterparty) l.CounterpartyOrganizationID = spec.counterparty;
    if (!(await l.Save())) throw new Error(`makeJE line ${lineNo} save failed (${jeId}): ${l.LatestResult?.CompleteMessage}`);
  }
  return je.ID;
}

/** Build + dispatch the batch for a period → all its Pending JEs become GLPosted. */
async function postPeriod(contextUser: UserInfo, ctx: CompanyContext, periodId: string, report: DemoSeedReport): Promise<void> {
  const built = await buildBatch(ctx.companyId, periodId, TARGET_SYSTEM, contextUser.ID, contextUser, AutoApproveGate);
  if (built === null) throw new Error(`postPeriod: buildBatch returned null for period ${periodId} (no pending JEs or all netted to zero).`);
  const batch = await sendBatch(built.batchId, contextUser, { gate: AutoApproveGate });
  if (batch.Status !== 'Acknowledged') throw new Error(`postPeriod: batch should be Acknowledged, got ${batch.Status}`);
  report.PeriodsPosted += 1;
}

// ─── AR activity (→ vw_AROpenByCustomer, vw_ARAging) ──────────────────────────
// Open-balance demo lives in monthPeriods[0]; aging spread in monthPeriods[1]. Each period posts
// once. A sentinel JE id guards the whole phase per period so re-runs do nothing.

async function seedArActivity(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport): Promise<void> {
  await seedArOpenBalances(contextUser, ctx, report);
  await seedArAging(contextUser, ctx, report);
}

async function seedArOpenBalances(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport): Promise<void> {
  if (await jeExists(contextUser, JE_AR_PARTIAL_CHARGE)) {
    report.JournalEntriesSkipped += 5;
    report.Notes.push('AR open-balance JEs already present — skipped (idempotent).');
    return;
  }
  const p = ctx.monthPeriods[0].ID;
  // Acme: charge 500 then pay 200 → 300 open.
  await makeJE(contextUser, ctx, JE_AR_PARTIAL_CHARGE, 'OrderBooking', [{ glCode: GL_AR, debit: 500, counterparty: CUST_PARTIAL }, { glCode: GL_REVENUE, credit: 500 }], { periodId: p });
  await makeJE(contextUser, ctx, JE_AR_PARTIAL_PAY, 'PaymentReceipt', [{ glCode: GL_CASH, debit: 200 }, { glCode: GL_AR, credit: 200, counterparty: CUST_PARTIAL }], { periodId: p });
  // Globex: charge 1000 → 1000 open.
  await makeJE(contextUser, ctx, JE_AR_OPEN_CHARGE, 'OrderBooking', [{ glCode: GL_AR, debit: 1000, counterparty: CUST_OPEN }, { glCode: GL_REVENUE, credit: 1000 }], { periodId: p });
  // Initech: charge 400 + pay 400 → net 0 → absent from vw_AROpenByCustomer (HAVING).
  await makeJE(contextUser, ctx, JE_AR_SETTLED_CHARGE, 'OrderBooking', [{ glCode: GL_AR, debit: 400, counterparty: CUST_SETTLED }, { glCode: GL_REVENUE, credit: 400 }], { periodId: p });
  await makeJE(contextUser, ctx, JE_AR_SETTLED_PAY, 'PaymentReceipt', [{ glCode: GL_CASH, debit: 400 }, { glCode: GL_AR, credit: 400, counterparty: CUST_SETTLED }], { periodId: p });
  await postPeriod(contextUser, ctx, p, report);
  report.JournalEntriesCreated += 5;
}

async function seedArAging(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport): Promise<void> {
  if (await jeExists(contextUser, JE_AGE_15)) {
    report.JournalEntriesSkipped += 4;
    report.Notes.push('AR aging JEs already present — skipped (idempotent).');
    return;
  }
  const p = ctx.monthPeriods[1].ID;
  // 4 charges spanning the aging buckets — EffectiveDate ~15/45/75/120 days ago (UTC).
  await makeJE(contextUser, ctx, JE_AGE_15, 'OrderBooking', [{ glCode: GL_AR, debit: 100, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 100 }], { periodId: p, effectiveDate: daysAgoUtc(15) });
  await makeJE(contextUser, ctx, JE_AGE_45, 'OrderBooking', [{ glCode: GL_AR, debit: 200, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 200 }], { periodId: p, effectiveDate: daysAgoUtc(45) });
  await makeJE(contextUser, ctx, JE_AGE_75, 'OrderBooking', [{ glCode: GL_AR, debit: 300, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 300 }], { periodId: p, effectiveDate: daysAgoUtc(75) });
  await makeJE(contextUser, ctx, JE_AGE_120, 'OrderBooking', [{ glCode: GL_AR, debit: 400, counterparty: CUST_AGING }, { glCode: GL_REVENUE, credit: 400 }], { periodId: p, effectiveDate: daysAgoUtc(120) });
  await postPeriod(contextUser, ctx, p, report);
  report.JournalEntriesCreated += 4;
}

// ─── Deferred-revenue waterfall (→ vw_DefRevRollforward) ──────────────────────
// Defer 300 in monthPeriods[2] (Cr DefRev), release 120 in monthPeriods[3] (Dr DefRev).

async function seedDeferredRevenue(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport): Promise<void> {
  if (await jeExists(contextUser, JE_DEFER)) {
    report.JournalEntriesSkipped += 2;
    report.Notes.push('Deferred-revenue waterfall JEs already present — skipped (idempotent).');
    return;
  }
  const pDefer = ctx.monthPeriods[2].ID;
  const pRelease = ctx.monthPeriods[3].ID;
  // Defer: Dr Cash 300 / Cr DefRev 300.
  await makeJE(contextUser, ctx, JE_DEFER, 'RevenueRecognition', [{ glCode: GL_CASH, debit: 300 }, { glCode: GL_DEFERRED, credit: 300 }], { periodId: pDefer });
  await postPeriod(contextUser, ctx, pDefer, report);
  // Release: Dr DefRev 120 / Cr Revenue 120.
  await makeJE(contextUser, ctx, JE_RELEASE, 'RevenueRecognition', [{ glCode: GL_DEFERRED, debit: 120 }, { glCode: GL_REVENUE, credit: 120 }], { periodId: pRelease });
  await postPeriod(contextUser, ctx, pRelease, report);
  report.JournalEntriesCreated += 2;
}

// ─── Sales-tax liability (→ vw_SalesTaxLiability) ─────────────────────────────
// No JE: the view reads TaxLiability directly. Two rows: partially remitted + accrued-only.

async function seedSalesTax(contextUser: UserInfo, ctx: CompanyContext, report: DemoSeedReport): Promise<void> {
  await ensureTaxAuthority(contextUser, report);
  await ensureTaxJurisdiction(contextUser, report);
  await ensureTaxLiability(contextUser, ctx, TAX_LIAB_PARTIAL, ctx.monthPeriods[4].ID, 1000, 350, 'PartiallyPaid', report);
  await ensureTaxLiability(contextUser, ctx, TAX_LIAB_FULL, ctx.monthPeriods[5].ID, 500, 0, 'Open', report);
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
  periodId: string,
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
    liab.AccountingPeriodID = periodId;
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
): Promise<void> {
  if (await jeExists(contextUser, JE_IC_CO2)) {
    report.JournalEntriesSkipped += 2;
    report.Notes.push('Intercompany JEs already present — skipped (idempotent).');
    return;
  }
  // CO2 leg: Dr AR 250 (counterparty = CO3's customer-ish org) / Cr Rev 250.
  const p2 = co2.monthPeriods[0].ID;
  await makeJE(contextUser, co2, JE_IC_CO2, 'IntercompanyFlow', [{ glCode: GL_AR, debit: 250, counterparty: CUST_OPEN }, { glCode: GL_REVENUE, credit: 250 }], { periodId: p2, intercompanyFlowId: IC_FLOW });
  await postPeriod(contextUser, co2, p2, report);
  // CO3 leg: Dr Cash 250 / Cr AR 250 (counterparty).
  const p3 = co3.monthPeriods[0].ID;
  await makeJE(contextUser, co3, JE_IC_CO3, 'IntercompanyFlow', [{ glCode: GL_CASH, debit: 250 }, { glCode: GL_AR, credit: 250, counterparty: CUST_PARTIAL }], { periodId: p3, intercompanyFlowId: IC_FLOW });
  await postPeriod(contextUser, co3, p3, report);
  report.JournalEntriesCreated += 2;
}

// ─── UTC date helper ──────────────────────────────────────────────────────────

function daysAgoUtc(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
