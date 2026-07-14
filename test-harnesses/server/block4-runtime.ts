/**
 * block4-runtime.ts — live validation of the Block-4 scheduled-JE schedule (S3).
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *
 * 2026-07-06 rework (engine-meeting rulings): the central MATERIALIZER was RETIRED (AM-6) —
 * DOMAIN entity servers generate the real Pending JE when a scheduled row comes due, then flip
 * the SJE to Generated. AccountingPeriod is gone, so schedules are keyed by effective date only.
 *
 *   S3  createScheduledEntries: a straight-line schedule lays down N Scheduled rows + balanced
 *       line pairs, summing EXACTLY to the total (cent-remainder spread, never lost).
 *   AM-6 domain-generation flow: the schema supports the new pattern — an entity-path update to
 *       Generated with the JE back-ref + GeneratedAt satisfies CK_SJE_GeneratedCoherence.
 *   INV (DB constraints/triggers — each proven with a RAW-SQL bypass):
 *       Generated-coherence CK · SJE delete lock (50016) · SJE field lock (50017) ·
 *       SJE line-item lock (50018).
 *
 * USAGE (cwd = instance worktree root): npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block4-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. FK-aware teardown via the db_owner pool.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { finishAndExit } from './harness-exit.js';
import { assertInvariantTriggers } from './trigger-preflight.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { createScheduledEntries } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingScheduledJournalEntryEntity,
} from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const SJE_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entries';
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

/** First-of-month UTC dates, n installments starting next month (future-dated schedule). */
function monthlyEffectiveDates(n: number): Date[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 + i, 1)));
}

interface Ctx {
  pool: sql.ConnectionPool;
  /** db_owner pool (MJ_CodeGen) used ONLY for FK-aware teardown (locked Generated rows). */
  teardownPool: sql.ConnectionPool;
  user: UserInfo; companyId: string; deferredGL: string; revenueGL: string; currencyCode: string;
}
const createdJEIds: string[] = [];

