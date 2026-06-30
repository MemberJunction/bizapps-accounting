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
 * USAGE (cwd = instance worktree root): npx tsx packages/dev-apps/bizapps-accounting/test-harness/block6-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. FK-aware teardown (disables triggers to drop locked rows).
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { buildBatch, sendBatch, createScheduledEntries, AutoApproveGate } from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity, mjBizAppsAccountingJournalEntryEntity, mjBizAppsAccountingJournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';

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

interface Ctx { pool: sql.ConnectionPool; user: UserInfo; companyId: string; arGL: string; revGL: string; deferredGL: string; periods: { ID: string; PeriodStart: string }[]; currencyCode: string; dimId: string; dimVal: string }

async function bootstrap(): Promise<Ctx> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env (run from the instance worktree root).');
  const pool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code as string;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success})`);

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
  return { pool, user: ctxUser, companyId, arGL: byCode.get('11201')!, revGL: byCode.get('40100')!, deferredGL: byCode.get('21301')!, periods, currencyCode, dimId, dimVal };
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

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyId, periods } = ctx;
  console.log(`\n══════ Block 6 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);
  assert(periods.length >= 4, `need >=4 open month periods, got ${periods.length}`);
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

  // ─── Teardown ──────────────────────────────────────────────────────────────
  const exec = async (sqlText: string) => { try { await pool.request().query(sqlText); } catch (e) { void e; } };
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch']) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (SELECT ID FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}')`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}'`);
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch']) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE sli FROM ${SCHEMA}.ScheduledJournalEntryLineItem sli JOIN ${SCHEMA}.ScheduledJournalEntry s ON s.ID=sli.ScheduledJournalEntryID WHERE s.CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.DimensionValue WHERE DimensionID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.Dimension WHERE ID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchSequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingPeriod WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 6 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
