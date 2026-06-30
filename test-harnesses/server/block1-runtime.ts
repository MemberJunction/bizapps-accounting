/**
 * block1-runtime.ts — live validation of the Block-1 JE-lifecycle hooks + DB invariants.
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *   W4  adjusting-entry routing: post to a CLOSED period — error w/o OriginalAccountingPeriodID;
 *       routes to the next open period w/ it.
 *   W6  generateReversal: new Pending JE (EntryType='Reversal'), Dr/Cr swapped, back-referenced.
 *   F1  validateJournalEntry: balanced/open/active → valid; unbalanced → invalid.
 *   INV (DB triggers, §11.1 — each with a RAW-SQL bypass case + an allowed counter-case):
 *       balanced-on-lock (50001) · JE immutability (50003/50004) · JE-line immutability (50006) ·
 *       period-close (50007).
 *
 * USAGE (cwd = instance worktree root, where .env resolves):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block1-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. Idempotent (FK-aware teardown).
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
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const SCHEMA = '__mj_BizAppsAccounting';

const RUN_TAG = `BLOCK1-${Date.now()}`;
function companyCode(): string { return `B1${Date.now().toString(36).slice(-7)}`.toUpperCase(); }

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

interface Ctx { pool: sql.ConnectionPool; user: UserInfo; companyId: string; arGL: string; revGL: string; openPeriods: { ID: string; PeriodStart: string }[]; batchId: string }

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

  // Create the test company (W1 seeds COA + periods).
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctxUser);
  acp.NewRecord();
  acp.Set('Name', `${RUN_TAG} Co`);
  acp.Set('Description', `${RUN_TAG} block1 test`);
  acp.Set('CompanyCode', companyCode());
  acp.Set('FunctionalCurrencyCode', currencyCode);
  acp.Set('EntityType', 'Subsidiary');
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, ctxUser);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  const periodRes = await rv.RunView<{ ID: string; PeriodStart: string }>({ EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`, Fields: ['ID', 'PeriodStart'], OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, ctxUser);
  const periods = periodRes.Results ?? [];

  // A Pending batch for the lock tests — a JE can only be Batched if BatchID is set
  // (CK_JournalEntry_BatchedHasBatch). The batch stays Pending so it can be referenced + cleaned.
  const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, ctxUser);
  batch.NewRecord();
  batch.Set('CompanyID', companyId); batch.Set('AccountingPeriodID', periods[0].ID);
  batch.Set('TargetSystem', 'BusinessCentral'); batch.Set('BatchedAt', new Date());
  batch.Set('BatchedByUserID', ctxUser.ID); batch.Set('Status', 'Pending');
  batch.Set('TotalEntries', 0); batch.Set('TotalDebits', 0); batch.Set('TotalCredits', 0);
  if (!(await batch.Save())) throw new Error(`batch save failed: ${batch.LatestResult?.CompleteMessage}`);

  return { pool, user: ctxUser, companyId, arGL: byCode.get('11201')!, revGL: byCode.get('40100')!, openPeriods: periods, batchId: batch.ID };
}

/** App-path helper: create a Pending JE with a balanced (or unbalanced) Dr-AR / Cr-Revenue pair. */
async function makeJE(ctx: Ctx, periodId: string, debit: number, credit: number, opts?: { originalPeriodId?: string }): Promise<mjBizAppsAccountingJournalEntryEntity> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = ctx.companyId; je.AccountingPeriodID = periodId; je.EffectiveDate = new Date();
  je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} test`;
  if (opts?.originalPeriodId) je.OriginalAccountingPeriodID = opts.originalPeriodId;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  await addLine(ctx, je.ID, 1, ctx.arGL, debit, null);
  await addLine(ctx, je.ID, 2, ctx.revGL, null, credit);
  return je;
}
async function addLine(ctx: Ctx, jeId: string, lineNo: number, glId: string, debit: number | null, credit: number | null): Promise<void> {
  const md = new Metadata();
  const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
  l.NewRecord(); l.JournalEntryID = jeId; l.LineNumber = lineNo; l.GLAccountID = glId;
  l.DebitAmount = debit; l.CreditAmount = credit;
  if (!(await l.Save())) throw new Error(`line save failed: ${l.LatestResult?.CompleteMessage}`);
}
async function setStatus(ctx: Ctx, jeId: string, status: string): Promise<boolean> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  await je.Load(jeId);
  if (status === 'Batched' || status === 'GLPosted') je.Set('BatchID', ctx.batchId); // CK_JournalEntry_BatchedHasBatch
  je.Status = status as 'Pending' | 'Batched' | 'GLPosted';
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
  const { pool, user, companyId, arGL } = ctx;
  console.log(`\n══════ Block 1 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);
  assert(ctx.openPeriods.length >= 3, `need >=3 open month periods, got ${ctx.openPeriods.length}`);
  const openP = ctx.openPeriods[0].ID;        // general open period
  const md = new Metadata();

  // ─── W4 — adjusting-entry routing ─────────────────────────────────────────
  await test('W4.1 post to a CLOSED period WITHOUT OriginalAccountingPeriodID → blocked', async () => {
    const closed = ctx.openPeriods[5];
    await pool.request().query(`UPDATE ${SCHEMA}.AccountingPeriod SET Status='Closed', ClosedAt=GETUTCDATE(), ClosedByUserID='${user.ID}' WHERE ID='${closed.ID}'`);
    await expectThrow(async () => {
      const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
      je.NewRecord(); je.CompanyID = companyId; je.AccountingPeriodID = closed.ID; je.EffectiveDate = new Date();
      je.EntryType = 'Manual'; je.Status = 'Pending';
      const ok = await je.Save();
      if (!ok) throw new Error(je.LatestResult?.CompleteMessage ?? 'save returned false');
    }, 'CLOSED period');
  });

  await test('W4.2 post to a CLOSED period WITH OriginalAccountingPeriodID → routed to next open period', async () => {
    const closed = ctx.openPeriods[5];   // closed in W4.1
    const expectedNextOpen = ctx.openPeriods[6].ID;
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord(); je.CompanyID = companyId; je.AccountingPeriodID = closed.ID; je.EffectiveDate = new Date();
    je.EntryType = 'Adjustment'; je.Status = 'Pending'; je.OriginalAccountingPeriodID = closed.ID;
    assert(await je.Save(), `routed JE save failed: ${je.LatestResult?.CompleteMessage}`);
    assert(je.AccountingPeriodID === expectedNextOpen, `expected routing to ${expectedNextOpen}, got ${je.AccountingPeriodID}`);
    assert(je.OriginalAccountingPeriodID === closed.ID, 'OriginalAccountingPeriodID should reference the closed period');
    // reopen for clean teardown
    await pool.request().query(`UPDATE ${SCHEMA}.AccountingPeriod SET Status='Open', ClosedAt=NULL, ClosedByUserID=NULL WHERE ID='${closed.ID}'`);
  });

  // ─── INV: balanced-on-lock (trg 50001) ────────────────────────────────────
  await test('INV balanced-on-lock — DB-bypass raw UPDATE to Batched on an unbalanced JE → rejected (50001)', async () => {
    const jeId = randomUUID();
    await pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntry (ID, EntryNumber, CompanyID, AccountingPeriodID, EffectiveDate, EntryType, Status) VALUES ('${jeId}','RAW-${RUN_TAG}-1','${companyId}','${openP}', GETUTCDATE(), 'Manual','Pending')`);
    await pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntryLine (ID, JournalEntryID, LineNumber, GLAccountID, DebitAmount) VALUES (NEWID(), '${jeId}', 1, '${arGL}', 100.00)`);
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET Status='Batched', BatchID='${ctx.batchId}' WHERE ID='${jeId}'`), 'Sum(Debits)');
  });

  await test('INV balanced-on-lock — allowed: a balanced JE locks to Batched', async () => {
    const je = await makeJE(ctx, openP, 100, 100);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'balanced JE should lock to Batched');
  });

  // ─── INV: JE immutability (trg 50003 delete / 50004 update) ───────────────
  await test('INV JE immutability — DB-bypass UPDATE of a frozen field on a Batched JE → rejected (50004)', async () => {
    const je = await makeJE(ctx, openP, 50, 50);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET EffectiveDate = DATEADD(day,1,EffectiveDate) WHERE ID='${je.ID}'`), 'locked');
  });

  await test('INV JE immutability — DB-bypass DELETE of a Batched JE → rejected (50003)', async () => {
    // Use a LINE-LESS JE so the FK (JEL→JE) doesn't pre-empt the trigger; 0 lines balances (0=0).
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord(); je.CompanyID = companyId; je.AccountingPeriodID = openP; je.EffectiveDate = new Date();
    je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} delete-test`;
    assert(await je.Save(), `je save failed: ${je.LatestResult?.CompleteMessage}`);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await expectThrow(() => pool.request().query(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID='${je.ID}'`), 'cannot be deleted');
  });

  await test('INV JE immutability — allowed: GL-roundtrip fields update on a Batched JE', async () => {
    const je = await makeJE(ctx, openP, 70, 70);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await pool.request().query(`UPDATE ${SCHEMA}.JournalEntry SET GLReferenceID='BC-REF-1', GLPostedAt=GETUTCDATE() WHERE ID='${je.ID}'`);
  });

  // ─── INV: JE-line immutability (trg 50006) ────────────────────────────────
  await test('INV JE-line immutability — DB-bypass UPDATE of a line on a Batched JE → rejected (50006)', async () => {
    const je = await makeJE(ctx, openP, 80, 80);
    assert(await setStatus(ctx, je.ID, 'Batched'), 'lock failed');
    await expectThrow(() => pool.request().query(`UPDATE ${SCHEMA}.JournalEntryLine SET DebitAmount=999 WHERE JournalEntryID='${je.ID}' AND DebitAmount IS NOT NULL`), 'locked');
  });

  // ─── INV: period-close (trg 50007) ────────────────────────────────────────
  await test('INV period-close — DB-bypass raw INSERT into a Closed period → rejected (50007)', async () => {
    const closed = ctx.openPeriods[7];
    await pool.request().query(`UPDATE ${SCHEMA}.AccountingPeriod SET Status='Closed', ClosedAt=GETUTCDATE(), ClosedByUserID='${user.ID}' WHERE ID='${closed.ID}'`);
    await expectThrow(() => pool.request().query(`INSERT INTO ${SCHEMA}.JournalEntry (ID, EntryNumber, CompanyID, AccountingPeriodID, EffectiveDate, EntryType, Status) VALUES (NEWID(),'RAW-${RUN_TAG}-PC','${companyId}','${closed.ID}', GETUTCDATE(),'Manual','Pending')`), 'Closed period');
    await pool.request().query(`UPDATE ${SCHEMA}.AccountingPeriod SET Status='Open', ClosedAt=NULL, ClosedByUserID=NULL WHERE ID='${closed.ID}'`);
  });

  // ─── W6 — reversal ────────────────────────────────────────────────────────
  await test('W6 generateReversal — new Reversal JE with Dr/Cr swapped + back-references', async () => {
    const orig = await makeJE(ctx, openP, 100, 100) as JournalEntryEntityServer;
    const reversal = await orig.generateReversal('block1 test reversal', user);
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
    const arLine = (lr.Results ?? []).find(l => l.GLAccountID === arGL);
    assert(!!arLine && arLine.CreditAmount === 100 && (arLine.DebitAmount ?? null) === null, `AR line should be swapped to a 100 credit, got Dr=${arLine?.DebitAmount} Cr=${arLine?.CreditAmount}`);
  });

  // ─── F1 — validateJournalEntry ────────────────────────────────────────────
  await test('F1 validateJournalEntry — balanced/open/active JE is valid', async () => {
    const je = await makeJE(ctx, openP, 100, 100);
    const r = await validateJournalEntry(je.ID, user);
    assert(r.valid, `expected valid, got errors: ${r.errors.join('; ')}`);
  });

  await test('F1 validateJournalEntry — unbalanced JE is invalid (balance error)', async () => {
    const je = await makeJE(ctx, openP, 100, 100);
    await addLine(ctx, je.ID, 3, ctx.revGL, null, 25); // tip it out of balance (extra credit)
    const r = await validateJournalEntry(je.ID, user);
    assert(!r.valid && r.errors.some(e => e.includes('unbalanced')), `expected unbalanced invalid, got: valid=${r.valid} errors=${r.errors.join('; ')}`);
  });

  // ─── Teardown (disable accounting triggers to clean locked rows) ──────────
  const exec = async (q: string) => { try { await pool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.JournalEntryLine`);
  await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.JournalEntry`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (SELECT ID FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}')`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.JournalEntry`);
  await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.JournalEntryLine`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchSequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingPeriod WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);
  const leftover = (await pool.request().query(`SELECT COUNT(*) n FROM __mj.Company WHERE ID='${companyId}'`)).recordset[0].n;
  if (leftover > 0) {
    console.log(`  (teardown note: company ${companyId} + its Batched (immutable-by-design) test JEs persist — full cleanup needs ALTER-TRIGGER rights the app DB user lacks. Run against a resettable test DB for a pristine state; see test-harnesses/server/README.)`);
  }

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 1 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
