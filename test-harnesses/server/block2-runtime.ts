/**
 * block2-runtime.ts — live validation of the Block-2 batching engine + its DB invariants.
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *
 * 2026-07-06 rework (engine-meeting rulings): batches are MULTI-COMPANY (CH-4) and buildBatch
 * is GLOBAL — it sweeps EVERY Pending JE (no company/period arguments; AccountingPeriod is gone).
 * The batch lifecycle is Pending → Approved → Sent → Posted (| Failed | Cancelled), with an
 * explicit approveBatch step. ERP account resolution never hard-fails: COAMapping override →
 * GLAccount.ExternalAccountID → the account Code itself (AM-4: the wire format IS the account number).
 *
 *   §5.5 resolveExternalAccount: mapping override beats inline; unmapped falls back to Code (AM-4).
 *   S1  buildBatch: ALL Pending JEs → one Pending batch; netting keys on company×account×dims;
 *       companyCount reported; JEs lock to Batched; summary foots (§C5).
 *   B5  dimension-through-batch: a dimension-tagged JE line carries its dimension onto the summary line.
 *   S1  approveBatch: Pending→Approved + ApprovedAt/ApprovedByUserID audit; only-Pending guard.
 *   S1  sendBatch: requires Approved + CFO gate → Sent → Posted (mock ERP); JEs → GLPosted.
 *       DENY gate → send refused. Real TasksAppApprovalGate: per-company CFO resolution
 *       (union across ALL companies in the batch — one Task, all CFOs assigned), approve/reject flows.
 *   INV (DB triggers — each proven with a RAW-SQL bypass that the trigger still rejects):
 *       summary-foots overall (50014) · summary-foots PER COMPANY (50023, AM-4) ·
 *       batch immutability update (50009) · batch immutability delete (50008/FK).
 *
 * PRECONDITION: buildBatch is global, so the harness requires ZERO stray Pending JEs at bootstrap
 * (it fails fast otherwise). Never run two harnesses against this DB concurrently.
 *
 * USAGE (cwd = instance worktree root, where .env resolves):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block2-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. FK-aware teardown via the db_owner pool.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { assertInvariantTriggers } from './trigger-preflight.js';
import { finishAndExit } from './harness-exit.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/tasks-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { buildBatch, approveBatch, sendBatch, cancelBatch, regenerateBatch, resolveExternalAccount, AutoApproveGate, TasksAppApprovalGate, type BatchApprovalGate } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';
const TASK_SCHEMA = '__mj_BizAppsTasks';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const SCHEMA = '__mj_BizAppsAccounting';

const RUN_TAG = `BLOCK2-${Date.now()}`;
let companyCodeCounter = 0;
function companyCode(): string { return `B2${(companyCodeCounter++)}${Date.now().toString(36).slice(-6)}`.toUpperCase(); }

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

interface Company { id: string; arGL: string; revGL: string; unmappedGL: string }
interface Ctx {
  pool: sql.ConnectionPool;
  /** db_owner pool (MJ_CodeGen) used ONLY for FK-aware teardown — the app user MJ_Connect lacks ALTER
   *  (can't DISABLE TRIGGER) and can't delete locked JEs/batches, which is the security model. */
  teardownPool: sql.ConnectionPool;
  user: UserInfo; companyA: Company; companyB: Company;
  dimId: string; dimValSales: string; dimValMktg: string;
  /** Person rows the real-gate scenarios created (CFOs) — cleaned up in teardown. */
  personIds: string[];
}

/** Every JE this run created (buildBatch is global, so teardown sweeps by tracked ID, not company). */
const createdJEIds: string[] = [];

