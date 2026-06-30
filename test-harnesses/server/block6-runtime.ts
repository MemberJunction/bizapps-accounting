/**
 * block6-runtime.ts — live validation of the Block-6 read-model views.
 *
 * Seeds a company with posted (GLPosted) JEs + dimension tags + a scheduled schedule, then queries each
 * delivered read-model view and asserts it returns MEANINGFUL, correct results (not just "no error"):
 *   vw_TrialBalance_AR     — foots to zero across accounts for balanced JEs (AR debit-net = Rev credit-net).
 *   vw_JEAuditTrail        — one row per JE line, flattened with account/period/batch, all GLPosted.
 *   vw_ARtoGLRecon         — per-period entry-status counts (GLPosted after dispatch; 0 Pending).
 *   vw_DimensionPL         — revenue netted by the tagged dimension value.
 *   vw_BatchDispatchStatus — the Acknowledged batch with its summary-line count + ExternalBatchRef.
 *   vw_ScheduledJESummary  — the scheduled rollup (count + total) by company/entry-type/status.
 *
 * USAGE (cwd = instance worktree root): npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block6-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. FK-aware teardown (disables triggers to drop locked rows).
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { assertInvariantTriggers } from './trigger-preflight.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { buildBatch, sendBatch, createScheduledEntries, AutoApproveGate } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingTaxAuthorityEntity,
  mjBizAppsAccountingTaxJurisdictionEntity,
  mjBizAppsAccountingTaxLiabilityEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonOrganizationEntity } from '@mj-biz-apps/common-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const SCHEMA = '__mj_BizAppsAccounting';
const RUN_TAG = `BLOCK6-${Date.now()}`;
function companyCode(): string { return `B6${Date.now().toString(36).slice(-7)}`.toUpperCase(); }

interface Outcome { Name: string; Passed: boolean; Ms: number; Error?: string }
const outcomes: Outcome[] = [];
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try { await fn(); outcomes.push({ Name: name, Passed: true, Ms: Date.now() - start }); console.log(`  ✓ ${name} (${Date.now() - start}ms)`); }
  catch (e) { const msg = e instanceof Error ? (e.stack ?? e.message) : String(e); outcomes.push({ Name: name, Passed: false, Ms: Date.now() - start, Error: msg }); console.log(`  ✗ ${name} (${Date.now() - start}ms)\n      ${msg.split('\n')[0]}`); }
}
function assert(cond: boolean, message: string): void { if (!cond) throw new Error(message); }

interface Ctx { pool: sql.ConnectionPool; user: UserInfo; companyId: string; arGL: string; revGL: string; deferredGL: string; cashGL: string; periods: { ID: string; PeriodStart: string }[]; currencyCode: string; foreignCurrency: string; dimId: string; dimVal: string }

async function bootstrap(): Promise<Ctx> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env (run from the instance worktree root).');
  const pool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await assertInvariantTriggers(pool); // 1b pre-flight: fail fast if any invariant trigger is missing/disabled
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], OrderBy: 'Code ASC', MaxRows: 2, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code as string;
  const foreignCurrency = cur.Results?.[1]?.Code as string;
  if (!currencyCode || !foreignCurrency) throw new Error(`need >=2 currencies for the FX test (success=${cur.Success})`);

  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctxUser);
  acp.NewRecord();
  acp.Set('Name', `${RUN_TAG} Co`); acp.Set('Description', `${RUN_TAG} block6 test`);
  acp.Set('CompanyCode', companyCode()); acp.Set('FunctionalCurrencyCode', currencyCode); acp.Set('EntityType', 'Subsidiary');
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, ctxUser);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`);
  const periodRes = await rv.RunView<{ ID: string; PeriodStart: string }>({ EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`, Fields: ['ID', 'PeriodStart'], OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, ctxUser);
  const periods = periodRes.Results ?? [];

  const dimId = randomUUID(), dimVal = randomUUID();
  await pool.request().query(`INSERT INTO ${SCHEMA}.Dimension (ID, Code, Name) VALUES ('${dimId}','DEPT-${RUN_TAG}','Department ${RUN_TAG}')`);
  await pool.request().query(`INSERT INTO ${SCHEMA}.DimensionValue (ID, DimensionID, Code, Name) VALUES ('${dimVal}','${dimId}','SALES','Sales')`);
  return { pool, user: ctxUser, companyId, arGL: byCode.get('11201')!, revGL: byCode.get('40100')!, deferredGL: byCode.get('21301')!, cashGL: byCode.get('11101')!, periods, currencyCode, foreignCurrency, dimId, dimVal };
}

/** Create a balanced Dr AR / Cr Rev JE; tag the Rev line with the Sales dimension. Returns JE id. */
async function makeTaggedJE(ctx: Ctx, periodId: string, amount: number): Promise<string> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = ctx.companyId; je.AccountingPeriodID = periodId; je.EffectiveDate = new Date();
  je.EntryType = 'OrderBooking'; je.Status = 'Pending'; je.Description = `${RUN_TAG}`;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  const lAR = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
  lAR.NewRecord(); lAR.JournalEntryID = je.ID; lAR.LineNumber = 1; lAR.GLAccountID = ctx.arGL; lAR.DebitAmount = amount; lAR.CreditAmount = null;
  if (!(await lAR.Save())) throw new Error(`AR line save failed: ${lAR.LatestResult?.CompleteMessage}`);
  const lRev = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
  lRev.NewRecord(); lRev.JournalEntryID = je.ID; lRev.LineNumber = 2; lRev.GLAccountID = ctx.revGL; lRev.DebitAmount = null; lRev.CreditAmount = amount;
  if (!(await lRev.Save())) throw new Error(`Rev line save failed: ${lRev.LatestResult?.CompleteMessage}`);
  await ctx.pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntryLineDimension (ID, JournalEntryLineID, DimensionID, DimensionValueID) VALUES (NEWID(),'${lRev.ID}','${ctx.dimId}','${ctx.dimVal}')`);
  return je.ID;
}

const TAX_PREFIX = 'TX' + Date.now().toString(36).slice(-6).toUpperCase();
const TAX_AUTH_CODE = `${TAX_PREFIX}-AUTH`;
const TAX_JUR_CODE = `${TAX_PREFIX}-JUR`;
const ORG_PREFIX = `ORG-${RUN_TAG}`;

/** A single JE line spec: a debit OR a credit on a GL account, optionally tagging a counterparty customer. */
interface LineSpec { glId: string; debit?: number; credit?: number; counterparty?: string }

/**
 * Create a JE in `periodId` with the given balanced lines, optional EffectiveDate (defaults to now/UTC)
 * and optional IntercompanyFlowID. Stays Pending — call postPeriod() to flip it to GLPosted.
 */
async function makeJE(ctx: Ctx, periodId: string, entryType: string, lines: LineSpec[], opts: { effectiveDate?: Date; intercompanyFlowId?: string } = {}): Promise<string> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = ctx.companyId; je.AccountingPeriodID = periodId; je.EffectiveDate = opts.effectiveDate ?? new Date();
  je.EntryType = entryType; je.Status = 'Pending'; je.Description = `${RUN_TAG}`;
  if (opts.intercompanyFlowId) je.IntercompanyFlowID = opts.intercompanyFlowId;
  if (!(await je.Save())) throw new Error(`makeJE save failed: ${je.LatestResult?.CompleteMessage}`);
  let lineNo = 0;
  for (const spec of lines) {
    lineNo += 1;
    const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
    l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = lineNo; l.GLAccountID = spec.glId;
    l.DebitAmount = spec.debit ?? null; l.CreditAmount = spec.credit ?? null;
    if (spec.counterparty) l.CounterpartyOrganizationID = spec.counterparty;
    if (!(await l.Save())) throw new Error(`makeJE line ${lineNo} save failed: ${l.LatestResult?.CompleteMessage}`);
  }
  return je.ID;
}

/** Build + dispatch the batch for a period → all its Pending JEs become GLPosted. */
async function postPeriod(ctx: Ctx, periodId: string): Promise<void> {
  const built = await buildBatch(ctx.companyId, periodId, 'BusinessCentral', ctx.user.ID, ctx.user, AutoApproveGate);
  if (built === null) throw new Error('postPeriod: buildBatch returned null (no pending JEs or all netted to zero)');
  const batch = await sendBatch(built.batchId, ctx.user, { gate: AutoApproveGate });
  if (batch.Status !== 'Acknowledged') throw new Error(`postPeriod: batch should be Acknowledged, got ${batch.Status}`);
}

/**
 * Open a db_owner connection for teardown (CODEGEN_DB_USERNAME/PASSWORD → MJ_CodeGen). Needed because
 * MJ_Connect lacks ALTER rights to DISABLE TRIGGER, which is required to drop locked (Batched/GLPosted)
 * JEs + their batches. Falls back to the main MJ_Connect pool if the creds are absent or the connect
 * fails (teardown then still removes the unlocked rows — the locked rows would survive, as before).
 */
async function openTeardownPool(fallback: sql.ConnectionPool): Promise<sql.ConnectionPool> {
  const user = process.env.CODEGEN_DB_USERNAME, password = process.env.CODEGEN_DB_PASSWORD;
  if (!user || !password) { console.warn('  ⚠ teardown: CODEGEN_DB creds absent — locked JEs/batches may survive teardown'); return fallback; }
  try {
    return await new sql.ConnectionPool({
      server: process.env.DB_HOST!, port: Number(process.env.DB_PORT ?? 1433), user, password,
      database: process.env.DB_DATABASE!, options: { encrypt: false, trustServerCertificate: true },
    }).connect();
  } catch (e) { console.warn(`  ⚠ teardown: db_owner connect failed (${e instanceof Error ? e.message : String(e)}) — falling back`); return fallback; }
}

/** Create a customer Organization in __mj_BizAppsCommon; returns its ID. */
async function makeOrg(ctx: Ctx, name: string): Promise<string> {
  const md = new Metadata();
  const org = await md.GetEntityObject<mjBizAppsCommonOrganizationEntity>('MJ_BizApps_Common: Organizations', ctx.user);
  org.NewRecord(); org.Name = name; org.Status = 'Active';
  if (!(await org.Save())) throw new Error(`Organization save failed: ${org.LatestResult?.CompleteMessage}`);
  return org.ID;
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyId, periods } = ctx;
  console.log(`\n══════ Block 6 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);
  assert(periods.length >= 7, `need >=7 open month periods, got ${periods.length}`);
  const createdOrgIds: string[] = []; // customer Organizations created across the new tests, for teardown
  const q = (sqlText: string) => pool.request().query(sqlText).then(r => r.recordset);

  // Seed: 2 balanced JEs (Dr AR 100 / Cr Rev 100) in P[0], dimension-tagged, then batch+send → GLPosted.
  let batchId = '';
  await test('seed — 2 posted JEs + a batch (Acknowledged) for the views to read', async () => {
    await makeTaggedJE(ctx, periods[0].ID, 100);
    await makeTaggedJE(ctx, periods[0].ID, 100);
    const built = await buildBatch(companyId, periods[0].ID, 'BusinessCentral', user.ID, user, AutoApproveGate);
    assert(built !== null, 'buildBatch returned null');
    batchId = built!.batchId;
    const batch = await sendBatch(batchId, user, { gate: AutoApproveGate });
    assert(batch.Status === 'Acknowledged', `batch should be Acknowledged, got ${batch.Status}`);
    await createScheduledEntries(
      { companyId, entryType: 'RevenueRecognition', currencyCode: ctx.currencyCode, totalAmount: 300, debitGLAccountId: ctx.deferredGL, creditGLAccountId: ctx.revGL, periods: periods.slice(0, 3).map(p => ({ accountingPeriodId: p.ID, effectiveDate: new Date(p.PeriodStart) })) },
      user,
    );
  });

  await test('vw_TrialBalance_AR — foots to zero across accounts (AR debit-net = Rev credit-net)', async () => {
    const rows = await q(`SELECT GLAccountCode, NetBalance, TotalDebits, TotalCredits FROM ${SCHEMA}.vw_TrialBalance_AR WHERE CompanyID='${companyId}'`);
    assert(rows.length === 2, `expected 2 account rows (AR + Rev), got ${rows.length}`);
    const net = rows.reduce((s: number, r: { NetBalance: number }) => s + Number(r.NetBalance), 0);
    assert(Math.abs(net) < 0.005, `trial balance must foot to zero, got net ${net}`);
    const ar = rows.find((r: { GLAccountCode: string }) => r.GLAccountCode === '11201');
    assert(!!ar && Number(ar.NetBalance) === 200, `AR net should be +200 (debit), got ${ar?.NetBalance}`);
  });

  await test('vw_JEAuditTrail — one row per JE line, all GLPosted, batch + account flattened', async () => {
    const rows = await q(`SELECT Status, GLAccountCode, BatchNumber, EntryNumber FROM ${SCHEMA}.vw_JEAuditTrail WHERE CompanyID='${companyId}'`);
    assert(rows.length === 4, `expected 4 line rows (2 JEs × 2 lines), got ${rows.length}`);
    assert(rows.every((r: { Status: string }) => r.Status === 'GLPosted'), 'every audit row should be GLPosted');
    assert(rows.every((r: { BatchNumber: string | null }) => !!r.BatchNumber), 'every row should carry its BatchNumber');
  });

  await test('vw_ARtoGLRecon — per-period status counts (2 GLPosted, 0 Pending)', async () => {
    const rows = await q(`SELECT PendingEntries, BatchedEntries, GLPostedEntries, TotalEntries FROM ${SCHEMA}.vw_ARtoGLRecon WHERE CompanyID='${companyId}' AND AccountingPeriodID='${periods[0].ID}'`);
    assert(rows.length === 1, `expected 1 recon row, got ${rows.length}`);
    assert(Number(rows[0].GLPostedEntries) === 2 && Number(rows[0].PendingEntries) === 0, `expected 2 GLPosted / 0 Pending, got ${rows[0].GLPostedEntries}/${rows[0].PendingEntries}`);
  });

  await test('vw_DimensionPL — revenue netted by the tagged Sales dimension value', async () => {
    const rows = await q(`SELECT DimensionValueCode, AccountType, NetAmount FROM ${SCHEMA}.vw_DimensionPL WHERE CompanyID='${companyId}'`);
    const sales = rows.find((r: { DimensionValueCode: string }) => r.DimensionValueCode === 'SALES');
    assert(!!sales, 'expected a Sales dimension P&L row');
    assert(sales.AccountType === 'Revenue' && Number(sales.NetAmount) === 200, `expected Revenue NetAmount 200, got ${sales?.AccountType}/${sales?.NetAmount}`);
  });

  await test('vw_BatchDispatchStatus — the Acknowledged batch with summary-line count + ExternalBatchRef', async () => {
    const rows = await q(`SELECT Status, SummaryLineCount, ExternalBatchRef, TotalDebits, TotalCredits FROM ${SCHEMA}.vw_BatchDispatchStatus WHERE BatchID='${batchId}'`);
    assert(rows.length === 1, `expected 1 batch row, got ${rows.length}`);
    assert(rows[0].Status === 'Acknowledged', `batch status ${rows[0].Status}`);
    assert(Number(rows[0].SummaryLineCount) === 2, `expected 2 summary lines, got ${rows[0].SummaryLineCount}`);
    assert(Number(rows[0].TotalDebits) === Number(rows[0].TotalCredits), 'batch totals must foot in the view');
  });

  await test('vw_ScheduledJESummary — the rev-rec schedule rollup (3 entries, $300)', async () => {
    const rows = await q(`SELECT EntryType, Status, EntryCount, TotalAmount FROM ${SCHEMA}.vw_ScheduledJESummary WHERE CompanyID='${companyId}'`);
    const sched = rows.find((r: { Status: string; EntryType: string }) => r.Status === 'Scheduled' && r.EntryType === 'RevenueRecognition');
    assert(!!sched, 'expected a Scheduled RevenueRecognition rollup row');
    assert(Number(sched.EntryCount) === 3 && Number(sched.TotalAmount) === 300, `expected 3 entries / $300, got ${sched?.EntryCount}/${sched?.TotalAmount}`);
  });

  await test('vw_FxExposure — foreign-currency position + unrealized delta vs current spot', async () => {
    // A foreign-currency booking in period[1]: Dr AR 110 functional (= 100 foreign @ 1.10) / Cr Rev 110 functional.
    const md = new Metadata();
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord(); je.CompanyID = companyId; je.AccountingPeriodID = periods[1].ID; je.EffectiveDate = new Date();
    je.EntryType = 'OrderBooking'; je.Status = 'Pending'; je.Description = `${RUN_TAG} fx`;
    if (!(await je.Save())) throw new Error(`fx JE save failed: ${je.LatestResult?.CompleteMessage}`);
    const ar = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
    ar.NewRecord(); ar.JournalEntryID = je.ID; ar.LineNumber = 1; ar.GLAccountID = ctx.arGL;
    ar.DebitAmount = 110; ar.OriginalDebitAmount = 100; ar.OriginalCurrencyCode = ctx.foreignCurrency; ar.ExchangeRateUsed = 1.10;
    if (!(await ar.Save())) throw new Error(`fx AR line save failed: ${ar.LatestResult?.CompleteMessage}`);
    const rev = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
    rev.NewRecord(); rev.JournalEntryID = je.ID; rev.LineNumber = 2; rev.GLAccountID = ctx.revGL; rev.CreditAmount = 110;
    if (!(await rev.Save())) throw new Error(`fx Rev line save failed: ${rev.LatestResult?.CompleteMessage}`);
    const built = await buildBatch(companyId, periods[1].ID, 'BusinessCentral', user.ID, user, AutoApproveGate);
    await sendBatch(built!.batchId, user, { gate: AutoApproveGate });
    // current spot foreign→functional = 1.20 (booked at 1.10) → +10 unrealized on the 100-unit position
    await pool.request().query(`INSERT INTO ${SCHEMA}.CurrencySpotRate (ID, FromCurrencyCode, ToCurrencyCode, RateDate, Rate, Source) VALUES (NEWID(),'${ctx.foreignCurrency}','${ctx.currencyCode}','${new Date().toISOString().slice(0, 10)}',1.20,'Test')`);
    const rows = await q(`SELECT OriginalCurrencyCode, NetOriginalAmount, NetFunctionalBooked, CurrentSpotRate, UnrealizedFxDelta FROM ${SCHEMA}.vw_FxExposure WHERE CompanyID='${companyId}'`);
    const fx = rows.find((r: { OriginalCurrencyCode: string }) => r.OriginalCurrencyCode === ctx.foreignCurrency);
    assert(!!fx, 'expected an FX exposure row for the foreign currency');
    assert(Number(fx.NetOriginalAmount) === 100 && Number(fx.NetFunctionalBooked) === 110, `expected 100 original / 110 booked, got ${fx.NetOriginalAmount}/${fx.NetFunctionalBooked}`);
    assert(Number(fx.CurrentSpotRate) === 1.20 && Number(fx.UnrealizedFxDelta) === 10, `expected spot 1.20 / delta 10, got ${fx.CurrentSpotRate}/${fx.UnrealizedFxDelta}`);
  });

  // ═══ Block-6 deferred read-model views (V202606300500) ═══════════════════════
  // Each view test seeds in its OWN period so buildBatch (which nets ALL pending JEs
  // in a company×period) never cross-contaminates another test's data.

  // ── vw_AROpenByCustomer ──────────────────────────────────────────────────────
  // periods[2]. Customer A: charge 500 + partial payment 200 → open 300. Customer B:
  // charge 1000 → open 1000. Customer C: charge 400 + full payment 400 → net 0 → ABSENT
  // (HAVING). Each JE self-balances (AR debit/credit ↔ Rev/Cash) so it can lock to GLPosted.
  let arOrgA = '', arOrgB = '', arOrgC = '';
  await test('vw_AROpenByCustomer — exact open balance per customer; fully-settled customer absent (HAVING)', async () => {
    arOrgA = await makeOrg(ctx, `${ORG_PREFIX}-A`); createdOrgIds.push(arOrgA);
    arOrgB = await makeOrg(ctx, `${ORG_PREFIX}-B`); createdOrgIds.push(arOrgB);
    arOrgC = await makeOrg(ctx, `${ORG_PREFIX}-C`); createdOrgIds.push(arOrgC);
    const p = periods[2].ID;
    // A: charge 500 (Dr AR/Cr Rev), pay 200 (Dr Cash/Cr AR) → 300 open
    await makeJE(ctx, p, 'OrderBooking', [{ glId: ctx.arGL, debit: 500, counterparty: arOrgA }, { glId: ctx.revGL, credit: 500 }]);
    await makeJE(ctx, p, 'PaymentReceipt', [{ glId: ctx.cashGL, debit: 200 }, { glId: ctx.arGL, credit: 200, counterparty: arOrgA }]);
    // B: charge 1000 → 1000 open
    await makeJE(ctx, p, 'OrderBooking', [{ glId: ctx.arGL, debit: 1000, counterparty: arOrgB }, { glId: ctx.revGL, credit: 1000 }]);
    // C: charge 400 + pay 400 → net 0 → absent
    await makeJE(ctx, p, 'OrderBooking', [{ glId: ctx.arGL, debit: 400, counterparty: arOrgC }, { glId: ctx.revGL, credit: 400 }]);
    await makeJE(ctx, p, 'PaymentReceipt', [{ glId: ctx.cashGL, debit: 400 }, { glId: ctx.arGL, credit: 400, counterparty: arOrgC }]);
    await postPeriod(ctx, p);

    const rows = await q(`SELECT CustomerOrganizationID, OpenBalance, TotalCharges, TotalPayments, EntryCount FROM ${SCHEMA}.vw_AROpenByCustomer WHERE CompanyID='${companyId}' AND CustomerOrganizationID IN ('${arOrgA}','${arOrgB}','${arOrgC}')`);
    const a = rows.find((r: { CustomerOrganizationID: string }) => r.CustomerOrganizationID === arOrgA);
    const b = rows.find((r: { CustomerOrganizationID: string }) => r.CustomerOrganizationID === arOrgB);
    const c = rows.find((r: { CustomerOrganizationID: string }) => r.CustomerOrganizationID === arOrgC);
    assert(!!a && Number(a.OpenBalance) === 300, `customer A open should be 300, got ${a?.OpenBalance}`);
    assert(Number(a.TotalCharges) === 500 && Number(a.TotalPayments) === 200, `customer A charges/payments should be 500/200, got ${a?.TotalCharges}/${a?.TotalPayments}`);
    assert(!!b && Number(b.OpenBalance) === 1000, `customer B open should be 1000, got ${b?.OpenBalance}`);
    assert(!c, `fully-settled customer C must be ABSENT (HAVING <> 0), but a row was returned (open ${c?.OpenBalance})`);
  });

  // ── vw_ARAging ───────────────────────────────────────────────────────────────
  // periods[3], dedicated customer. 4 charges with EffectiveDates ~15/45/75/120 days ago
  // → land in Current_0_30 / Days_31_60 / Days_61_90 / Days_Over_90. TotalOpen reconciles.
  let agingOrg = '';
  await test('vw_ARAging — charges by age land in correct buckets; TotalOpen reconciles', async () => {
    agingOrg = await makeOrg(ctx, `${ORG_PREFIX}-AGE`); createdOrgIds.push(agingOrg);
    const p = periods[3].ID;
    const daysAgo = (n: number): Date => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };
    await makeJE(ctx, p, 'OrderBooking', [{ glId: ctx.arGL, debit: 100, counterparty: agingOrg }, { glId: ctx.revGL, credit: 100 }], { effectiveDate: daysAgo(15) });
    await makeJE(ctx, p, 'OrderBooking', [{ glId: ctx.arGL, debit: 200, counterparty: agingOrg }, { glId: ctx.revGL, credit: 200 }], { effectiveDate: daysAgo(45) });
    await makeJE(ctx, p, 'OrderBooking', [{ glId: ctx.arGL, debit: 300, counterparty: agingOrg }, { glId: ctx.revGL, credit: 300 }], { effectiveDate: daysAgo(75) });
    await makeJE(ctx, p, 'OrderBooking', [{ glId: ctx.arGL, debit: 400, counterparty: agingOrg }, { glId: ctx.revGL, credit: 400 }], { effectiveDate: daysAgo(120) });
    await postPeriod(ctx, p);

    const rows = await q(`SELECT Current_0_30, Days_31_60, Days_61_90, Days_Over_90, TotalOpen FROM ${SCHEMA}.vw_ARAging WHERE CompanyID='${companyId}' AND CustomerOrganizationID='${agingOrg}'`);
    assert(rows.length === 1, `expected 1 aging row for the customer, got ${rows.length}`);
    const r = rows[0];
    assert(Number(r.Current_0_30) === 100, `Current_0_30 should be 100, got ${r.Current_0_30}`);
    assert(Number(r.Days_31_60) === 200, `Days_31_60 should be 200, got ${r.Days_31_60}`);
    assert(Number(r.Days_61_90) === 300, `Days_61_90 should be 300, got ${r.Days_61_90}`);
    assert(Number(r.Days_Over_90) === 400, `Days_Over_90 should be 400, got ${r.Days_Over_90}`);
    assert(Number(r.TotalOpen) === 1000, `TotalOpen should reconcile to 1000, got ${r.TotalOpen}`);
  });

  // ── vw_DefRevRollforward ─────────────────────────────────────────────────────
  // periods[4] (deferral, Cr DefRev 300) then periods[5] (release, Dr DefRev 120). Deferred
  // Revenue is credit-normal: Additions=credits, Releases=debits. Opening/Closing cumulative.
  await test('vw_DefRevRollforward — deferral then release across 2 periods; Additions/Releases/Opening/Closing correct', async () => {
    const pDefer = periods[4].ID, pRelease = periods[5].ID;
    // Period 4: defer 300 — Cr DefRev 300 / Dr Cash 300
    await makeJE(ctx, pDefer, 'RevenueRecognition', [{ glId: ctx.cashGL, debit: 300 }, { glId: ctx.deferredGL, credit: 300 }]);
    await postPeriod(ctx, pDefer);
    // Period 5: release 120 — Dr DefRev 120 / Cr Rev 120
    await makeJE(ctx, pRelease, 'RevenueRecognition', [{ glId: ctx.deferredGL, debit: 120 }, { glId: ctx.revGL, credit: 120 }]);
    await postPeriod(ctx, pRelease);

    const rows = await q(`SELECT AccountingPeriodID, OpeningBalance, Additions, Releases, NetChange, ClosingBalance FROM ${SCHEMA}.vw_DefRevRollforward WHERE CompanyID='${companyId}' ORDER BY PeriodStart ASC`);
    const d = rows.find((r: { AccountingPeriodID: string }) => r.AccountingPeriodID === pDefer);
    const rel = rows.find((r: { AccountingPeriodID: string }) => r.AccountingPeriodID === pRelease);
    assert(!!d && Number(d.Additions) === 300 && Number(d.Releases) === 0, `deferral period: Additions/Releases should be 300/0, got ${d?.Additions}/${d?.Releases}`);
    assert(Number(d.OpeningBalance) === 0 && Number(d.ClosingBalance) === 300, `deferral period: Opening/Closing should be 0/300, got ${d?.OpeningBalance}/${d?.ClosingBalance}`);
    assert(!!rel && Number(rel.Additions) === 0 && Number(rel.Releases) === 120, `release period: Additions/Releases should be 0/120, got ${rel?.Additions}/${rel?.Releases}`);
    assert(Number(rel.OpeningBalance) === 300 && Number(rel.ClosingBalance) === 180, `release period: Opening/Closing should be 300/180, got ${rel?.OpeningBalance}/${rel?.ClosingBalance}`);
  });

  // ── vw_SalesTaxLiability ─────────────────────────────────────────────────────
  // Create a TaxAuthority + TaxJurisdiction, then a TaxLiability (accrued 1000, remitted 350)
  // → OutstandingLiability = 650. No JE involved (the view reads TaxLiability directly).
  let taxAuthId = '', taxJurId = '';
  await test('vw_SalesTaxLiability — OutstandingLiability = AccruedAmount − RemittedAmount', async () => {
    const md2 = new Metadata();
    const auth = await md2.GetEntityObject<mjBizAppsAccountingTaxAuthorityEntity>('MJ_BizApps_Accounting: Tax Authorities', user);
    auth.NewRecord(); auth.Code = TAX_AUTH_CODE; auth.Name = `${RUN_TAG} Authority`; auth.CountryCode = 'US'; auth.IsActive = true;
    if (!(await auth.Save())) throw new Error(`TaxAuthority save failed: ${auth.LatestResult?.CompleteMessage}`);
    taxAuthId = auth.ID;
    const jur = await md2.GetEntityObject<mjBizAppsAccountingTaxJurisdictionEntity>('MJ_BizApps_Accounting: Tax Jurisdictions', user);
    jur.NewRecord(); jur.TaxAuthorityID = taxAuthId; jur.Code = TAX_JUR_CODE; jur.Name = `${RUN_TAG} Jurisdiction`; jur.CountryCode = 'US'; jur.RegionCode = 'CA'; jur.IsActive = true;
    if (!(await jur.Save())) throw new Error(`TaxJurisdiction save failed: ${jur.LatestResult?.CompleteMessage}`);
    taxJurId = jur.ID;
    const liab = await md2.GetEntityObject<mjBizAppsAccountingTaxLiabilityEntity>('MJ_BizApps_Accounting: Tax Liabilities', user);
    liab.NewRecord(); liab.CompanyID = companyId; liab.TaxAuthorityID = taxAuthId; liab.TaxJurisdictionID = taxJurId;
    liab.AccountingPeriodID = periods[6].ID; liab.AccruedAmount = 1000; liab.RemittedAmount = 350; liab.Status = 'PartiallyPaid';
    if (!(await liab.Save())) throw new Error(`TaxLiability save failed: ${liab.LatestResult?.CompleteMessage}`);

    const rows = await q(`SELECT AuthorityCode, JurisdictionCode, AccruedAmount, RemittedAmount, OutstandingLiability, Status FROM ${SCHEMA}.vw_SalesTaxLiability WHERE CompanyID='${companyId}' AND TaxAuthorityID='${taxAuthId}'`);
    assert(rows.length === 1, `expected 1 tax-liability row, got ${rows.length}`);
    const r = rows[0];
    assert(r.AuthorityCode === TAX_AUTH_CODE && r.JurisdictionCode === TAX_JUR_CODE, `authority/jurisdiction codes mismatch: ${r.AuthorityCode}/${r.JurisdictionCode}`);
    assert(Number(r.AccruedAmount) === 1000 && Number(r.RemittedAmount) === 350, `accrued/remitted should be 1000/350, got ${r.AccruedAmount}/${r.RemittedAmount}`);
    assert(Number(r.OutstandingLiability) === 650, `OutstandingLiability should be 650, got ${r.OutstandingLiability}`);
  });

  // ── vw_IntercompanyFlow ──────────────────────────────────────────────────────
  // periods[6]. 2 JEs sharing one IntercompanyFlowID, each with a counterparty org → BOTH
  // legs returned for that flow. Each JE self-balances so it can lock.
  let icOrgX = '', icOrgY = '';
  const icFlowId = randomUUID();
  await test('vw_IntercompanyFlow — both legs of one IntercompanyFlowID returned, with counterparty orgs', async () => {
    icOrgX = await makeOrg(ctx, `${ORG_PREFIX}-ICX`); createdOrgIds.push(icOrgX);
    icOrgY = await makeOrg(ctx, `${ORG_PREFIX}-ICY`); createdOrgIds.push(icOrgY);
    const p = periods[6].ID;
    // Leg 1: Dr AR 250 (counterparty X) / Cr Rev 250
    await makeJE(ctx, p, 'IntercompanyFlow', [{ glId: ctx.arGL, debit: 250, counterparty: icOrgX }, { glId: ctx.revGL, credit: 250 }], { intercompanyFlowId: icFlowId });
    // Leg 2: Dr Cash 250 / Cr AR 250 (counterparty Y)
    await makeJE(ctx, p, 'IntercompanyFlow', [{ glId: ctx.cashGL, debit: 250 }, { glId: ctx.arGL, credit: 250, counterparty: icOrgY }], { intercompanyFlowId: icFlowId });
    await postPeriod(ctx, p);

    const rows = await q(`SELECT JournalEntryID, CounterpartyOrganizationID, CounterpartyName, GLAccountCode FROM ${SCHEMA}.vw_IntercompanyFlow WHERE IntercompanyFlowID='${icFlowId}'`);
    assert(rows.length === 4, `expected 4 line rows for the flow (2 JEs × 2 lines), got ${rows.length}`);
    const distinctJEs = new Set(rows.map((r: { JournalEntryID: string }) => r.JournalEntryID));
    assert(distinctJEs.size === 2, `expected 2 distinct JEs (both legs) for the flow, got ${distinctJEs.size}`);
    const cpOrgs = new Set(rows.map((r: { CounterpartyOrganizationID: string | null }) => r.CounterpartyOrganizationID).filter(Boolean));
    assert(cpOrgs.has(icOrgX) && cpOrgs.has(icOrgY), `expected both counterparty orgs (X,Y) on the flow's lines, got ${[...cpOrgs].join(',')}`);
  });

  // ─── Teardown ──────────────────────────────────────────────────────────────
  // Locked JEs/batches can only be dropped by DISABLE TRIGGER (the immutability triggers block
  // DELETE on Batched/GLPosted rows). MJ_Connect is NOT db_owner and cannot ALTER tables to disable
  // triggers, so route teardown through the db_owner CodeGen account when available (fall back to the
  // main pool, which still cleans the unlocked rows). NOTE: the immutability-trigger tables include
  // JournalEntryBatchLineDimension (trg_JEBLDimension_Immutability) — it MUST be in the disable set
  // and its rows deleted before the batch line items it references.
  const teardownPool = await openTeardownPool(pool);
  const exec = async (sqlText: string) => { try { await teardownPool.request().query(sqlText); } catch (e) { void e; } };
  const lockedTables = ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch', 'JournalEntryBatchLineDimension'];

  await exec(`DELETE FROM ${SCHEMA}.CurrencySpotRate WHERE FromCurrencyCode='${ctx.foreignCurrency}' AND ToCurrencyCode='${ctx.currencyCode}' AND Source='Test'`);
  for (const t of lockedTables) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE bld FROM ${SCHEMA}.JournalEntryBatchLineDimension bld JOIN ${SCHEMA}.JournalEntryBatchLineItem bli ON bli.ID=bld.JournalEntryBatchLineItemID WHERE bli.CompanyID='${companyId}'`);
  await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (SELECT ID FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}')`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}'`);
  for (const t of lockedTables) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE sli FROM ${SCHEMA}.ScheduledJournalEntryLineItem sli JOIN ${SCHEMA}.ScheduledJournalEntry s ON s.ID=sli.ScheduledJournalEntryID WHERE s.CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.DimensionValue WHERE DimensionID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.Dimension WHERE ID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchSequence WHERE CompanyID='${companyId}'`);
  // Tax: TaxLiability (company-scoped) → TaxJurisdiction → TaxAuthority (global; keyed off created IDs).
  await exec(`DELETE FROM ${SCHEMA}.TaxLiability WHERE CompanyID='${companyId}'`);
  if (taxJurId) await exec(`DELETE FROM ${SCHEMA}.TaxJurisdiction WHERE ID='${taxJurId}'`);
  if (taxAuthId) await exec(`DELETE FROM ${SCHEMA}.TaxAuthority WHERE ID='${taxAuthId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingPeriod WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);
  // Customer Organizations created in __mj_BizAppsCommon (AR-by-customer, aging, intercompany).
  if (createdOrgIds.length > 0) {
    const inList = createdOrgIds.map(id => `'${id}'`).join(',');
    await exec(`DELETE FROM __mj_BizAppsCommon.Organization WHERE ID IN (${inList})`);
  }
  if (teardownPool !== pool) await teardownPool.close();

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 6 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
