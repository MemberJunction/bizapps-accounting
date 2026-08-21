/**
 * block1-runtime.ts — live validation of the JE-lifecycle DB invariants (the un-bypassable floor).
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 * The unique value of this harness is the RAW-SQL BYPASS proofs: each trigger is attacked
 * underneath the entity layer, so a lying/removed trigger can never produce a false green.
 *
 * MODERNIZED 2026-07-29 for the realigned baseline (single-company JEs D3, JournalEntryType
 * lookup #24, encapsulated phase-2 saves; the old multi-company/AM-4 rows are retired — plan D3
 * made cross-company drafts a typed engine rejection AND a DB floor, both proven here):
 *
 *   INV (DB triggers, each with a raw-SQL bypass case + an allowed counter-case):
 *       balanced-on-lock (50001) · single-company line floor (50019) · header-company change
 *       floor (50022) · JE immutability update/delete (50004/50003, GL-roundtrip fields allowed) ·
 *       line immutability on a locked JE (50006) · reversal typing (50012).
 *   ENTITY: unbalanced encapsulated Save refused (double-entry validation), balanced saves.
 *
 * Run from the INSTANCE WORKTREE ROOT: npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block1-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { JournalEntryEntityServer, RequireJournalEntryTypeID } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';
import { finishAndExit } from './harness-exit.js';
import { assertInvariantTriggers } from './trigger-preflight.js';

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

interface Company { id: string; code: string; arGL: string; revGL: string }
interface Ctx {
  pool: sql.ConnectionPool;
  /** db_owner pool (MJ_CodeGen) used ONLY for FK-aware teardown — the app user MJ_Connect lacks ALTER
   *  (can't DISABLE TRIGGER) and can't delete locked JEs/batches, which is the security model. */
  teardownPool: sql.ConnectionPool;
  user: UserInfo; companyA: Company; companyB: Company; batchId: string; manualTypeId: string;
}