async function createCompany(user: UserInfo, currencyCode: string, pool: sql.ConnectionPool, label: string): Promise<Company> {
  const md = new Metadata();
  const rv = new RunView();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} ${label}`;
  acp.Description = `${RUN_TAG} block2 test (${label})`;
  acp.CompanyCode = companyCode();
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  const id = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed (${label}): ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
  // Inline-map every GL account to a BC account = its Code, EXCEPT 50400 (left unmapped for the Code-fallback test).
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${id}'`);
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem=NULL, ExternalAccountID=NULL WHERE CompanyID='${id}' AND Code='50400'`);
  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${id}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  const arGL = byCode.get('11201'); const revGL = byCode.get('40100'); const unmappedGL = byCode.get('50400');
  if (!arGL || !revGL || !unmappedGL) throw new Error(`seeded GL accounts not found for ${label}`);
  return { id, arGL, revGL, unmappedGL };
}

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

  // buildBatch is GLOBAL — stray Pending JEs from another run/harness would be swept into this
  // run's batches and corrupt the exact-value assertions. Fail fast instead.
  const stray = (await pool.request().query(`SELECT COUNT(*) n FROM ${SCHEMA}.JournalEntry WHERE Status='Pending'`)).recordset[0].n;
  if (Number(stray) > 0) throw new Error(`${stray} stray Pending JE(s) exist — clean them up before running block2 (buildBatch sweeps ALL Pending JEs).`);

  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success} err=${cur.ErrorMessage})`);

  const companyA = await createCompany(ctxUser, currencyCode, pool, 'Co A');
  const companyB = await createCompany(ctxUser, currencyCode, pool, 'Co B');

  // A reusable Department dimension with two values (raw — reference data).
  const dimId = randomUUID(), dimValSales = randomUUID(), dimValMktg = randomUUID();
  await pool.request().query(`INSERT INTO ${SCHEMA}.Dimension (ID, Code, Name) VALUES ('${dimId}','DEPT-${RUN_TAG}','Department ${RUN_TAG}')`);
  await pool.request().query(`INSERT INTO ${SCHEMA}.DimensionValue (ID, DimensionID, Code, Name) VALUES ('${dimValSales}','${dimId}','SALES','Sales'),('${dimValMktg}','${dimId}','MKTG','Marketing')`);

  return { pool, teardownPool, user: ctxUser, companyA, companyB, dimId, dimValSales, dimValMktg, personIds: [] };
}

interface LineSpec { gl: string; debit?: number; credit?: number; dimValueId?: string }
/** App-path: create a Pending JE with the given lines (optionally dimension-tagged). Returns the JE id. */
async function makeJE(ctx: Ctx, lines: LineSpec[]): Promise<string> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.EffectiveDate = new Date();
  je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} test`;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  createdJEIds.push(je.ID);
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

interface BatchDbState { status: string; td: number; tc: number; lineCount: number; sumDr: number; sumCr: number; approvedAt: Date | null; approvedBy: string | null; postedAt: Date | null }
async function batchState(ctx: Ctx, batchId: string): Promise<BatchDbState> {
  const b = (await ctx.pool.request().query(`SELECT Status, TotalDebits td, TotalCredits tc, ApprovedAt, ApprovedByUserID, PostedAt FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${batchId}'`)).recordset[0];
  const s = (await ctx.pool.request().query(`SELECT COUNT(*) c, ISNULL(SUM(DebitAmount),0) dr, ISNULL(SUM(CreditAmount),0) cr FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID='${batchId}'`)).recordset[0];
  return { status: b.Status, td: Number(b.td), tc: Number(b.tc), lineCount: Number(s.c), sumDr: Number(s.dr), sumCr: Number(s.cr), approvedAt: b.ApprovedAt, approvedBy: b.ApprovedByUserID, postedAt: b.PostedAt };
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

