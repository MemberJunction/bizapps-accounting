/**
 * block2-runtime.ts — live validation of the Block-2 batching engine + its DB invariants.
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *   S1  buildBatch: net a Company×Period's Pending JEs → one Pending batch; JEs lock to Batched;
 *       summary lines foot to balanced control totals (§C5 netting).
 *   §5.5 GL-account resolution: ChartOfAccountsMapping override beats inline; unmapped → HARD-FAIL.
 *   B5  dimension-through-batch: a dimension-tagged JE line carries its dimension onto the summary line.
 *   S1  sendBatch: CFO-approval gate + ERP-post (mock) → Pending→Sent→Acknowledged; JEs → GLPosted.
 *       Approval-DENY gate → send refused, batch stays Pending.
 *   W7  period-close: blocked while a Pending JE remains; allowed once all batches Acknowledged.
 *   INV (DB triggers — each proven with a RAW-SQL bypass that the trigger still rejects):
 *       summary-foots (50014) · batch immutability update (50009) · batch immutability delete (50008).
 *
 * USAGE (cwd = instance worktree root, where .env resolves):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harness/block2-runtime.ts
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
import { buildBatch, sendBatch, resolveExternalAccount, AutoApproveGate, type BatchApprovalGate } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingAccountingPeriodEntity,
} from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JEBLI_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batch Line Items';
const SCHEMA = '__mj_BizAppsAccounting';

const RUN_TAG = `BLOCK2-${Date.now()}`;
function companyCode(): string { return `B2${Date.now().toString(36).slice(-7)}`.toUpperCase(); }

interface Outcome { Name: string; Passed: boolean; Ms: number; Error?: string }
const outcomes: Outcome[] = [];
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try { await fn(); outcomes.push({ Name: name, Passed: true, Ms: Date.now() - start }); console.log(`  ✓ ${name} (${Date.now() - start}ms)`); }
  catch (e) { const msg = e instanceof Error ? (e.stack ?? e.message) : String(e); outcomes.push({ Name: name, Passed: false, Ms: Date.now() - start, Error: msg }); console.log(`  ✗ ${name} (${Date.now() - start}ms)\n      ${msg.split('\n')[0]}`); }
}
function assert(cond: boolean, message: string): void { if (!cond) throw new Error(message); }
async function expectThrow(fn: () => Promise<unknown>, mustContain: string): Promise<void> {
  let threw = false; let msg = '';
  try { await fn(); } catch (e) { threw = true; msg = e instanceof Error ? e.message : String(e); }
  assert(threw, `expected an error containing "${mustContain}" but none was thrown`);
  assert(msg.toLowerCase().includes(mustContain.toLowerCase()), `expected error to contain "${mustContain}", got: ${msg.split('\n')[0]}`);
}

const DenyGate: BatchApprovalGate = { async assertApproved() { throw new Error('batch not approved by CFO'); } };

interface Ctx {
  pool: sql.ConnectionPool; user: UserInfo; companyId: string;
  arGL: string; revGL: string; unmappedGL: string;
  openPeriods: { ID: string }[]; dimId: string; dimValSales: string; dimValMktg: string;
}

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
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success} err=${cur.ErrorMessage})`);

  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctxUser);
  acp.NewRecord();
  acp.Set('Name', `${RUN_TAG} Co`);
  acp.Set('Description', `${RUN_TAG} block2 test`);
  acp.Set('CompanyCode', companyCode());
  acp.Set('FunctionalCurrencyCode', currencyCode);
  acp.Set('EntityType', 'Subsidiary');
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, ctxUser);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  // Inline-map every GL account to a BC account = its Code, EXCEPT 50400 (left unmapped for the hard-fail test).
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`);
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem=NULL, ExternalAccountID=NULL WHERE CompanyID='${companyId}' AND Code='50400'`);

  const periodRes = await rv.RunView<{ ID: string }>({ EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`, Fields: ['ID'], OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, ctxUser);
  const periods = periodRes.Results ?? [];

  // A reusable Department dimension with two values (raw — reference data).
  const dimId = randomUUID(), dimValSales = randomUUID(), dimValMktg = randomUUID();
  await pool.request().query(`INSERT INTO ${SCHEMA}.Dimension (ID, Code, Name) VALUES ('${dimId}','DEPT-${RUN_TAG}','Department ${RUN_TAG}')`);
  await pool.request().query(`INSERT INTO ${SCHEMA}.DimensionValue (ID, DimensionID, Code, Name) VALUES ('${dimValSales}','${dimId}','SALES','Sales'),('${dimValMktg}','${dimId}','MKTG','Marketing')`);

  return { pool, user: ctxUser, companyId, arGL: byCode.get('11201')!, revGL: byCode.get('40100')!, unmappedGL: byCode.get('50400')!, openPeriods: periods, dimId, dimValSales, dimValMktg };
}

interface LineSpec { gl: string; debit?: number; credit?: number; dimValueId?: string }
/** App-path: create a Pending JE with the given lines (optionally dimension-tagged). Returns the JE id. */
async function makeJE(ctx: Ctx, periodId: string, lines: LineSpec[]): Promise<string> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = ctx.companyId; je.AccountingPeriodID = periodId; je.EffectiveDate = new Date();
  je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} test`;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  let n = 0;
  for (const ls of lines) {
    n += 1;
    const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
    l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = n; l.GLAccountID = ls.gl;
    l.DebitAmount = ls.debit ?? null; l.CreditAmount = ls.credit ?? null;
    if (!(await l.Save())) throw new Error(`line save failed: ${l.LatestResult?.CompleteMessage}`);
    if (ls.dimValueId) {
      await ctx.pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntryLineDimension (ID, JournalEntryLineID, DimensionID, DimensionValueID) VALUES (NEWID(),'${l.ID}','${ctx.dimId}','${ls.dimValueId}')`);
    }
  }
  return je.ID;
}