/** Tracked created rows for the FK-aware teardown (companies are also swept whole). */
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
  const code = acp.CompanyCode;
  if (!(await acp.Save())) throw new Error(`ACP save failed (${label}): ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
  // W1 auto-seed RETIRED (Marcelo ruling 2026-07-30): a new company starts with an EMPTY chart and
  // seeding is an explicit capability — same contract block0 W1.2 pins.
  await (acp as unknown as { SeedDefaultChartOfAccounts(): Promise<void> }).SeedDefaultChartOfAccounts();
  const glRes = await rv.RunView<{ ID: string; Code: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${id}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  const arGL = byCode.get('11201'); const revGL = byCode.get('40100');
  if (!arGL || !revGL) throw new Error(`seeded GL accounts not found for ${label}`);
  return { id, code, arGL, revGL };
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

  // Two test companies — the single-company floor (50019/50022) needs accounts from a SECOND company.
  const companyA = await createCompany(ctxUser, currencyCode, 'Co A');
  const companyB = await createCompany(ctxUser, currencyCode, 'Co B');

  const manualTypeId = await RequireJournalEntryTypeID('Manual', ctxUser, Metadata.Provider);

  // A Pending batch (company A) for the lock tests — a JE can only be Batched if JournalEntryBatchID is set
  // (CK_JournalEntry_BatchedHasJournalEntryBatch). The batch stays Pending so it can be referenced + cleaned.
  const md = new Metadata();
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, ctxUser);
  batch.NewRecord();
  batch.CompanyID = companyA.id;
  batch.PostingDate = new Date(new Date().toISOString().slice(0, 10));
  batch.TargetSystem = 'BusinessCentral';
  batch.BatchedAt = new Date();
  batch.BatchedByUserID = ctxUser.ID;
  batch.Status = 'Pending';
  batch.TotalEntries = 0; batch.TotalDebits = 0; batch.TotalCredits = 0;
  if (!(await batch.Save())) throw new Error(`batch save failed: ${batch.LatestResult?.CompleteMessage}`);

  return { pool, teardownPool, user: ctxUser, companyA, companyB, batchId: batch.ID, manualTypeId };
}

/** App-path helper: ONE encapsulated Save — header + Dr-AR / Cr-Revenue pair in one company (phase 2). */
async function makeJE(ctx: Ctx, co: Company, debit: number, credit: number): Promise<JournalEntryEntityServer> {
  const md = new Metadata();
  const je = await md.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = co.id;
  je.EffectiveDate = new Date();
  je.EntryTypeID = ctx.manualTypeId;
  je.Status = 'Pending'; je.Description = `${RUN_TAG} test`;
  const l1 = await je.CreateLine(ctx.user); l1.GLAccountID = co.arGL; l1.DebitAmount = debit;
  const l2 = await je.CreateLine(ctx.user); l2.GLAccountID = co.revGL; l2.CreditAmount = credit;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  createdJEIds.push(je.ID);
  return je;
}
/** Add a line to an EXISTING unlocked JE (post-save additions are legal until lock). */
async function addLine(ctx: Ctx, jeId: string, lineNo: number, glId: string, debit: number | null, credit: number | null): Promise<boolean> {
  const md = new Metadata();
  const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
  l.NewRecord(); l.JournalEntryID = jeId; l.LineNumber = lineNo; l.GLAccountID = glId;
  l.DebitAmount = debit; l.CreditAmount = credit;
  return l.Save();
}
async function setStatus(ctx: Ctx, jeId: string, status: JEStatus): Promise<boolean> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  await je.Load(jeId);
  if (status === 'Batched' || status === 'GLPosted') je.JournalEntryBatchID = ctx.batchId; // CK_JournalEntry_BatchedHasJournalEntryBatch
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

  // ─── INV: balanced-on-lock (trg 50001) ────────────────────────────────────
  await test('INV balanced-on-lock — DB-bypass raw UPDATE to Batched on an unbalanced JE → rejected (50001)', async () => {
    const jeId = randomUUID();
    createdJEIds.push(jeId);
    await pool.request().query(
      `INSERT INTO ${SCHEMA}.JournalEntry (ID, EntryNumber, CompanyID, EffectiveDate, EntryTypeID, Status)
       VALUES ('${jeId}','RAW-${RUN_TAG}-1', '${companyA.id}', GETUTCDATE(), '${ctx.manualTypeId}','Pending')`);
    await pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntryLine (ID, JournalEntryID, LineNumber, GLAccountID, DebitAmount) VALUES (NEWID(), '${jeId}', 1, '${companyA.arGL}', 100.00)`);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET Status='Batched', JournalEntryBatchID='${ctx.batchId}' WHERE ID='${jeId}'`), 'Sum(Debits)');
  });

  await test('INV balanced-on-lock — allowed: a balanced JE locks to Batched', async () => {
    const je = await makeJE(ctx, companyA, 100, 100);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'balanced JE should lock to Batched');
  });

  // ─── INV: single-company floor (trg 50019 line / 50022 header — plan D3) ──
  await test('INV single-company — raw INSERT of another company\'s account line → rejected (50019)', async () => {
    const je = await makeJE(ctx, companyA, 60, 60);
    await expectThrow(
      () => pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntryLine (ID, JournalEntryID, LineNumber, GLAccountID, DebitAmount) VALUES (NEWID(), '${je.ID}', 3, '${companyB.arGL}', 10.00)`),
      'must belong to the parent',
    );
  });

  await test('INV single-company — raw UPDATE of the header CompanyID under existing lines → rejected (50022)', async () => {
    const je = await makeJE(ctx, companyA, 65, 65);
    await expectThrow(
      () => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET CompanyID='${companyB.id}' WHERE ID='${je.ID}'`),
      'cannot change to a company',
    );
  });

  // ─── INV: JE immutability (trg 50003 delete / 50004 update) ───────────────
  await test('INV JE immutability — DB-bypass UPDATE of a frozen field on a Batched JE → rejected (50004)', async () => {
    const je = await makeJE(ctx, companyA, 50, 50);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET EffectiveDate = DATEADD(day,1,EffectiveDate) WHERE ID='${je.ID}'`), 'locked');
  });

  await test('INV JE immutability — DB-bypass DELETE of a Batched JE → rejected (50003)', async () => {
    // Raw-inserted LINE-LESS JE (0 lines balances 0=0; entity saves require ≥2 lines, raw does not),
    // so the FK (JEL→JE) doesn't pre-empt the delete trigger.
    const jeId = randomUUID();
    createdJEIds.push(jeId);
    await pool.request().query(
      `INSERT INTO ${SCHEMA}.JournalEntry (ID, EntryNumber, CompanyID, EffectiveDate, EntryTypeID, Status)
       VALUES ('${jeId}','RAW-${RUN_TAG}-2', '${companyA.id}', GETUTCDATE(), '${ctx.manualTypeId}','Pending')`);
    await pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET Status='Batched', JournalEntryBatchID='${ctx.batchId}' WHERE ID='${jeId}'`);
    await expectThrow(() => pool.request().query(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID='${jeId}'`), 'cannot be deleted');
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

  // ─── INV: reversal typing floor (trg 50012) ───────────────────────────────
  await test('INV reversal typing — raw UPDATE setting ReversesJournalEntryID on a non-Reversal JE → rejected (50012)', async () => {
    const orig = await makeJE(ctx, companyA, 45, 45);
    const impostor = await makeJE(ctx, companyA, 45, 45); // typed Manual, not Reversal
    await expectThrow(
      () => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET ReversesJournalEntryID='${orig.ID}' WHERE ID='${impostor.ID}'`),
      'must be typed with JournalEntryType',
    );
  });

  // ─── W6 — reversal through the entity (typed, swapped, back-referenced) ───
  await test('W6 GenerateReversal — new Reversal-typed JE with Dr/Cr swapped + back-references', async () => {
    const orig = await makeJE(ctx, companyA, 100, 100);
    const reversal = await orig.GenerateReversal('block1 test reversal', user);
    createdJEIds.push(reversal.ID);
    const reversalTypeId = await RequireJournalEntryTypeID('Reversal', user, Metadata.Provider);
    assert(reversal.EntryTypeID?.toLowerCase() === reversalTypeId.toLowerCase(), `reversal EntryTypeID=${reversal.EntryTypeID} (expected the Reversal type)`);
    assert(reversal.ReversesJournalEntryID === orig.ID, 'reversal must reference the original');
    assert(reversal.Status === 'Pending', `reversal Status=${reversal.Status}`);
    // original back-reference
    const reread = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    await reread.Load(orig.ID);
    assert(reread.ReversedByJournalEntryID === reversal.ID, 'original must back-reference the reversal');
    // lines swapped: original Dr AR 100 → reversal Cr AR 100
    const rv = new RunView();
    const lr = await rv.RunView<{ LineNumber: number; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>(
      { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${reversal.ID}'`, OrderBy: 'LineNumber ASC', Fields: ['LineNumber', 'GLAccountID', 'DebitAmount', 'CreditAmount'], ResultType: 'simple' }, user);
    const arLine = (lr.Results ?? []).find(l => l.GLAccountID === companyA.arGL);
    assert(!!arLine && arLine.CreditAmount === 100 && (arLine.DebitAmount ?? null) === null, `AR line should be swapped to a 100 credit, got Dr=${arLine?.DebitAmount} Cr=${arLine?.CreditAmount}`);
  });

  // ─── ENTITY validation (double-entry, encapsulated Save) ──────────────────
  await test('ENTITY validation — a balanced encapsulated JE saves; tipping it out of balance then locking is refused', async () => {
    const je = await makeJE(ctx, companyA, 100, 100); // saved balanced — the positive case
    const tipped = await addLine(ctx, je.ID, 3, companyA.revGL, null, 25); // extra credit, legal while Pending
    assert(tipped, 'adding a line to a Pending JE should be allowed');
    assert(!(await setStatus(ctx, je.ID, 'Batched')), 'an unbalanced JE must not lock to Batched (50001 floor)');
  });

  // ─── Teardown (disable accounting triggers to clean locked rows) ──────────
  const exec = async (q: string) => { try { await ctx.teardownPool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  const toggledTables = ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatch'];
  try {
    for (const t of toggledTables) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    for (const co of [companyA, companyB]) {
      await exec(`DELETE l FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID='${co.id}'`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${co.id}'`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${co.id}'`);
    }
  } finally {
    for (const t of toggledTables) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }
  for (const co of [companyA, companyB]) {
    await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${co.id}'`); // per-company numbering rows (BA-D31)
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${co.id}'`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${co.id}'`);
    await exec(`DELETE FROM __mj.Company WHERE ID='${co.id}'`);
  }

  const passed = outcomes.filter(o => o.Passed).length;
  const summary = `Block 1 runtime: ${passed}/${outcomes.length} passed`;
  console.log(`\n────── ${summary} ──────`);
  finishAndExit(summary, passed === outcomes.length ? 0 : 1, ctx.pool, ctx.teardownPool);
}

void main();