/** Set AccountingCompanyProfile.ApprovalCFOPersonID on a test company (app path). */
async function setCompanyCFO(ctx: Ctx, companyId: string, cfoPersonId: string | null): Promise<void> {
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctx.user);
  if (!(await acp.Load(companyId))) throw new Error(`could not load ACP for ${companyId}`);
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
  const { pool, user, companyA, companyB } = ctx;
  console.log(`\n══════ Block 2 runtime validation — user=${user.Email} companies=${companyA.id},${companyB.id} tag=${RUN_TAG} ══════\n`);

  // ─── §5.5 GL resolution (AM-4: wire format = account number; never hard-fails) ──
  await test('§5.5 resolveExternalAccount — ChartOfAccountsMapping override beats inline GLAccount value', async () => {
    await pool.request().query(`INSERT INTO ${SCHEMA}.ChartOfAccountsMapping (ID, CompanyID, ExternalSystem, ExternalAccountID, InternalGLAccountID, EffectiveFrom, ApprovedByUserID, ApprovedAt) VALUES (NEWID(),'${companyA.id}','BusinessCentral','BC-AR-OVERRIDE','${companyA.arGL}','2020-01-01','${user.ID}',GETUTCDATE())`);
    const resolved = await resolveExternalAccount(companyA.arGL, companyA.id, 'BusinessCentral', user);
    assert(resolved === 'BC-AR-OVERRIDE', `expected mapping override 'BC-AR-OVERRIDE', got '${resolved}'`);
  });

  await test('§5.5 resolveExternalAccount — unmapped GL account falls back to its account Code (AM-4; old hard-fail retired)', async () => {
    const resolved = await resolveExternalAccount(companyA.unmappedGL, companyA.id, 'BusinessCentral', user);
    assert(resolved === '50400', `expected the Code fallback '50400' for an unmapped GL, got '${resolved}'`);
  });

  // ─── S1 buildBatch ─────────────────────────────────────────────────────────
  await test('S1 buildBatch — nothing Pending → returns null (no batch created)', async () => {
    const res = await buildBatch('BusinessCentral', user.ID, user);
    assert(res === null, 'expected null when no Pending JEs exist');
  });

  let happyBatchId = '';
  const happyJEs: string[] = [];
  await test('S1 buildBatch — 3 balanced JEs net into a footing Pending batch; JEs lock to Batched', async () => {
    for (let i = 0; i < 3; i++) happyJEs.push(await makeJE(ctx, [{ gl: companyA.arGL, debit: 100 }, { gl: companyA.revGL, credit: 100 }]));
    const res = await buildBatch('BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null (expected a batch)');
    happyBatchId = res!.batchId;
    assert(res!.jeCount === 3, `expected 3 JEs batched, got ${res!.jeCount}`);
    assert(res!.summaryLineCount === 2, `expected 2 netted summary lines (AR debit + Rev credit), got ${res!.summaryLineCount}`);
    assert(res!.totalDebits === 300 && res!.totalCredits === 300, `expected 300/300, got ${res!.totalDebits}/${res!.totalCredits}`);
    assert(res!.companyCount === 1, `expected companyCount 1, got ${res!.companyCount}`);
    const t = await batchState(ctx, happyBatchId);
    assert(t.status === 'Pending', `new batch must be Pending, got ${t.status}`);
    assert(t.td === t.tc && t.td === t.sumDr && t.tc === t.sumCr, `batch must foot: td=${t.td} tc=${t.tc} sumDr=${t.sumDr} sumCr=${t.sumCr}`);
    for (const id of happyJEs) assert((await jeStatus(ctx, id)) === 'Batched', `JE ${id} should be Batched`);
  });

  let multiCoBatchId = '';
  await test('S1 buildBatch — MULTI-COMPANY sweep: JEs across 2 companies → one batch, companyCount 2, per-company summary lines, Code on unmapped wire (AM-4)', async () => {
    await makeJE(ctx, [{ gl: companyA.arGL, debit: 100 }, { gl: companyA.revGL, credit: 100 }]);
    await makeJE(ctx, [{ gl: companyB.arGL, debit: 40 }, { gl: companyB.unmappedGL, credit: 40 }]);
    const res = await buildBatch('BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null (expected a batch)');
    multiCoBatchId = res!.batchId;
    assert(res!.jeCount === 2, `expected 2 JEs batched, got ${res!.jeCount}`);
    assert(res!.companyCount === 2, `expected companyCount 2, got ${res!.companyCount}`);
    assert(res!.summaryLineCount === 4, `expected 4 summary lines (2 accounts × 2 companies), got ${res!.summaryLineCount}`);
    assert(res!.totalDebits === 140 && res!.totalCredits === 140, `expected 140/140, got ${res!.totalDebits}/${res!.totalCredits}`);
    // Per-company summary line integrity + the AM-4 Code-fallback on the wire:
    const rows = (await pool.request().query(`SELECT CompanyID, ExternalAccountID, ISNULL(DebitAmount,0) dr, ISNULL(CreditAmount,0) cr FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID='${multiCoBatchId}'`)).recordset as Array<{ CompanyID: string; ExternalAccountID: string; dr: number; cr: number }>;
    const byCo = (id: string) => rows.filter(r => r.CompanyID.toLowerCase() === id.toLowerCase());
    assert(byCo(companyA.id).length === 2 && byCo(companyB.id).length === 2, `expected 2 summary lines per company, got A=${byCo(companyA.id).length} B=${byCo(companyB.id).length}`);
    const unmappedLine = rows.find(r => Number(r.cr) === 40);
    assert(!!unmappedLine && unmappedLine.ExternalAccountID === '50400', `unmapped GL's summary line must carry the account Code '50400', got '${unmappedLine?.ExternalAccountID}'`);
  });

  // ─── B5 dimension-through-batch ────────────────────────────────────────────
  let dimBatchId = '';
  await test('B5 dimension-through-batch — same account, different dimension values → separate summary lines, tagged', async () => {
    await makeJE(ctx, [{ gl: companyA.revGL, credit: 100, dimValueId: ctx.dimValSales }, { gl: companyA.arGL, debit: 100 }]);
    await makeJE(ctx, [{ gl: companyA.revGL, credit: 60, dimValueId: ctx.dimValMktg }, { gl: companyA.arGL, debit: 60 }]);
    const res = await buildBatch('BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null');
    dimBatchId = res!.batchId;
    // Revenue splits into 2 lines (Sales/Mktg), AR nets into 1 → 3 summary lines.
    assert(res!.summaryLineCount === 3, `expected 3 summary lines (AR + Rev×2 dims), got ${res!.summaryLineCount}`);
    const tagged = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntryBatchLineDimension d JOIN ${SCHEMA}.JournalEntryBatchLineItem li ON li.ID=d.JournalEntryBatchLineItemID WHERE li.BatchID='${dimBatchId}'`)).recordset[0].c;
    assert(Number(tagged) === 2, `expected 2 dimension-tagged summary lines, got ${tagged}`);
  });

  // ─── S1 approveBatch (NEW lifecycle step: Pending → Approved) ──────────────
  await test('S1 sendBatch on a PENDING batch → refused (only an Approved batch can be sent)', async () => {
    await expectThrow(() => sendBatch(happyBatchId, user, { gate: AutoApproveGate }), 'only an Approved batch can be sent');
    assert((await batchState(ctx, happyBatchId)).status === 'Pending', 'batch must remain Pending');
  });

  await test('S1 approveBatch — Pending → Approved with ApprovedAt/ApprovedByUserID audit stamps', async () => {
    const approved = await approveBatch(happyBatchId, user.ID, user);
    assert(approved.Status === 'Approved', `expected Approved, got ${approved.Status}`);
    const t = await batchState(ctx, happyBatchId);
    assert(t.status === 'Approved', `DB status must be Approved, got ${t.status}`);
    assert(t.approvedAt !== null, 'ApprovedAt must be stamped');
    assert((t.approvedBy ?? '').toLowerCase() === user.ID.toLowerCase(), `ApprovedByUserID must be the approver, got ${t.approvedBy}`);
  });

  await test('S1 approveBatch — a non-Pending batch cannot be approved again', async () => {
    await expectThrow(() => approveBatch(happyBatchId, user.ID, user), 'only a Pending batch can be approved');
  });

  // ─── S1 sendBatch happy path (Approved → Sent → Posted) ────────────────────
  await test('S1 sendBatch — Approved batch posts to ERP (mock) → Posted (PostedAt stamped); JEs → GLPosted', async () => {
    const batch = await sendBatch(happyBatchId, user, { gate: AutoApproveGate });
    assert(batch.Status === 'Posted', `expected Posted, got ${batch.Status}`);
    assert((batch.ExternalBatchRef ?? '').startsWith('MOCK-'), `expected a MOCK- ExternalBatchRef, got ${batch.ExternalBatchRef}`);
    assert((await batchState(ctx, happyBatchId)).postedAt !== null, 'PostedAt must be stamped');
    for (const id of happyJEs) assert((await jeStatus(ctx, id)) === 'GLPosted', `JE ${id} should be GLPosted after post`);
  });

  // ─── S1 sendBatch approval gate ────────────────────────────────────────────
  await test('S1 sendBatch — DENY approval gate refuses to send; batch stays Approved (not Sent)', async () => {
    await approveBatch(dimBatchId, user.ID, user);
    await expectThrow(() => sendBatch(dimBatchId, user, { gate: DenyGate }), 'not approved');
    assert((await batchState(ctx, dimBatchId)).status === 'Approved', 'batch must remain Approved after a denied send');
  });

  // ─── S1 REAL gate: TasksAppApprovalGate backed by bizapps-tasks ────────────
  // Replaces AutoApproveGate in production. CFOs resolved per-company via
  // AccountingCompanyProfile.ApprovalCFOPersonID for EVERY company in the batch
  // (union — one Task assigned to all CFOs; NO role fallback — hard-fail if any unset).
  const realGate = new TasksAppApprovalGate();

  await test('S1 real gate — no CFO configured → buildBatch hard-fails AND auto-reverses (Q5 atomicity: JE freed to Pending, no orphan locked batch)', async () => {
    await setCompanyCFO(ctx, companyA.id, null); // ensure unset
    const orphanJE = await makeJE(ctx, [{ gl: companyA.arGL, debit: 50 }, { gl: companyA.revGL, credit: 50 }]);
    await expectThrow(() => buildBatch('BusinessCentral', user.ID, user, realGate), 'No CFO configured');
    // Atomicity fix (plan §8 / Q5): the failed approval-task raise reverses the still-preliminary lock, so the
    // JE returns to the candidate pool instead of being stranded in a task-less locked batch.
    assert((await jeStatus(ctx, orphanJE)) === 'Pending', 'JE must be freed back to Pending after a gate-failed build');
    const bid = (await pool.request().query(`SELECT BatchID FROM ${SCHEMA}.JournalEntry WHERE ID='${orphanJE}'`)).recordset[0].BatchID;
    assert(bid === null, 'freed JE must have its BatchID cleared (no orphan batch reference)');
  });

  let approveBatchId = '';
  let cfoA = '';
  await test('S1 real gate — CFO set → buildBatch creates an "Approve JE Batch" Task + Task Link, assigned to the CFO', async () => {
    cfoA = await makeCFOPerson(ctx, 'ApproveA');
    await setCompanyCFO(ctx, companyA.id, cfoA);
    await makeJE(ctx, [{ gl: companyA.arGL, debit: 50 }, { gl: companyA.revGL, credit: 50 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user, realGate);
    assert(built !== null, 'buildBatch returned null (expected a batch)');
    approveBatchId = built!.batchId;
    const task = await batchTask(ctx, approveBatchId);
    assert(task !== null, 'expected an approval Task linked to the batch');
    assert(/^Approve Journal Entry Batch #/.test(task!.name), `expected an "Approve Journal Entry Batch #…" Task, got '${task!.name}'`);
    assert((await assignmentCountForCFO(ctx, task!.id, cfoA)) === 1, 'expected the Task assigned to the CFO Person');
  });

  await test('S1 real gate — MULTI-COMPANY batch → ONE approval Task assigned to BOTH companies\' CFOs (union)', async () => {
    const cfoB = await makeCFOPerson(ctx, 'ApproveB');
    await setCompanyCFO(ctx, companyB.id, cfoB);
    await makeJE(ctx, [{ gl: companyA.arGL, debit: 20 }, { gl: companyA.revGL, credit: 20 }]);
    await makeJE(ctx, [{ gl: companyB.arGL, debit: 30 }, { gl: companyB.revGL, credit: 30 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user, realGate);
    assert(built !== null && built.companyCount === 2, `expected a 2-company batch, got ${built?.companyCount}`);
    const task = await batchTask(ctx, built!.batchId);
    assert(task !== null, 'expected an approval Task linked to the multi-company batch');
    assert((await assignmentCountForCFO(ctx, task!.id, cfoA)) === 1, 'expected the Task assigned to company A\'s CFO');
    assert((await assignmentCountForCFO(ctx, task!.id, cfoB)) === 1, 'expected the Task assigned to company B\'s CFO');
  });

  await test('S1 real gate — sendBatch with NO decision is BLOCKED (gate: not approved); batch stays Approved', async () => {
    await approveBatch(approveBatchId, user.ID, user); // engine-status step done; the CFO gate still blocks
    await expectThrow(() => sendBatch(approveBatchId, user, { gate: realGate }), 'not approved');
    assert((await batchState(ctx, approveBatchId)).status === 'Approved', 'batch must remain Approved before a CFO decision');
  });

  await test('S1 real gate — recordDecision(Approved) → sendBatch succeeds → Posted (JEs GLPosted)', async () => {
    await realGate.recordDecision(approveBatchId, 'Approved', cfoA, 'Looks good — approved.', user);
    const batch = await sendBatch(approveBatchId, user, { gate: realGate });
    assert(batch.Status === 'Posted', `expected Posted after approval, got ${batch.Status}`);
    assert((batch.ExternalBatchRef ?? '').startsWith('MOCK-'), `expected a MOCK- ExternalBatchRef, got ${batch.ExternalBatchRef}`);
  });

  await test('S1 real gate — recordDecision(Rejected) → dispatch refused at BOTH layers; batch stays Pending', async () => {
    await makeJE(ctx, [{ gl: companyA.arGL, debit: 30 }, { gl: companyA.revGL, credit: 30 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user, realGate);
    assert(built !== null, 'buildBatch returned null for the reject scenario');
    await realGate.recordDecision(built!.batchId, 'Rejected', cfoA, 'Numbers off — rejected.', user);
    // Layer 1 (engine status): never approved → sendBatch refuses on status.
    await expectThrow(() => sendBatch(built!.batchId, user, { gate: realGate }), 'only an Approved batch can be sent');
    // Layer 2 (CFO gate): the recorded Rejected decision blocks assertApproved directly.
    await expectThrow(() => realGate.assertApproved(built!.batchId, user), 'not approved');
    assert((await batchState(ctx, built!.batchId)).status === 'Pending', 'rejected batch must remain Pending');
  });

  // ─── INV summary-foots (trg 50014 overall / 50023 per company) — RAW-SQL bypass ──
  await test('INV summary-foots — DB-bypass: tamper control total then raw UPDATE Status=Sent → rejected (50014)', async () => {
    await makeJE(ctx, [{ gl: companyA.arGL, debit: 75 }, { gl: companyA.revGL, credit: 75 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user);
    // Break the foot at the DB level (TotalDebits no longer equals the summary sum), while still Pending.
    await pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET TotalDebits = TotalDebits + 100 WHERE ID='${built!.batchId}'`);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET Status='Sent', SentAt=GETUTCDATE() WHERE ID='${built!.batchId}'`), 'foot');
  });

  await test('INV per-company foot — DB-bypass: shift a summary amount ACROSS companies then raw Sent → rejected (50023, AM-4)', async () => {
    await makeJE(ctx, [{ gl: companyA.arGL, debit: 100 }, { gl: companyA.revGL, credit: 100 }]);
    await makeJE(ctx, [{ gl: companyB.arGL, debit: 40 }, { gl: companyB.revGL, credit: 40 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user);
    // Tamper: shift 30 of debit from company B's AR line onto company A's AR line (amounts stay
    // strictly positive — CK_JEBLI_OneSide forbids 0). Overall totals still foot (140/140 —
    // passes 50014), but each company is now internally unbalanced → 50023.
    await pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatchLineItem SET DebitAmount = 130 WHERE BatchID='${built!.batchId}' AND CompanyID='${companyA.id}' AND DebitAmount IS NOT NULL`);
    await pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatchLineItem SET DebitAmount = 10 WHERE BatchID='${built!.batchId}' AND CompanyID='${companyB.id}' AND DebitAmount IS NOT NULL`);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET Status='Sent', SentAt=GETUTCDATE() WHERE ID='${built!.batchId}'`), 'WITHIN EACH company');
  });

  // ─── INV batch immutability (trg 50009 update / 50008 delete) — RAW-SQL bypass ──
  await test('INV batch immutability — DB-bypass UPDATE of a locked field on a Posted batch → rejected (50009)', async () => {
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntryBatch SET TotalDebits = TotalDebits + 1 WHERE ID='${happyBatchId}'`), 'locked');
  });
  await test('INV batch immutability — DB-bypass DELETE of a Posted batch → rejected (FK_JE_Batch / trg 50008 defense-in-depth)', async () => {
    // A real Posted batch always has GLPosted JEs pointing at it (FK_JE_Batch), so the FK rejects
    // the raw DELETE first; trg_JEBatch_Immutability (50008) is the backstop for the no-references case.
    // Either way the guarantee holds: a posted batch cannot be deleted. Accept whichever guard fires.
    let threw = false, msg = '';
    try { await pool.request().query(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${happyBatchId}'`); }
    catch (e) { threw = true; msg = e instanceof Error ? e.message : String(e); }
    assert(threw, 'expected the Posted-batch DELETE to be rejected');
    assert(/cannot be deleted|REFERENCE constraint|FK_JE_Batch/i.test(msg), `expected rejection by FK or trg 50008, got: ${msg.split('\n')[0]}`);
  });

  // ─── task #12: LEVELS OF LOCKING — reject-unlock, permanent-after-approve, regenerate ──────────
  // The reject FLOW in the resolver = recordDecision(Rejected) [audit] + cancelBatch [financial reversal].
  // These prove the engine's cancelBatch/regenerateBatch and the reworked immutability trigger. Discipline:
  // each test ENDS with its JEs Batched (locked, not Pending) so buildBatch's global sweep stays deterministic.

  await test('#12 cancelBatch — reject reverses the PRELIMINARY lock: batch→Cancelled, JEs→Pending (candidate pool), summary cleared', async () => {
    const je1 = await makeJE(ctx, [{ gl: companyA.arGL, debit: 45 }, { gl: companyA.revGL, credit: 45 }]);
    const je2 = await makeJE(ctx, [{ gl: companyA.arGL, debit: 55 }, { gl: companyA.revGL, credit: 55 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user);
    assert(built !== null, 'buildBatch returned null for the cancel scenario');
    assert((await jeStatus(ctx, je1)) === 'Batched' && (await jeStatus(ctx, je2)) === 'Batched', 'JEs must be Batched (preliminary lock) before cancel');
    const cancelled = await cancelBatch(built!.batchId, user);
    assert(cancelled.Status === 'Cancelled', `expected Cancelled, got ${cancelled.Status}`);
    const st = await batchState(ctx, built!.batchId);
    assert(st.status === 'Cancelled' && st.lineCount === 0, `batch must be Cancelled with its summary cleared, got status=${st.status} lines=${st.lineCount}`);
    assert((await jeStatus(ctx, je1)) === 'Pending' && (await jeStatus(ctx, je2)) === 'Pending', 'JEs must return to Pending after cancel');
    const bidNull = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry WHERE ID IN ('${je1}','${je2}') AND BatchID IS NULL`)).recordset[0].c;
    assert(Number(bidNull) === 2, `both JEs must have BatchID cleared, got ${bidNull}`);
    // Prove they're candidates again — a fresh build re-batches them (and leaves them Batched → clean slate).
    const rebuilt = await buildBatch('BusinessCentral', user.ID, user);
    assert(rebuilt !== null && rebuilt.jeCount === 2, `freed JEs must be re-batchable, got jeCount=${rebuilt?.jeCount}`);
  });

  await test('#12 permanent lock — once APPROVED the lock is permanent: cancelBatch refused + a raw Batched→Pending unlock is rejected by the trigger', async () => {
    const je = await makeJE(ctx, [{ gl: companyA.arGL, debit: 33 }, { gl: companyA.revGL, credit: 33 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user);
    assert(built !== null, 'buildBatch returned null for the permanent-lock scenario');
    await approveBatch(built!.batchId, user.ID, user);
    await expectThrow(() => cancelBatch(built!.batchId, user), 'only a Pending'); // engine guard
    // DB guard: the trigger refuses the unlock because the owning batch is Approved (not Pending) → permanent.
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET Status='Pending', BatchID=NULL WHERE ID='${je}'`), 'locked');
    assert((await jeStatus(ctx, je)) === 'Batched', 'an approved batch\'s JE must stay Batched (permanent lock)');
  });

  await test('#12 regenerateBatch — unlock current + re-gather ALL candidates (incl. one added after) into the SAME batch', async () => {
    const jeA = await makeJE(ctx, [{ gl: companyA.arGL, debit: 20 }, { gl: companyA.revGL, credit: 20 }]);
    const built = await buildBatch('BusinessCentral', user.ID, user);
    assert(built !== null && built.jeCount === 1, `expected a 1-JE batch, got jeCount=${built?.jeCount}`);
    const batchId = built!.batchId;
    const jeB = await makeJE(ctx, [{ gl: companyA.arGL, debit: 25 }, { gl: companyA.revGL, credit: 25 }]); // lands AFTER the build
    assert((await jeStatus(ctx, jeB)) === 'Pending', 'the new JE must be an unbatched candidate');
    const regen = await regenerateBatch(batchId, 'BusinessCentral', user);
    assert(regen.batchId === batchId, 'regenerate must reuse the SAME batch record');
    assert(regen.jeCount === 2, `regenerate must pick up BOTH JEs, got jeCount=${regen.jeCount}`);
    assert((await jeStatus(ctx, jeA)) === 'Batched' && (await jeStatus(ctx, jeB)) === 'Batched', 'both JEs must be re-locked into the batch');
    const st = await batchState(ctx, batchId);
    assert(st.status === 'Pending' && st.td === st.tc && st.td === st.sumDr && st.td === 45, `regenerated batch must be Pending + footing at 45, got status=${st.status} td=${st.td} sumDr=${st.sumDr}`);
  });

  // ─── Teardown ──────────────────────────────────────────────────────────────
  // db_owner pool (MJ_CodeGen): the app user can't DISABLE TRIGGER (no ALTER) nor delete locked
  // JEs/Posted batches. Batches are global — sweep every batch the tracked JEs reference.
  const exec = async (q: string) => { try { await ctx.teardownPool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  const jeIdList = createdJEIds.map(id => `'${id}'`).join(',');

  // 0. Batch IDs this run produced = every batch a tracked JE points at.
  let batchIdList = '';
  try {
    const r = await ctx.teardownPool.request().query(`SELECT DISTINCT BatchID id FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList}) AND BatchID IS NOT NULL`);
    batchIdList = (r.recordset ?? []).map((x: { id: string }) => `'${x.id}'`).join(',');
  } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }

  // 1. Tasks-app rows the real-gate scenarios created — linked to this run's batches via TaskLink.
  if (batchIdList) {
    let taskIdList = '';
    try {
      const r = await ctx.teardownPool.request().query(
        `SELECT DISTINCT l.TaskID id FROM ${TASK_SCHEMA}.TaskLink l JOIN __mj.Entity e ON e.ID=l.EntityID WHERE e.Name='${BATCH_ENTITY}' AND l.RecordID IN (${batchIdList})`);
      taskIdList = (r.recordset ?? []).map((x: { id: string }) => `'${x.id}'`).join(',');
    } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
    if (taskIdList) {
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskDecision WHERE TaskID IN (${taskIdList})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskActivity WHERE TaskID IN (${taskIdList})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskAssignment WHERE TaskID IN (${taskIdList})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskLink WHERE TaskID IN (${taskIdList})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.Task WHERE ID IN (${taskIdList})`);
    }
  }

  // 2. Accounting rows (locked JEs / Posted batches) — disable triggers via db_owner.
  // Re-enable in a finally so the invariant triggers are NEVER left disabled, even if a DELETE throws.
  const toggled = ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineDimension', 'JournalEntryBatchLineItem', 'JournalEntryBatch'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    if (jeIdList) {
      await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID WHERE l.JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList})`);
    }
    if (batchIdList) {
      await exec(`DELETE bd FROM ${SCHEMA}.JournalEntryBatchLineDimension bd JOIN ${SCHEMA}.JournalEntryBatchLineItem li ON li.ID=bd.JournalEntryBatchLineItemID WHERE li.BatchID IN (${batchIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID IN (${batchIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID IN (${batchIdList})`);
    }
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }
  for (const co of [companyA, companyB]) {
    await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID='${co.id}'`);
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${co.id}'`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${co.id}'`);
    await exec(`DELETE FROM __mj.Company WHERE ID='${co.id}'`);
  }
  await exec(`DELETE FROM ${SCHEMA}.DimensionValue WHERE DimensionID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.Dimension WHERE ID='${ctx.dimId}'`);

  // 3. CFO Person rows.
  for (const pid of ctx.personIds) await exec(`DELETE FROM __mj_BizAppsCommon.Person WHERE ID='${pid}'`);

  const failed = outcomes.filter(o => !o.Passed);
  // NEVER `await pool.close()` before exit — the MJ provider pool can hang on close. Non-blocking close + force-exit.
  finishAndExit(`\n────── Block 2 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`, failed.length > 0 ? 1 : 0, pool, ctx.teardownPool);
}

void main();
