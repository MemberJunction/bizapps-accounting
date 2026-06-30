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
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block2-runtime.ts
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
import '@mj-biz-apps/tasks-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { buildBatch, sendBatch, resolveExternalAccount, AutoApproveGate, TasksAppApprovalGate, type BatchApprovalGate } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingAccountingPeriodEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';
const TASK_ENTITY = 'MJ_BizApps_Tasks: Tasks';
const TASK_SCHEMA = '__mj_BizAppsTasks';
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
  pool: sql.ConnectionPool;
  /** db_owner pool (MJ_CodeGen) used ONLY for FK-aware teardown — the app user MJ_Connect lacks ALTER
   *  (can't DISABLE TRIGGER) and can't delete locked JEs/batches, which is the security model. */
  teardownPool: sql.ConnectionPool;
  user: UserInfo; companyId: string;
  arGL: string; revGL: string; unmappedGL: string;
  openPeriods: { ID: string }[]; dimId: string; dimValSales: string; dimValMktg: string;
  /** Person rows the real-gate scenario created (CFO, decider) — cleaned up in teardown. */
  personIds: string[];
}

async function bootstrap(): Promise<Ctx> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env (run from the instance worktree root).');
  const pool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
  // db_owner pool for teardown only (DISABLE TRIGGER + locked-row deletes the app user can't do).
  const { CODEGEN_DB_USERNAME: cgUser, CODEGEN_DB_PASSWORD: cgPassword } = process.env;
  if (!cgUser || !cgPassword) throw new Error('Missing CODEGEN_DB_USERNAME/PASSWORD in .env (needed for the db_owner teardown pool).');
  const teardownPool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user: cgUser, password: cgPassword, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
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

  return { pool, teardownPool, user: ctxUser, companyId, arGL: byCode.get('11201')!, revGL: byCode.get('40100')!, unmappedGL: byCode.get('50400')!, openPeriods: periods, dimId, dimValSales, dimValMktg, personIds: [] };
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

// ─── real-gate scenario helpers ──────────────────────────────────────────────

/** App-path: create a CFO Person in MJ_BizApps_Common.People. Tracks the id for teardown. Returns it. */
async function makeCFOPerson(ctx: Ctx, label: string): Promise<string> {
  const md = new Metadata();
  const person = await md.GetEntityObject<mjBizAppsCommonPersonEntity>(PERSON_ENTITY, ctx.user);
  person.NewRecord();
  person.FirstName = 'CFO';
  person.LastName = `${label}-${RUN_TAG}`;
  person.Status = 'Active';
  if (!(await person.Save())) throw new Error(`Person save failed: ${person.LatestResult?.CompleteMessage ?? 'unknown'}`);
  ctx.personIds.push(person.ID);
  return person.ID;
}

