/**
 * block1-runtime.ts — live validation of the Block-1 JE-lifecycle hooks + DB invariants.
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *
 * 2026-07-06 rework (engine-meeting rulings): AccountingPeriod is GONE, so the W4
 * adjusting-entry routing + period-close (50007) tests are RETIRED. JEs are now
 * MULTI-COMPANY (no header CompanyID — company derives from GLAccount.CompanyID per line),
 * which adds the AM-4 per-company balance invariant (50019):
 *
 *   W6  generateReversal: new Pending JE (EntryType='Reversal'), Dr/Cr swapped, back-referenced.
 *   F1  validateJournalEntry: balanced/active → valid; unbalanced → invalid.
 *   INV (DB triggers, each with a RAW-SQL bypass case + an allowed counter-case):
 *       balanced-on-lock overall (50001) · balanced-on-lock PER COMPANY (50019, AM-4) ·
 *       JE immutability (50003/50004) · JE-line immutability (50006).
 *
 * USAGE (cwd = instance worktree root, where .env resolves):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block1-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. Idempotent (FK-aware teardown by tracked IDs).
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
import { validateJournalEntry } from '@mj-biz-apps/accounting-core-entities-server';
import '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
// The reversal hook (W6) lives on the registered server subclass; cast to reach generateReversal().
import type { JournalEntryEntityServer } from '@mj-biz-apps/accounting-core-entities-server';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const SCHEMA = '__mj_BizAppsAccounting';

const RUN_TAG = `BLOCK1-${Date.now()}`;
let companyCodeCounter = 0;
function companyCode(): string { return `B1${(companyCodeCounter++)}${Date.now().toString(36).slice(-6)}`.toUpperCase(); }

type JEStatus = mjBizAppsAccountingJournalEntryEntity['Status']; // rule 2c — derive, never hand-copy

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
  assert(msg.includes(mustContain), `expected error to contain "${mustContain}", got: ${msg.split('\n')[0]}`);
}

interface Company { id: string; arGL: string; revGL: string }
interface Ctx {
  pool: sql.ConnectionPool;
  /** db_owner pool (MJ_CodeGen) used ONLY for FK-aware teardown — the app user MJ_Connect lacks ALTER
   *  (can't DISABLE TRIGGER) and can't delete locked JEs/batches, which is the security model. */
  teardownPool: sql.ConnectionPool;
  user: UserInfo; companyA: Company; companyB: Company; batchId: string;
}

/** Tracked created rows for the FK-aware teardown. */
const createdJEIds: string[] = [];

async function createCompany(user: UserInfo, currencyCode: string, label: string): Promise<Company> {
  const md = new Metadata();
  const rv = new RunView();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} ${label}`;
  acp.Description = `${RUN_TAG} block1 test (${label})`;
  acp.CompanyCode = companyCode();
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  const id = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed (${label}): ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
  const glRes = await rv.RunView<{ ID: string; Code: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${id}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  const arGL = byCode.get('11201'); const revGL = byCode.get('40100');
  if (!arGL || !revGL) throw new Error(`seeded GL accounts not found for ${label}`);
  return { id, arGL, revGL };
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
  await assertInvariantTriggers(pool); // pre-flight: fail fast if any invariant trigger is missing/disabled
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success} err=${cur.ErrorMessage})`);

  // Two test companies — the AM-4 per-company invariant (50019) needs lines spanning companies.
  const companyA = await createCompany(ctxUser, currencyCode, 'Co A');
  const companyB = await createCompany(ctxUser, currencyCode, 'Co B');

  // A Pending batch for the lock tests — a JE can only be Batched if BatchID is set
  // (CK_JournalEntry_BatchedHasBatch). The batch stays Pending so it can be referenced + cleaned.
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, ctxUser);
  batch.NewRecord();
  batch.TargetSystem = 'BusinessCentral';
  batch.BatchedAt = new Date();
  batch.BatchedByUserID = ctxUser.ID;
  batch.Status = 'Pending';
  batch.TotalEntries = 0; batch.TotalDebits = 0; batch.TotalCredits = 0;
  if (!(await batch.Save())) throw new Error(`batch save failed: ${batch.LatestResult?.CompleteMessage}`);

  return { pool, teardownPool, user: ctxUser, companyA, companyB, batchId: batch.ID };
}