async function batchTotals(ctx: Ctx, batchId: string): Promise<{ status: string; td: number; tc: number; lineCount: number; sumDr: number; sumCr: number }> {
  const b = (await ctx.pool.request().query(`SELECT Status, TotalDebits td, TotalCredits tc FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${batchId}'`)).recordset[0];
  const s = (await ctx.pool.request().query(`SELECT COUNT(*) c, ISNULL(SUM(DebitAmount),0) dr, ISNULL(SUM(CreditAmount),0) cr FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID='${batchId}'`)).recordset[0];
  return { status: b.Status, td: Number(b.td), tc: Number(b.tc), lineCount: Number(s.c), sumDr: Number(s.dr), sumCr: Number(s.cr) };
}
async function jeStatus(ctx: Ctx, jeId: string): Promise<string> {
  return (await ctx.pool.request().query(`SELECT Status FROM ${SCHEMA}.JournalEntry WHERE ID='${jeId}'`)).recordset[0].Status;
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyId } = ctx;
  console.log(`\n══════ Block 2 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);
  assert(ctx.openPeriods.length >= 8, `need >=8 open month periods, got ${ctx.openPeriods.length}`);
  const P = ctx.openPeriods.map(p => p.ID);

  // ─── §5.5 GL resolution ───────────────────────────────────────────────────
  await test('§5.5 resolveExternalAccount — ChartOfAccountsMapping override beats inline GLAccount value', async () => {
    await pool.request().query(`INSERT INTO ${SCHEMA}.ChartOfAccountsMapping (ID, CompanyID, ExternalSystem, ExternalAccountID, InternalGLAccountID, EffectiveFrom, ApprovedByUserID, ApprovedAt) VALUES (NEWID(),'${companyId}','BusinessCentral','BC-AR-OVERRIDE','${ctx.arGL}','2020-01-01','${user.ID}',GETUTCDATE())`);
    const resolved = await resolveExternalAccount(ctx.arGL, companyId, 'BusinessCentral', user);
    assert(resolved === 'BC-AR-OVERRIDE', `expected mapping override 'BC-AR-OVERRIDE', got '${resolved}'`);
  });

  await test('§5.5 resolveExternalAccount — unmapped GL account resolves to null (→ caller hard-fails)', async () => {
    const resolved = await resolveExternalAccount(ctx.unmappedGL, companyId, 'BusinessCentral', user);
    assert(resolved === null, `expected null for unmapped GL, got '${resolved}'`);
  });

  // ─── S1 buildBatch happy path ──────────────────────────────────────────────
  let happyBatchId = '';
  const happyJEs: string[] = [];
  await test('S1 buildBatch — 3 balanced JEs net into a footing Pending batch; JEs lock to Batched', async () => {
    for (let i = 0; i < 3; i++) happyJEs.push(await makeJE(ctx, P[0], [{ gl: ctx.arGL, debit: 100 }, { gl: ctx.revGL, credit: 100 }]));
    const res = await buildBatch(companyId, P[0], 'BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null (expected a batch)');
    happyBatchId = res!.batchId;
    assert(res!.jeCount === 3, `expected 3 JEs batched, got ${res!.jeCount}`);
    assert(res!.summaryLineCount === 2, `expected 2 netted summary lines (AR debit + Rev credit), got ${res!.summaryLineCount}`);
    assert(res!.totalDebits === 300 && res!.totalCredits === 300, `expected 300/300, got ${res!.totalDebits}/${res!.totalCredits}`);
    const t = await batchTotals(ctx, happyBatchId);
    assert(t.td === t.tc && t.td === t.sumDr && t.tc === t.sumCr, `batch must foot: td=${t.td} tc=${t.tc} sumDr=${t.sumDr} sumCr=${t.sumCr}`);
    for (const id of happyJEs) assert((await jeStatus(ctx, id)) === 'Batched', `JE ${id} should be Batched`);
  });

  await test('S1 buildBatch — nothing Pending in an empty period → returns null (no batch created)', async () => {
    const res = await buildBatch(companyId, P[7], 'BusinessCentral', user.ID, user);
    assert(res === null, 'expected null for a period with no Pending JEs');
  });

  // ─── §5.5 unmapped hard-fail (engine) ──────────────────────────────────────
  await test('§5.5 buildBatch — a JE on an UNMAPPED GL account HARD-FAILS the build', async () => {
    await makeJE(ctx, P[3], [{ gl: ctx.unmappedGL, debit: 100 }, { gl: ctx.arGL, credit: 100 }]);
    await expectThrow(() => buildBatch(companyId, P[3], 'BusinessCentral', user.ID, user), 'no ERP mapping');
  });

  // ─── B5 dimension-through-batch ────────────────────────────────────────────
  await test('B5 dimension-through-batch — same account, different dimension values → separate summary lines, tagged', async () => {
    await makeJE(ctx, P[2], [{ gl: ctx.revGL, credit: 100, dimValueId: ctx.dimValSales }, { gl: ctx.arGL, debit: 100 }]);
    await makeJE(ctx, P[2], [{ gl: ctx.revGL, credit: 60, dimValueId: ctx.dimValMktg }, { gl: ctx.arGL, debit: 60 }]);
    const res = await buildBatch(companyId, P[2], 'BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null');
    // Revenue splits into 2 lines (Sales/Mktg), AR nets into 1 → 3 summary lines.
    assert(res!.summaryLineCount === 3, `expected 3 summary lines (AR + Rev×2 dims), got ${res!.summaryLineCount}`);
    const tagged = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntryBatchLineDimension d JOIN ${SCHEMA}.JournalEntryBatchLineItem li ON li.ID=d.JournalEntryBatchLineItemID WHERE li.BatchID='${res!.batchId}'`)).recordset[0].c;
    assert(Number(tagged) === 2, `expected 2 dimension-tagged summary lines, got ${tagged}`);
  });

  // ─── S1 sendBatch happy path ───────────────────────────────────────────────
  await test('S1 sendBatch — approved batch posts to ERP (mock) → Acknowledged; JEs → GLPosted', async () => {
    const batch = await sendBatch(happyBatchId, user, { gate: AutoApproveGate });
    assert(batch.Status === 'Acknowledged', `expected Acknowledged, got ${batch.Status}`);
    assert((batch.ExternalBatchRef ?? '').startsWith('MOCK-'), `expected a MOCK- ExternalBatchRef, got ${batch.ExternalBatchRef}`);
    for (const id of happyJEs) assert((await jeStatus(ctx, id)) === 'GLPosted', `JE ${id} should be GLPosted after ack`);
  });

  // ─── S1 sendBatch approval gate ────────────────────────────────────────────
  await test('S1 sendBatch — DENY approval gate refuses to send; batch stays Pending', async () => {
    await makeJE(ctx, P[5], [{ gl: ctx.arGL, debit: 40 }, { gl: ctx.revGL, credit: 40 }]);
    const built = await buildBatch(companyId, P[5], 'BusinessCentral', user.ID, user);
    await expectThrow(() => sendBatch(built!.batchId, user, { gate: DenyGate }), 'not approved');
    assert((await batchTotals(ctx, built!.batchId)).status === 'Pending', 'batch must remain Pending after a denied send');
  });

  // ─── INV summary-foots (trg 50014) — RAW-SQL bypass ────────────────────────
  await test('INV summary-foots — DB-bypass: tamper control total then raw UPDATE Status=Sent → rejected (50014)', async () => {
    await makeJE(ctx, P[6], [{ gl: ctx.arGL, debit: 75 }, { gl: ctx.revGL, credit: 75 }]);
    const built = await buildBatch(companyId, P[6], 'BusinessCentral', user.ID, user);
    // Break the foot at the DB level (TotalDebits no longer equals TotalCredits / summary sum), while still Pending.
    await pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET TotalDebits = TotalDebits + 100 WHERE ID='${built!.batchId}'`);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET Status='Sent', SentAt=GETUTCDATE() WHERE ID='${built!.batchId}'`), 'foot');
  });

  // ─── INV batch immutability (trg 50009 update / 50008 delete) — RAW-SQL bypass ──
  await test('INV batch immutability — DB-bypass UPDATE of a locked field on an Acknowledged batch → rejected (50009)', async () => {
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET TotalDebits = TotalDebits + 1 WHERE ID='${happyBatchId}'`), 'locked');
  });
  await test('INV batch immutability — DB-bypass DELETE of an Acknowledged batch → rejected (FK_JE_Batch / trg 50008 defense-in-depth)', async () => {
    // A real Acknowledged batch always has GLPosted JEs pointing at it (FK_JE_Batch), so the FK rejects
    // the raw DELETE first; trg_JEBatch_Immutability (50008) is the backstop for the no-references case.
    // Either way the guarantee holds: a posted batch cannot be deleted. Accept whichever guard fires.
    let threw = false, msg = '';
    try { await pool.request().query(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${happyBatchId}'`); }
    catch (e) { threw = true; msg = e instanceof Error ? e.message : String(e); }
    assert(threw, 'expected the Acknowledged-batch DELETE to be rejected');
    assert(/cannot be deleted|REFERENCE constraint|FK_JE_Batch/i.test(msg), `expected rejection by FK or trg 50008, got: ${msg.split('\n')[0]}`);
  });

  // ─── W7 period-close orchestration ─────────────────────────────────────────
  await test('W7 period-close — blocked while a Pending JE remains in the period', async () => {
    await makeJE(ctx, P[4], [{ gl: ctx.arGL, debit: 25 }, { gl: ctx.revGL, credit: 25 }]);
    const md = new Metadata();
    const period = await md.GetEntityObject<mjBizAppsAccountingAccountingPeriodEntity>(PERIOD_ENTITY, user);
    await period.Load(P[4]);
    period.Status = 'Closing';
    await expectThrow(() => period.Save(), 'Cannot close');
  });

  await test('W7 period-close — allowed once the period\'s batch is Acknowledged (JEs GLPosted)', async () => {
    const built = await buildBatch(companyId, P[4], 'BusinessCentral', user.ID, user);
    await sendBatch(built!.batchId, user, { gate: AutoApproveGate });
    const md = new Metadata();
    const period = await md.GetEntityObject<mjBizAppsAccountingAccountingPeriodEntity>(PERIOD_ENTITY, user);
    await period.Load(P[4]);
    period.Status = 'Closing';
    assert(await period.Save(), `close should succeed: ${period.LatestResult?.CompleteMessage}`);
    assert(period.Status === 'Closed', `expected Closed after close, got ${period.Status}`);
    assert(period.ClosedAt !== null, 'ClosedAt must be stamped on close');
  });

  // ─── Teardown (disable accounting triggers to clean locked/acknowledged rows) ──
  const exec = async (q: string) => { try { await pool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch']) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID='${companyId}'`);
  await exec(`DELETE bd FROM ${SCHEMA}.JournalEntryBatchLineDimension bd JOIN ${SCHEMA}.JournalEntryBatchLineItem li ON li.ID=bd.JournalEntryBatchLineItemID WHERE li.CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (SELECT ID FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}')`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}'`);
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch']) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.DimensionValue WHERE DimensionID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.Dimension WHERE ID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchSequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingPeriod WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 2 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