async function bootstrap(): Promise<Ctx> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env (run from the instance worktree root).');
  const pool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const { CODEGEN_DB_USERNAME: cgUser, CODEGEN_DB_PASSWORD: cgPassword } = process.env;
  if (!cgUser || !cgPassword) throw new Error('Missing CODEGEN_DB_USERNAME/PASSWORD in .env (needed for the db_owner teardown pool).');
  const teardownPool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user: cgUser, password: cgPassword, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await assertInvariantTriggers(pool); // pre-flight: fail fast if any invariant trigger is missing/disabled
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success})`);

  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctxUser);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} Co`;
  acp.Description = `${RUN_TAG} block4 test`;
  acp.CompanyCode = companyCode();
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, ctxUser);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  const deferredGL = byCode.get('21301'); const revenueGL = byCode.get('40100');
  if (!deferredGL || !revenueGL) throw new Error('seeded GL accounts not found');
  return { pool, teardownPool, user: ctxUser, companyId, deferredGL, revenueGL, currencyCode };
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyId, deferredGL, revenueGL, currencyCode } = ctx;
  console.log(`\n══════ Block 4 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);
  const md = new Metadata();

  let scheduleIds: string[] = [];
  await test('S3 createScheduledEntries — 12-installment $1200 rev-rec schedule → 12 Scheduled rows, balanced line pairs, exact sum', async () => {
    scheduleIds = await createScheduledEntries(
      { companyId, entryType: 'RevenueRecognition', currencyCode, totalAmount: 1200, debitGLAccountId: deferredGL, creditGLAccountId: revenueGL, periods: monthlyEffectiveDates(12).map(d => ({ effectiveDate: d })), description: `${RUN_TAG} revrec` },
      user,
    );
    assert(scheduleIds.length === 12, `expected 12 SJE rows, got ${scheduleIds.length}`);
    const agg = (await pool.request().query(`SELECT COUNT(*) c, SUM(TotalAmount) s, SUM(CASE WHEN Status='Scheduled' THEN 1 ELSE 0 END) sch FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${companyId}'`)).recordset[0];
    assert(Number(agg.c) === 12 && Number(agg.sch) === 12, `expected 12 Scheduled rows, got ${agg.c}/${agg.sch}`);
    assert(Number(agg.s) === 1200, `schedule must sum to EXACTLY 1200, got ${agg.s}`);
    const lines = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.ScheduledJournalEntryLineItem li JOIN ${SCHEMA}.ScheduledJournalEntry s ON s.ID=li.ScheduledJournalEntryID WHERE s.CompanyID='${companyId}'`)).recordset[0].c;
    assert(Number(lines) === 24, `expected 24 line items (12×2), got ${lines}`);
    const seq = (await pool.request().query(`SELECT MIN(ScheduleSequence) mn, MAX(ScheduleSequence) mx, MIN(ScheduleCount) c FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${companyId}'`)).recordset[0];
    assert(Number(seq.mn) === 1 && Number(seq.mx) === 12 && Number(seq.c) === 12, `sequence must run 1..12 of 12, got ${seq.mn}..${seq.mx} of ${seq.c}`);
  });

  await test('S3 cent-remainder spread — $100 over 3 → 33.34 + 33.33 + 33.33 (exact, no penny lost)', async () => {
    const ids = await createScheduledEntries(
      { companyId, entryType: 'PrepaidAmortization', currencyCode, totalAmount: 100, debitGLAccountId: revenueGL, creditGLAccountId: deferredGL, periods: monthlyEffectiveDates(3).map(d => ({ effectiveDate: d })), description: `${RUN_TAG} remainder` },
      user,
    );
    const idList = ids.map(id => `'${id}'`).join(',');
    const rows = (await pool.request().query(`SELECT ScheduleSequence sq, TotalAmount amt FROM ${SCHEMA}.ScheduledJournalEntry WHERE ID IN (${idList}) ORDER BY ScheduleSequence`)).recordset as Array<{ sq: number; amt: number }>;
    assert(rows.length === 3, `expected 3 rows, got ${rows.length}`);
    assert(Number(rows[0].amt) === 33.34 && Number(rows[1].amt) === 33.33 && Number(rows[2].amt) === 33.33,
      `expected 33.34/33.33/33.33, got ${rows.map(r => r.amt).join('/')}`);
  });

  // ─── AM-6 domain-generation flow (the pattern that REPLACED the materializer) ──
  let generatedSjeId = '';
  await test('AM-6 domain-generation — entity-path flip to Generated with JE back-ref + GeneratedAt saves cleanly', async () => {
    // Simulate what a domain entity server (e.g. a future SubscriptionEntityServer) does when a
    // scheduled row comes due: create the real Pending JE, then mark the SJE Generated with the back-ref.
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord();
    je.CompanyID = companyId; // MOD-12: single-company JEs
    je.EffectiveDate = new Date();
    je.EntryType = 'RevenueRecognition';
    je.Status = 'Pending';
    je.Description = `${RUN_TAG} domain-generated`;
    assert(await je.Save(), `JE save failed: ${je.LatestResult?.CompleteMessage}`);
    createdJEIds.push(je.ID);

    generatedSjeId = scheduleIds[0];
    const sje = await md.GetEntityObject<mjBizAppsAccountingScheduledJournalEntryEntity>(SJE_ENTITY, user);
    assert(await sje.Load(generatedSjeId), 'could not load the SJE');
    sje.Status = 'Generated';
    sje.GeneratedJournalEntryID = je.ID;
    sje.GeneratedAt = new Date();
    assert(await sje.Save(), `SJE Generated flip failed: ${sje.LatestResult?.CompleteMessage}`);
    // Raw cross-check: coherence holds in the DB.
    const g = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.ScheduledJournalEntry WHERE ID='${generatedSjeId}' AND Status='Generated' AND GeneratedJournalEntryID IS NOT NULL AND GeneratedAt IS NOT NULL`)).recordset[0].c;
    assert(Number(g) === 1, 'Generated SJE must carry GeneratedJournalEntryID + GeneratedAt');
  });

  await test('INV Generated-coherence — DB-bypass raw flip to Generated WITHOUT the back-ref → rejected (CK_SJE_GeneratedCoherence)', async () => {
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.ScheduledJournalEntry SET Status='Generated' WHERE ID='${scheduleIds[1]}'`), 'CK_SJE_GeneratedCoherence');
  });

  await test('INV SJE delete lock — DB-bypass DELETE of a Generated SJE → rejected (FK_SJELI / trg 50016 defense-in-depth)', async () => {
    // A real SJE always has line items pointing at it (FK_SJELI_ScheduledJE), so the FK rejects the
    // raw DELETE first; trg_SJE_Immutability (50016) is the backstop for a line-less row. Either way
    // the guarantee holds: a Generated schedule row cannot be deleted. Accept whichever guard fires.
    let threw = false, msg = '';
    try { await pool.request().query(`DELETE FROM ${SCHEMA}.ScheduledJournalEntry WHERE ID='${generatedSjeId}'`); }
    catch (e) { threw = true; msg = e instanceof Error ? e.message : String(e); }
    assert(threw, 'expected the Generated-SJE DELETE to be rejected');
    assert(/cannot be deleted|REFERENCE constraint|FK_SJELI/i.test(msg), `expected rejection by FK or trg 50016, got: ${msg.split('\n')[0]}`);
  });

  await test('INV SJE field lock — DB-bypass UPDATE of TotalAmount on a Generated SJE → rejected (50017)', async () => {
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.ScheduledJournalEntry SET TotalAmount = TotalAmount + 1 WHERE ID='${generatedSjeId}'`), 'locked once Generated');
  });

  await test('INV SJE line lock — DB-bypass UPDATE of a line item on a Generated SJE → rejected (50018)', async () => {
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.ScheduledJournalEntryLineItem SET DebitAmount = DebitAmount + 1 WHERE ScheduledJournalEntryID='${generatedSjeId}' AND DebitAmount IS NOT NULL`), 'cannot change once');
  });

  // ─── Teardown (db_owner pool — Generated rows are locked for the app user) ──
  const exec = async (q: string) => { try { await ctx.teardownPool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  const toggled = ['ScheduledJournalEntryLineItem', 'ScheduledJournalEntry', 'JournalEntry'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    await exec(`DELETE sld FROM ${SCHEMA}.ScheduledJournalEntryLineDimension sld JOIN ${SCHEMA}.ScheduledJournalEntryLineItem sli ON sli.ID=sld.ScheduledJournalEntryLineItemID JOIN ${SCHEMA}.ScheduledJournalEntry s ON s.ID=sli.ScheduledJournalEntryID WHERE s.CompanyID='${companyId}'`);
    await exec(`DELETE sli FROM ${SCHEMA}.ScheduledJournalEntryLineItem sli JOIN ${SCHEMA}.ScheduledJournalEntry s ON s.ID=sli.ScheduledJournalEntryID WHERE s.CompanyID='${companyId}'`);
    await exec(`DELETE FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID='${companyId}'`);
    if (createdJEIds.length > 0) {
      const jeIdList = createdJEIds.map(id => `'${id}'`).join(',');
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList})`);
    }
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj_BizAppsAccounting.JournalEntrySequence WHERE CompanyID='${companyId}'`); // per-company JE sequence rows (MOD-12)
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);

  const failed = outcomes.filter(o => !o.Passed);
  // NEVER `await pool.close()` before exit — the MJ provider pool can hang on close. Non-blocking close + force-exit.
  finishAndExit(`\n────── Block 4 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`, failed.length > 0 ? 1 : 0, pool, ctx.teardownPool);
}

void main();