/** App-path helper: create a Pending JE with a balanced (or unbalanced) Dr-AR / Cr-Revenue pair in one company. */
async function makeJE(ctx: Ctx, co: Company, debit: number, credit: number): Promise<mjBizAppsAccountingJournalEntryEntity> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = co.id; // MOD-12: single-company JEs
  je.EffectiveDate = new Date();
  je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} test`;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  createdJEIds.push(je.ID);
  await addLine(ctx, je.ID, 1, co.arGL, debit, null);
  await addLine(ctx, je.ID, 2, co.revGL, null, credit);
  return je;
}
async function addLine(ctx: Ctx, jeId: string, lineNo: number, glId: string, debit: number | null, credit: number | null): Promise<void> {
  const md = new Metadata();
  const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
  l.NewRecord(); l.JournalEntryID = jeId; l.LineNumber = lineNo; l.GLAccountID = glId;
  l.DebitAmount = debit; l.CreditAmount = credit;
  if (!(await l.Save())) throw new Error(`line save failed: ${l.LatestResult?.CompleteMessage}`);
}
async function setStatus(ctx: Ctx, jeId: string, status: JEStatus): Promise<boolean> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  await je.Load(jeId);
  if (status === 'Batched' || status === 'GLPosted') je.BatchID = ctx.batchId; // CK_JournalEntry_BatchedHasBatch
  je.Status = status;
  try {
    const ok = await je.Save();
    if (!ok) console.log(`      [setStatus ${status} → false] ${je.LatestResult?.CompleteMessage ?? 'no message'}`);
    return ok;
  } catch (e) {
    console.log(`      [setStatus ${status} threw] ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    return false;
  }
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? e.message : String(e)); process.exit(2); }
  const { pool, user, companyA, companyB } = ctx;
  console.log(`\n══════ Block 1 runtime validation — user=${user.Email} companies=${companyA.id},${companyB.id} tag=${RUN_TAG} ══════\n`);
  const md = new Metadata();

  // ─── INV: balanced-on-lock, overall (trg 50001) ───────────────────────────
  await test('INV balanced-on-lock — DB-bypass raw UPDATE to Batched on an unbalanced JE → rejected (50001)', async () => {
    const jeId = randomUUID();
    createdJEIds.push(jeId);
    await pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntry (ID, EntryNumber, CompanyID, EffectiveDate, EntryType, Status) VALUES ('${jeId}','RAW-${RUN_TAG}-1', '${companyA.id}', GETUTCDATE(), 'Manual','Pending')`);
    await pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntryLine (ID, JournalEntryID, LineNumber, GLAccountID, DebitAmount) VALUES (NEWID(), '${jeId}', 1, '${companyA.arGL}', 100.00)`);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET Status='Batched', BatchID='${ctx.batchId}' WHERE ID='${jeId}'`), 'Sum(Debits)');
  });

  await test('INV balanced-on-lock — allowed: a balanced JE locks to Batched', async () => {
    const je = await makeJE(ctx, companyA, 100, 100);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'balanced JE should lock to Batched');
  });

  // ─── INV: per-company balance (50019) + MOD-12 single-company coherence (50025) ───
  await test('INV per-company balance — overall-balanced but cross-company-unbalanced JE locks → rejected (50019, AM-4)', async () => {
    // Dr 100 in company A, Cr 100 in company B: Sum(Dr)=Sum(Cr) overall (passes 50001),
    // but each company is one-sided — the per-company rule fires (MOD-12's 50025 would too).
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord(); je.CompanyID = companyA.id; je.EffectiveDate = new Date();
    je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} cross-company unbalanced`;
    assert(await je.Save(), `JE save failed: ${je.LatestResult?.CompleteMessage}`);
    createdJEIds.push(je.ID);
    await addLine(ctx, je.ID, 1, companyA.arGL, 100, null);
    await addLine(ctx, je.ID, 2, companyB.revGL, null, 100);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET Status='Batched', BatchID='${ctx.batchId}' WHERE ID='${je.ID}'`), 'WITHIN EACH company');
  });

  await test('INV single-company coherence (MOD-12) — a multi-company JE, even balanced per company, is REJECTED at lock (50025)', async () => {
    // Under CH-2 this locked fine; MOD-12 reverses that: every line's account company must equal
    // the header CompanyID. Two balanced pairs across two companies → blocked.
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord(); je.CompanyID = companyA.id; je.EffectiveDate = new Date();
    je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} multi-company balanced (must reject)`;
    assert(await je.Save(), `JE save failed: ${je.LatestResult?.CompleteMessage}`);
    createdJEIds.push(je.ID);
    await addLine(ctx, je.ID, 1, companyA.arGL, 100, null);
    await addLine(ctx, je.ID, 2, companyA.revGL, null, 100);
    await addLine(ctx, je.ID, 3, companyB.arGL, 40, null);
    await addLine(ctx, je.ID, 4, companyB.revGL, null, 40);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET Status='Batched', BatchID='${ctx.batchId}' WHERE ID='${je.ID}'`), 'single-company');
  });

  await test('INV CompanyID frozen once locked (MOD-12) — DB-bypass UPDATE of CompanyID on a Batched JE → rejected (50004 or 50025)', async () => {
    const je = await makeJE(ctx, companyA, 60, 60);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    // Two triggers both guard this (immutability 50004; company-coherence 50025 re-fires on any
    // UPDATE of a Batched row) — SQL Server trigger order is undefined, so accept either rejection.
    try {
      await pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET CompanyID='${companyB.id}' WHERE ID='${je.ID}'`);
      throw new Error('expected the CompanyID change to be rejected, but it succeeded');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      assert(/locked|single-company/i.test(msg), `expected a 50004/50025 rejection, got: ${msg.split('\n')[0]}`);
    }
    const still = (await pool.request().query(`SELECT CompanyID FROM ${SCHEMA}.JournalEntry WHERE ID='${je.ID}'`)).recordset[0];
    assert((still.CompanyID as string).toLowerCase() === companyA.id.toLowerCase(), 'CompanyID must be unchanged after the rejected update');
  });

  // ─── INV: JE immutability (trg 50003 delete / 50004 update) ───────────────
  await test('INV JE immutability — DB-bypass UPDATE of a frozen field on a Batched JE → rejected (50004)', async () => {
    const je = await makeJE(ctx, companyA, 50, 50);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET EffectiveDate = DATEADD(day,1,EffectiveDate) WHERE ID='${je.ID}'`), 'locked');
  });

  await test('INV JE immutability — DB-bypass DELETE of a Batched JE → rejected (50003)', async () => {
    // Use a LINE-LESS JE so the FK (JEL→JE) doesn't pre-empt the trigger; 0 lines balances (0=0).
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord(); je.CompanyID = companyA.id; je.EffectiveDate = new Date();
    je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} delete-test`;
    assert(await je.Save(), `je save failed: ${je.LatestResult?.CompleteMessage}`);
    createdJEIds.push(je.ID);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await expectThrow(() => pool.request().query(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID='${je.ID}'`), 'cannot be deleted');
  });

  await test('INV JE immutability — allowed: GL-roundtrip fields update on a Batched JE', async () => {
    const je = await makeJE(ctx, companyA, 70, 70);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET GLReferenceID='BC-REF-1', GLPostedAt=GETUTCDATE() WHERE ID='${je.ID}'`);
  });

  // ─── INV: JE-line immutability (trg 50006) ────────────────────────────────
  await test('INV JE-line immutability — DB-bypass UPDATE of a line on a Batched JE → rejected (50006)', async () => {
    const je = await makeJE(ctx, companyA, 80, 80);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntryLine SET DebitAmount=999 WHERE JournalEntryID='${je.ID}' AND DebitAmount IS NOT NULL`), 'locked');
  });

  // ─── W6 — reversal ────────────────────────────────────────────────────────
  await test('W6 generateReversal — new Reversal JE with Dr/Cr swapped + back-references', async () => {
    const orig = await makeJE(ctx, companyA, 100, 100) as JournalEntryEntityServer;
    const reversal = await orig.generateReversal('block1 test reversal', user);
    createdJEIds.push(reversal.ID);
    assert(reversal.EntryType === 'Reversal', `reversal EntryType=${reversal.EntryType}`);
    assert(reversal.ReversesJournalEntryID === orig.ID, 'reversal must reference the original');
    assert(reversal.Status === 'Pending', `reversal Status=${reversal.Status}`);
    // original back-reference
    const reread = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    await reread.Load(orig.ID);
    assert(reread.ReversedByJournalEntryID === reversal.ID, 'original must back-reference the reversal');
    // lines swapped: original line 1 was Dr AR 100 → reversal line 1 should be Cr AR 100
    const rv = new RunView();
    const lr = await rv.RunView<{ LineNumber: number; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${reversal.ID}'`, OrderBy: 'LineNumber ASC', Fields: ['LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple' }, user);
    const arLine = (lr.Results ?? []).find(l => l.GLAccountID === companyA.arGL);
    assert(!!arLine && arLine.CreditAmount === 100 && (arLine.DebitAmount ?? null) === null, `AR line should be swapped to a 100 credit, got Dr=${arLine?.DebitAmount} Cr=${arLine?.CreditAmount}`);
  });

  await test('W6 guard — a Reversal entry cannot be reversed, and an entry cannot be reversed twice', async () => {
    const orig = await makeJE(ctx, companyA, 100, 100) as JournalEntryEntityServer;
    const reversal = await orig.generateReversal('block1 guard: first reversal', user) as JournalEntryEntityServer;
    createdJEIds.push(reversal.ID);

    // (a) reversing the reversal entry itself must throw (no reverse-the-reversal chains).
    let threwOnReversal = false;
    try { await reversal.generateReversal('block1 guard: reverse-the-reversal', user); }
    catch { threwOnReversal = true; }
    assert(threwOnReversal, 'generateReversal on a Reversal entry must throw');

    // (b) reversing the already-reversed original again must throw (no double reversal).
    const reread = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    await reread.Load(orig.ID);
    let threwOnAlready = false;
    try { await (reread as JournalEntryEntityServer).generateReversal('block1 guard: double reverse', user); }
    catch { threwOnAlready = true; }
    assert(threwOnAlready, 'generateReversal on an already-reversed entry must throw');

    // and neither rejected attempt created a stray reversal — exactly one reversal exists for the original.
    const rvGuard = new RunView();
    const cnt = await rvGuard.RunView<{ ID: string }>(
      { EntityName: JE_ENTITY, ExtraFilter: `ReversesJournalEntryID='${orig.ID}'`, Fields: ['ID'], ResultType: 'simple' }, user);
    assert((cnt.Results ?? []).length === 1, `exactly one reversal should exist for the original, got ${(cnt.Results ?? []).length}`);
  });

  // ─── F1 — validateJournalEntry ────────────────────────────────────────────
  await test('F1 validateJournalEntry — balanced/active JE is valid', async () => {
    const je = await makeJE(ctx, companyA, 100, 100);
    const r = await validateJournalEntry(je.ID, user);
    assert(r.valid, `expected valid, got errors: ${r.errors.join('; ')}`);
  });

  await test('F1 validateJournalEntry — unbalanced JE is invalid (balance error)', async () => {
    const je = await makeJE(ctx, companyA, 100, 100);
    await addLine(ctx, je.ID, 3, companyA.revGL, null, 25); // tip it out of balance (extra credit)
    const r = await validateJournalEntry(je.ID, user);
    assert(!r.valid && r.errors.some(e => e.includes('unbalanced')), `expected unbalanced invalid, got: valid=${r.valid} errors=${r.errors.join('; ')}`);
  });

  // ─── Teardown (disable accounting triggers to clean locked rows) ──────────
  const exec = async (q: string) => { try { await ctx.teardownPool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  // JEs are global (no CompanyID) → sweep by the tracked ID list. The invariant triggers must
  // NEVER be left disabled, so re-enable every toggled table in a finally.
  const jeIdList = createdJEIds.map(id => `'${id}'`).join(',');
  const toggledTables = ['JournalEntryLine', 'JournalEntry'];
  if (jeIdList.length > 0) {
    try {
      for (const t of toggledTables) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList})`);
    } finally {
      for (const t of toggledTables) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    }
  }
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${ctx.batchId}'`);
  for (const co of [companyA, companyB]) {
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${co.id}'`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${co.id}'`);
    await exec(`DELETE FROM __mj_BizAppsAccounting.JournalEntrySequence WHERE CompanyID='${co.id}'`); // per-company JE sequence rows (MOD-12)
    await exec(`DELETE FROM __mj.Company WHERE ID='${co.id}'`);
  }
  const leftover = (await pool.request().query(`SELECT COUNT(*) n FROM __mj.Company WHERE ID IN ('${companyA.id}','${companyB.id}')`)).recordset[0].n;
  if (leftover > 0) {
    console.log(`  (teardown note: ${leftover} test company row(s) persist — investigate, the db_owner teardown pool should have cleaned them.)`);
  }

  const failed = outcomes.filter(o => !o.Passed);
  // NEVER `await pool.close()` before exit — the MJ provider pool can hang on close. Non-blocking close + force-exit.
  finishAndExit(`\n────── Block 1 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`, failed.length > 0 ? 1 : 0, pool, ctx.teardownPool);
}

void main();