/** Set AccountingCompanyProfile.ApprovalCFOPersonID on the test company (app path). */
async function setCompanyCFO(ctx: Ctx, cfoPersonId: string | null): Promise<void> {
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctx.user);
  if (!(await acp.Load(ctx.companyId))) throw new Error(`could not load ACP for ${ctx.companyId}`);
  acp.ApprovalCFOPersonID = cfoPersonId;
  if (!(await acp.Save())) throw new Error(`ACP CFO update failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

/** The approval Task linked to a batch (polymorphic Task Link on the batch entity). Null if none. */
async function batchTask(ctx: Ctx, batchId: string): Promise<{ id: string; name: string } | null> {
  const r = await ctx.pool.request().query(
    `SELECT TOP 1 t.ID id, t.Name name FROM ${TASK_SCHEMA}.TaskLink l JOIN ${TASK_SCHEMA}.Task t ON t.ID=l.TaskID JOIN __mj.Entity e ON e.ID=l.EntityID WHERE e.Name='${BATCH_ENTITY}' AND l.RecordID='${batchId}' ORDER BY l.__mj_CreatedAt DESC`);
  const row = r.recordset[0];
  return row ? { id: row.id, name: row.name } : null;
}

/** How many TaskAssignments name `cfoPersonId` (in the People entity) for `taskId`. */
async function assignmentCountForCFO(ctx: Ctx, taskId: string, cfoPersonId: string): Promise<number> {
  const r = await ctx.pool.request().query(
    `SELECT COUNT(*) c FROM ${TASK_SCHEMA}.TaskAssignment a JOIN __mj.Entity e ON e.ID=a.AssigneeEntityID WHERE a.TaskID='${taskId}' AND e.Name='${PERSON_ENTITY}' AND a.AssigneeRecordID='${cfoPersonId}'`);
  return Number(r.recordset[0].c);
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyId } = ctx;
  console.log(`\n══════ Block 2 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);
  assert(ctx.openPeriods.length >= 10, `need >=10 open month periods, got ${ctx.openPeriods.length}`);
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

  // ─── S1 REAL gate: TasksAppApprovalGate backed by bizapps-tasks ────────────
  // Replaces AutoApproveGate in production. CFO resolved per-company via
  // AccountingCompanyProfile.ApprovalCFOPersonID (NO role fallback — hard-fail if unset).
  const realGate = new TasksAppApprovalGate();

  await test('S1 real gate — no CFO configured → buildBatch hard-fails with a clear "no CFO configured" error', async () => {
    await setCompanyCFO(ctx, null); // ensure unset
    // NOTE: onBatchBuilt is the LAST step of buildBatch — the batch + locked JEs already exist when it
    // throws. So this period (P[1]) is "spent"; the approve scenario uses a fresh period (P[9]).
    await makeJE(ctx, P[1], [{ gl: ctx.arGL, debit: 50 }, { gl: ctx.revGL, credit: 50 }]);
    await expectThrow(() => buildBatch(companyId, P[1], 'BusinessCentral', user.ID, user, realGate), 'no CFO configured');
  });

  let approveBatchId = '';
  let cfoPersonId = '';
  await test('S1 real gate — CFO set → buildBatch creates an "Approve JE Batch" Task + Task Link, assigned to the CFO', async () => {
    cfoPersonId = await makeCFOPerson(ctx, 'Approve');
    await setCompanyCFO(ctx, cfoPersonId);
    await makeJE(ctx, P[9], [{ gl: ctx.arGL, debit: 50 }, { gl: ctx.revGL, credit: 50 }]);
    const built = await buildBatch(companyId, P[9], 'BusinessCentral', user.ID, user, realGate);
    assert(built !== null, 'buildBatch returned null (expected a batch)');
    approveBatchId = built!.batchId;
    const task = await batchTask(ctx, approveBatchId);
    assert(task !== null, 'expected an approval Task linked to the batch');
    assert(/^Approve JE Batch #/.test(task!.name), `expected an "Approve JE Batch #…" Task, got '${task!.name}'`);
    assert((await assignmentCountForCFO(ctx, task!.id, cfoPersonId)) === 1, 'expected the Task assigned to the CFO Person');
  });

  await test('S1 real gate — sendBatch with NO decision is BLOCKED (not approved); batch stays Pending', async () => {
    await expectThrow(() => sendBatch(approveBatchId, user, { gate: realGate }), 'not approved');
    assert((await batchTotals(ctx, approveBatchId)).status === 'Pending', 'batch must remain Pending before approval');
  });

  await test('S1 real gate — recordDecision(Approved) → sendBatch succeeds → Acknowledged (JEs GLPosted)', async () => {
    await realGate.recordDecision(approveBatchId, 'Approved', cfoPersonId, 'Looks good — approved.', user);
    const batch = await sendBatch(approveBatchId, user, { gate: realGate });
    assert(batch.Status === 'Acknowledged', `expected Acknowledged after approval, got ${batch.Status}`);
    assert((batch.ExternalBatchRef ?? '').startsWith('MOCK-'), `expected a MOCK- ExternalBatchRef, got ${batch.ExternalBatchRef}`);
  });

  await test('S1 real gate — a separate batch, recordDecision(Rejected) → sendBatch BLOCKED; batch stays Pending', async () => {
    await makeJE(ctx, P[8], [{ gl: ctx.arGL, debit: 30 }, { gl: ctx.revGL, credit: 30 }]);
    const built = await buildBatch(companyId, P[8], 'BusinessCentral', user.ID, user, realGate);
    assert(built !== null, 'buildBatch returned null for the reject scenario');
    await realGate.recordDecision(built!.batchId, 'Rejected', cfoPersonId, 'Numbers off — rejected.', user);
    await expectThrow(() => sendBatch(built!.batchId, user, { gate: realGate }), 'not approved');
    assert((await batchTotals(ctx, built!.batchId)).status === 'Pending', 'rejected batch must remain Pending');
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

  // ─── Teardown ──────────────────────────────────────────────────────────────
  // Use the db_owner teardownPool (MJ_CodeGen): the app user can't DISABLE TRIGGER (no ALTER) nor
  // delete locked JEs/Acknowledged batches. db_owner does the FK-aware, trigger-off cleanup cleanly.
  const exec = async (q: string) => { try { await ctx.teardownPool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };

  // 1. Tasks-app rows our real-gate scenario created — linked to this company's batches via TaskLink.
  //    No immutability triggers here; delete children → links → tasks (FK-safe order). Capture the
  //    Task IDs to JS first (pool connections differ per query, so a #temp table wouldn't survive).
  let b2TaskIdList = '';
  try {
    const r = await ctx.teardownPool.request().query(
      `SELECT DISTINCT l.TaskID id FROM ${TASK_SCHEMA}.TaskLink l JOIN __mj.Entity e ON e.ID=l.EntityID JOIN ${SCHEMA}.JournalEntryBatch b ON b.ID=l.RecordID WHERE e.Name='${BATCH_ENTITY}' AND b.CompanyID='${companyId}'`);
    b2TaskIdList = (r.recordset ?? []).map((x: { id: string }) => `'${x.id}'`).join(',');
  } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
  if (b2TaskIdList) {
    await exec(`DELETE FROM ${TASK_SCHEMA}.TaskDecision WHERE TaskID IN (${b2TaskIdList})`);
    await exec(`DELETE FROM ${TASK_SCHEMA}.TaskActivity WHERE TaskID IN (${b2TaskIdList})`);
    await exec(`DELETE FROM ${TASK_SCHEMA}.TaskAssignment WHERE TaskID IN (${b2TaskIdList})`);
    await exec(`DELETE FROM ${TASK_SCHEMA}.TaskLink WHERE TaskID IN (${b2TaskIdList})`);
    await exec(`DELETE FROM ${TASK_SCHEMA}.Task WHERE ID IN (${b2TaskIdList})`);
  }

  // 2. Accounting rows (locked JEs / Acknowledged batches) — disable triggers via db_owner.
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

  // 3. CFO Person rows.
  for (const pid of ctx.personIds) await exec(`DELETE FROM __mj_BizAppsCommon.Person WHERE ID='${pid}'`);

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 2 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  await ctx.teardownPool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
