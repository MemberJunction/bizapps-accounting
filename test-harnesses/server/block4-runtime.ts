/**
 * block4-runtime.ts — live validation of the Block-4 scheduled-JE schedule + materializer (S3).
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *   S3 createScheduledEntries: a straight-line schedule lays down N Scheduled rows + balanced line pairs.
 *   S3 materializeDueScheduledEntries: only DUE rows (ScheduledEffectiveDate ≤ asOf) become Pending JEs;
 *      future rows stay Scheduled; the JE is correct (mapped EntryType, back-ref, lines + dimensions copied);
 *      the row flips to Generated (coherent); re-running is idempotent (no double-materialization).
 *   W7 tie-in: a Scheduled row blocks its period's close until materialized.
 *   Block4→Block2: a materialized Pending JE flows into buildBatch.
 *
 * USAGE (cwd = instance worktree root): npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block4-runtime.ts
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
import { createScheduledEntries, materializeDueScheduledEntries, buildBatch, AutoApproveGate } from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity, mjBizAppsAccountingAccountingPeriodEntity } from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const SCHEMA = '__mj_BizAppsAccounting';
const RUN_TAG = `BLOCK4-${Date.now()}`;
function companyCode(): string { return `B4${Date.now().toString(36).slice(-7)}`.toUpperCase(); }

interface Outcome { Name: string; Passed: boolean; Ms: number; Error?: string }
const outcomes: Outcome[] = [];
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try { await fn(); outcomes.push({ Name: name, Passed: true, Ms: Date.now() - start }); console.log(`  ✓ ${name} (${Date.now() - start}ms)`); }
  catch (e) { const msg = e instanceof Error ? (e.stack ?? e.message) : String(e); outcomes.push({ Name: name, Passed: false, Ms: Date.now() - start, Error: msg }); console.log(`  ✗ ${name} (${Date.now() - start}ms)\n      ${msg.split('\n')[0]}`); }
}
function assert(cond: boolean, message: string): void { if (!cond) throw new Error(message); }
async function expectThrow(fn: () => Promise<unknown>, mustContain: string): Promise<void> {
  let threw = false, msg = '';
  try { await fn(); } catch (e) { threw = true; msg = e instanceof Error ? e.message : String(e); }
  assert(threw, `expected an error containing "${mustContain}" but none was thrown`);
  assert(msg.toLowerCase().includes(mustContain.toLowerCase()), `expected "${mustContain}", got: ${msg.split('\n')[0]}`);
}

interface Ctx { pool: sql.ConnectionPool; user: UserInfo; companyId: string; deferredGL: string; revenueGL: string; periods: { ID: string; PeriodStart: string }[]; currencyCode: string; dimId: string; dimVal: string }

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
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code as string;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success})`);

  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctxUser);
  acp.NewRecord();
  acp.Set('Name', `${RUN_TAG} Co`); acp.Set('Description', `${RUN_TAG} block4 test`);
  acp.Set('CompanyCode', companyCode()); acp.Set('FunctionalCurrencyCode', currencyCode); acp.Set('EntityType', 'Subsidiary');
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, ctxUser);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`); // map all for batching tie-in
  const periodRes = await rv.RunView<{ ID: string; PeriodStart: string }>({ EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`, Fields: ['ID', 'PeriodStart'], OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, ctxUser);
  const periods = periodRes.Results ?? [];

  const dimId = randomUUID(), dimVal = randomUUID();
  await pool.request().query(`INSERT INTO ${SCHEMA}.Dimension (ID, Code, Name) VALUES ('${dimId}','DEPT-${RUN_TAG}','Department ${RUN_TAG}')`);
  await pool.request().query(`INSERT INTO ${SCHEMA}.DimensionValue (ID, DimensionID, Code, Name) VALUES ('${dimVal}','${dimId}','SALES','Sales')`);

  return { pool, user: ctxUser, companyId, deferredGL: byCode.get('21301')!, revenueGL: byCode.get('40100')!, periods, currencyCode, dimId, dimVal };
}

async function sjeStatusCounts(ctx: Ctx): Promise<{ scheduled: number; generated: number }> {
  const r = await ctx.pool.request().query(`SELECT Status, COUNT(*) c FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${ctx.companyId}' GROUP BY Status`);
  const m = new Map(r.recordset.map((x: { Status: string; c: number }) => [x.Status, Number(x.c)]));
  return { scheduled: m.get('Scheduled') ?? 0, generated: m.get('Generated') ?? 0 };
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyId, deferredGL, revenueGL, periods, currencyCode } = ctx;
  console.log(`\n══════ Block 4 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);
  assert(periods.length >= 12, `need >=12 open month periods, got ${periods.length}`);
  const schedulePeriods = periods.slice(0, 12).map(p => ({ accountingPeriodId: p.ID, effectiveDate: new Date(p.PeriodStart) }));

  let scheduleIds: string[] = [];
  await test('S3 createScheduledEntries — 12-period $1200 rev-rec schedule → 12 Scheduled rows, balanced line pairs', async () => {
    scheduleIds = await createScheduledEntries(
      { companyId, entryType: 'RevenueRecognition', currencyCode, totalAmount: 1200, debitGLAccountId: deferredGL, creditGLAccountId: revenueGL, periods: schedulePeriods, description: `${RUN_TAG} revrec` },
      user,
    );
    assert(scheduleIds.length === 12, `expected 12 SJE rows, got ${scheduleIds.length}`);
    const counts = await sjeStatusCounts(ctx);
    assert(counts.scheduled === 12, `expected 12 Scheduled, got ${counts.scheduled}`);
    const tot = (await pool.request().query(`SELECT SUM(TotalAmount) s, COUNT(*) c FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${companyId}'`)).recordset[0];
    assert(Number(tot.s) === 1200, `schedule must sum to 1200, got ${tot.s}`);
    const lines = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.ScheduledJournalEntryLineItem li JOIN ${SCHEMA}.ScheduledJournalEntry s ON s.ID=li.ScheduledJournalEntryID WHERE s.CompanyID='${companyId}'`)).recordset[0].c;
    assert(Number(lines) === 24, `expected 24 line items (12×2), got ${lines}`);
  });

  await test('W7 tie-in — a Scheduled (un-materialized) row blocks its period\'s close', async () => {
    // Run BEFORE any materialization: periods[5] still carries its pristine Scheduled row (and no Pending JE),
    // so the close gate's blocker is specifically "not yet materialized".
    const md = new Metadata();
    const period = await md.GetEntityObject<mjBizAppsAccountingAccountingPeriodEntity>(PERIOD_ENTITY, user);
    await period.Load(periods[5].ID);
    period.Status = 'Closing';
    await expectThrow(() => period.Save(), 'not yet materialized');
  });

  await test('S3 materialize — only DUE rows (asOf = period 3) become Pending JEs; future rows stay Scheduled', async () => {
    const asOf = new Date(periods[2].PeriodStart); // due: periods 1,2,3
    const res = await materializeDueScheduledEntries(companyId, asOf, user);
    assert(res.materialized === 3, `expected 3 materialized, got ${res.materialized}`);
    const counts = await sjeStatusCounts(ctx);
    assert(counts.generated === 3 && counts.scheduled === 9, `expected 3 Generated / 9 Scheduled, got ${counts.generated}/${counts.scheduled}`);
  });

  await test('S3 materialized JE is correct — Pending, EntryType mapped, back-ref set, balanced Dr/Cr lines copied', async () => {
    const je = (await pool.request().query(`SELECT TOP 1 j.ID, j.Status, j.EntryType, j.ScheduledJournalEntryID FROM ${SCHEMA}.JournalEntry j WHERE j.CompanyID='${companyId}' ORDER BY j.EffectiveDate ASC`)).recordset[0];
    assert(je.Status === 'Pending', `JE Status=${je.Status}`);
    assert(je.EntryType === 'RevenueRecognition', `JE EntryType=${je.EntryType} (expected mapped RevenueRecognition)`);
    assert(!!je.ScheduledJournalEntryID, 'JE must back-reference its ScheduledJournalEntryID');
    const ls = (await pool.request().query(`SELECT GLAccountID, DebitAmount, CreditAmount FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${je.ID}' ORDER BY LineNumber`)).recordset;
    assert(ls.length === 2, `expected 2 lines, got ${ls.length}`);
    const dr = ls.find((l: { DebitAmount: number | null }) => l.DebitAmount != null), cr = ls.find((l: { CreditAmount: number | null }) => l.CreditAmount != null);
    assert(!!dr && dr.GLAccountID.toUpperCase() === deferredGL.toUpperCase() && Number(dr.DebitAmount) === 100, `Dr line should be DeferredRevenue 100`);
    assert(!!cr && cr.GLAccountID.toUpperCase() === revenueGL.toUpperCase() && Number(cr.CreditAmount) === 100, `Cr line should be Revenue 100`);
  });

  await test('S3 coherence — a Generated SJE has GeneratedJournalEntryID + GeneratedAt (CK_SJE_GeneratedCoherence)', async () => {
    const g = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${companyId}' AND Status='Generated' AND (GeneratedJournalEntryID IS NULL OR GeneratedAt IS NULL)`)).recordset[0].c;
    assert(Number(g) === 0, `every Generated SJE must carry GeneratedJournalEntryID + GeneratedAt; ${g} incoherent`);
  });

  await test('S3 idempotency — re-running materialize for the same asOf materializes NOTHING new', async () => {
    const asOf = new Date(periods[2].PeriodStart);
    const res = await materializeDueScheduledEntries(companyId, asOf, user);
    assert(res.materialized === 0, `re-run should materialize 0, got ${res.materialized}`);
  });

  await test('S3 EntryType mapping — a PrepaidAmortization schedule materializes JEs with EntryType=PeriodEndAccrual', async () => {
    const ids = await createScheduledEntries(
      { companyId, entryType: 'PrepaidAmortization', currencyCode, totalAmount: 300, debitGLAccountId: revenueGL, creditGLAccountId: deferredGL, periods: [schedulePeriods[10]], description: `${RUN_TAG} prepaid` },
      user,
    );
    assert(ids.length === 1, 'expected 1 prepaid SJE');
    const res = await materializeDueScheduledEntries(companyId, new Date(periods[11].PeriodStart), user);
    assert(res.materialized >= 1, 'prepaid row should materialize');
    const je = (await pool.request().query(`SELECT EntryType FROM ${SCHEMA}.JournalEntry WHERE ScheduledJournalEntryID='${ids[0]}'`)).recordset[0];
    assert(je && je.EntryType === 'PeriodEndAccrual', `expected PeriodEndAccrual, got ${je?.EntryType}`);
  });

  await test('S3 dimension carry-through — a tag on a scheduled line is copied to the materialized JE line', async () => {
    const ids = await createScheduledEntries(
      { companyId, entryType: 'RevenueRecognition', currencyCode, totalAmount: 50, debitGLAccountId: deferredGL, creditGLAccountId: revenueGL, periods: [schedulePeriods[8]], description: `${RUN_TAG} dim` },
      user,
    );
    // tag the credit (Revenue) scheduled line with a dimension
    const sli = (await pool.request().query(`SELECT TOP 1 ID FROM ${SCHEMA}.ScheduledJournalEntryLineItem WHERE ScheduledJournalEntryID='${ids[0]}' AND CreditAmount IS NOT NULL`)).recordset[0].ID;
    await pool.request().query(`INSERT INTO ${SCHEMA}.ScheduledJournalEntryLineDimension (ID, ScheduledJournalEntryLineItemID, DimensionID, DimensionValueID) VALUES (NEWID(),'${sli}','${ctx.dimId}','${ctx.dimVal}')`);
    await materializeDueScheduledEntries(companyId, new Date(periods[8].PeriodStart), user);
    const tagged = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.ScheduledJournalEntryID='${ids[0]}'`)).recordset[0].c;
    assert(Number(tagged) === 1, `expected the dimension carried to 1 JE line, got ${tagged}`);
  });

  await test('Block4→Block2 — a materialized Pending JE flows into buildBatch (Company×Period)', async () => {
    // period 1 (index 0) has a materialized Pending rev-rec JE; batch it.
    const res = await buildBatch(companyId, periods[0].ID, 'BusinessCentral', user.ID, user, AutoApproveGate);
    assert(res !== null && res.jeCount >= 1, `expected the materialized JE to batch, got ${JSON.stringify(res)}`);
  });

  // ─── Teardown ──────────────────────────────────────────────────────────────
  const exec = async (q: string) => { try { await pool.request().query(q); } catch (e) { /* best-effort */ void e; } };
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch']) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (SELECT ID FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}')`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}'`);
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch']) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE sld FROM ${SCHEMA}.ScheduledJournalEntryLineDimension sld JOIN ${SCHEMA}.ScheduledJournalEntryLineItem sli ON sli.ID=sld.ScheduledJournalEntryLineItemID JOIN ${SCHEMA}.ScheduledJournalEntry s ON s.ID=sli.ScheduledJournalEntryID WHERE s.CompanyID='${companyId}'`);
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
  console.log(`\n────── Block 4 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
