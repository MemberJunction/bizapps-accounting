/**
 * block3-runtime.ts — live validation of the Block-3 intercompany net+batch engine + its DB invariant.
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *   PROVISION  Creating a 2nd ACP eagerly provisions, for the (A,B) pair: the IntercompanyRelationship
 *              row + 4 per-pair GL accounts (Due-From=Asset 11211-<code>, Due-To=Liability 21501-<code>),
 *              each in its OWNER company's COA with the right type (§C1, ERD §7).
 *   NET+BATCH  Synthesize the UPSTREAM gross legs: balanced JEs in company A hitting A's due-from-B
 *              (150) and due-to-B (100) accounts. buildBatch(A) → the batch summary shows a SINGLE net
 *              Due-From 50 ("gross preserved, net shipped"). The gross JEs/legs stay UNTOUCHED.
 *   ZERO/ONE   A pair that nets to zero produces no intercompany summary line; a one-sided position nets
 *              straight through.
 *   INV (50015) RAW-SQL bypass: a raw INSERT into IntercompanyRelationship with a wrong-type/wrong-owner
 *              account is REJECTED by trg_ICR_AccountOwnershipAndType — proving the invariant is un-bypassable.
 *
 * USAGE (cwd = instance worktree root, where .env resolves):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block3-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. FK-aware teardown (disables triggers to drop locked rows).
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { assertInvariantTriggers } from './trigger-preflight.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { buildBatch } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const ICR_ENTITY = 'MJ_BizApps_Accounting: Intercompany Relationships';
const SCHEMA = '__mj_BizAppsAccounting';

const RUN_TAG = `BLOCK3-${Date.now()}`;
function companyCode(suffix: string): string { return `B3${suffix}${Date.now().toString(36).slice(-5)}`.toUpperCase(); }

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

interface Ctx {
  pool: sql.ConnectionPool;
  /** A db_owner pool (MJ_CodeGen) used ONLY for FK-aware teardown — the app user MJ_Connect deliberately
   *  lacks ALTER (can't DISABLE TRIGGER) and can't delete locked JEs, which is the security model. */
  teardownPool: sql.ConnectionPool;
  user: UserInfo;
  companyAId: string; companyACode: string; companyBId: string; companyBCode: string;
  currencyCode: string; openPeriodsA: string[];
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
  await assertInvariantTriggers(pool); // pre-flight: fail fast if any invariant trigger (incl. trg_ICR) is missing/disabled
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');

  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code as string;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success} err=${cur.ErrorMessage})`);

  // Create the FIRST company (A). Provisioning will fire against any existing companies (none of ours yet).
  const companyACode = companyCode('A');
  const companyAId = await createCompany(ctxUser, companyACode, currencyCode);

  // Create the SECOND company (B). Its first-save provisioning eagerly wires the (A,B) intercompany pair.
  const companyBCode = companyCode('B');
  const companyBId = await createCompany(ctxUser, companyBCode, currencyCode);

  const periodRes = await rv.RunView<{ ID: string }>({ EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyAId}' AND PeriodType='Month' AND Status='Open'`, Fields: ['ID'], OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, ctxUser);
  const openPeriodsA = (periodRes.Results ?? []).map(p => p.ID);

  return { pool, teardownPool, user: ctxUser, companyAId, companyACode, companyBId, companyBCode, currencyCode, openPeriodsA };
}

async function createCompany(ctxUser: UserInfo, code: string, currencyCode: string): Promise<string> {
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctxUser);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} ${code}`;
  acp.Description = `${RUN_TAG} block3 test`;
  acp.CompanyCode = code;
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  const id = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return id;
}

/** Resolve a GL account id by (companyId, code). */
async function glIdByCode(ctx: Ctx, companyId: string, code: string): Promise<string | null> {
  const r = (await ctx.pool.request().query(`SELECT ID FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}' AND Code='${code}'`)).recordset[0];
  return r ? r.ID : null;
}

interface LineSpec { gl: string; debit?: number; credit?: number }
/** App-path: create a balanced Pending JE with the given lines. Returns the JE id. */
async function makeJE(ctx: Ctx, companyId: string, periodId: string, lines: LineSpec[]): Promise<string> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, ctx.user);
  je.NewRecord();
  je.CompanyID = companyId; je.AccountingPeriodID = periodId; je.EffectiveDate = new Date();
  je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} test`;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  let n = 0;
  for (const ls of lines) {
    n += 1;
    const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, ctx.user);
    l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = n; l.GLAccountID = ls.gl;
    l.DebitAmount = ls.debit ?? null; l.CreditAmount = ls.credit ?? null;
    if (!(await l.Save())) throw new Error(`line save failed: ${l.LatestResult?.CompleteMessage}`);
  }
  return je.ID;
}

/** Map every GL account in a company to a BC ExternalAccountID = its Code (so buildBatch can resolve §5.5). */
async function inlineMapAllGL(ctx: Ctx, companyId: string): Promise<void> {
  await ctx.pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`);
}

async function batchSummary(ctx: Ctx, batchId: string): Promise<{ glAccountId: string; debit: number; credit: number }[]> {
  const rows = (await ctx.pool.request().query(`SELECT GLAccountID, ISNULL(DebitAmount,0) dr, ISNULL(CreditAmount,0) cr FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID='${batchId}' ORDER BY LineNumber`)).recordset;
  return rows.map((r: { GLAccountID: string; dr: number; cr: number }) => ({ glAccountId: r.GLAccountID, debit: Number(r.dr), credit: Number(r.cr) }));
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyAId, companyACode, companyBId, companyBCode } = ctx;
  console.log(`\n══════ Block 3 runtime validation — user=${user.Email} A=${companyACode}(${companyAId}) B=${companyBCode}(${companyBId}) tag=${RUN_TAG} ══════\n`);
  assert(ctx.openPeriodsA.length >= 4, `need >=4 open month periods for A, got ${ctx.openPeriodsA.length}`);
  const P = ctx.openPeriodsA;

  // Resolve A's due-from-B / due-to-B accounts (A's COA references B's code).
  const aDueFromBCode = `11211-${companyBCode}`;
  const aDueToBCode = `21501-${companyBCode}`;
  let aDueFromB = '', aDueToB = '';

  // ─── PROVISION: relationship row + 4 accounts ──────────────────────────────
  await test('PROVISION — creating the 2nd ACP wired the (A,B) IntercompanyRelationship row', async () => {
    const rows = (await pool.request().query(`SELECT CompanyAID, CompanyBID, ADueToBGLAccountID, ADueFromBGLAccountID, BDueToAGLAccountID, BDueFromAGLAccountID, IsActive FROM ${SCHEMA}.IntercompanyRelationship WHERE (CompanyAID='${companyAId}' AND CompanyBID='${companyBId}') OR (CompanyAID='${companyBId}' AND CompanyBID='${companyAId}')`)).recordset;
    assert(rows.length === 1, `expected exactly 1 relationship row for the pair, got ${rows.length}`);
    assert(rows[0].IsActive === true, 'relationship row should be IsActive');
    // canonical: CompanyAID < CompanyBID (SQL Server order) — the CHECK passed on insert, so this is implied.
  });

  await test('PROVISION — the 4 per-pair GL accounts exist with the right codes/types/owners', async () => {
    // A's side: due-from-B (Asset, in A's COA), due-to-B (Liability, in A's COA).
    const aFrom = (await pool.request().query(`SELECT AccountType FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyAId}' AND Code='${aDueFromBCode}'`)).recordset[0];
    const aTo = (await pool.request().query(`SELECT AccountType FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyAId}' AND Code='${aDueToBCode}'`)).recordset[0];
    assert(!!aFrom && aFrom.AccountType === 'Asset', `A's due-from-B (${aDueFromBCode}) must be an Asset in A's COA`);
    assert(!!aTo && aTo.AccountType === 'Liability', `A's due-to-B (${aDueToBCode}) must be a Liability in A's COA`);
    // B's side references A's code.
    const bFrom = (await pool.request().query(`SELECT AccountType FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyBId}' AND Code='11211-${companyACode}'`)).recordset[0];
    const bTo = (await pool.request().query(`SELECT AccountType FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyBId}' AND Code='21501-${companyACode}'`)).recordset[0];
    assert(!!bFrom && bFrom.AccountType === 'Asset', `B's due-from-A must be an Asset in B's COA`);
    assert(!!bTo && bTo.AccountType === 'Liability', `B's due-to-A must be a Liability in B's COA`);
    aDueFromB = (await glIdByCode(ctx, companyAId, aDueFromBCode))!;
    aDueToB = (await glIdByCode(ctx, companyAId, aDueToBCode))!;
    assert(!!aDueFromB && !!aDueToB, 'resolved A-side account ids');
  });

  // Inline-map both companies' GL accounts so buildBatch's §5.5 resolution succeeds.
  await inlineMapAllGL(ctx, companyAId);
  await inlineMapAllGL(ctx, companyBId);

  // Non-intercompany accounts in A to balance the upstream legs (AR 11201, Revenue 40100).
  const arA = (await glIdByCode(ctx, companyAId, '11201'))!;
  const revA = (await glIdByCode(ctx, companyAId, '40100'))!;

  // ─── NET+BATCH: gross legs net into a single Due-From line ──────────────────
  const grossJEs: string[] = [];
  await test('NET+BATCH — gross due-from 150 + due-to 100 net into a SINGLE Due-From 50 summary line', async () => {
    // Upstream-emitted gross legs (separate balanced JEs), all in period P[0]:
    //   JE1: Dr due-from-B 150 / Cr AR 150   (counterparty owes A 150)
    //   JE2: Dr AR 100      / Cr due-to-B 100 (A owes counterparty 100)
    grossJEs.push(await makeJE(ctx, companyAId, P[0], [{ gl: aDueFromB, debit: 150 }, { gl: arA, credit: 150 }]));
    grossJEs.push(await makeJE(ctx, companyAId, P[0], [{ gl: arA, debit: 100 }, { gl: aDueToB, credit: 100 }]));

    const res = await buildBatch(companyAId, P[0], 'BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null');
    const summary = await batchSummary(ctx, res!.batchId);
    // Intercompany side must be a SINGLE net Due-From 50 (debit); NO gross due-to/due-from lines remain.
    const icoLines = summary.filter(s => s.glAccountId === aDueFromB || s.glAccountId === aDueToB);
    assert(icoLines.length === 1, `expected exactly 1 intercompany summary line, got ${icoLines.length}`);
    assert(icoLines[0].glAccountId === aDueFromB, 'net line should hit the Due-From account (A is net-owed)');
    assert(icoLines[0].debit === 50 && icoLines[0].credit === 0, `expected net Due-From debit 50, got dr=${icoLines[0].debit} cr=${icoLines[0].credit}`);
    // Batch still foots overall (balance-preserving).
    const td = Number((await pool.request().query(`SELECT TotalDebits td, TotalCredits tc FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${res!.batchId}'`)).recordset[0].td);
    const tc = Number((await pool.request().query(`SELECT TotalCredits tc FROM ${SCHEMA}.JournalEntryBatch WHERE ID='${res!.batchId}'`)).recordset[0].tc);
    assert(Math.abs(td - tc) < 0.005, `batch must still foot: td=${td} tc=${tc}`);
  });

  await test('NET+BATCH — gross JE legs are UNTOUCHED (system of record preserved)', async () => {
    // The original due-from leg still carries 150; the due-to leg still carries 100.
    const dueFromLeg = (await pool.request().query(`SELECT ISNULL(DebitAmount,0) dr FROM ${SCHEMA}.JournalEntryLine WHERE GLAccountID='${aDueFromB}' AND JournalEntryID='${grossJEs[0]}'`)).recordset[0];
    const dueToLeg = (await pool.request().query(`SELECT ISNULL(CreditAmount,0) cr FROM ${SCHEMA}.JournalEntryLine WHERE GLAccountID='${aDueToB}' AND JournalEntryID='${grossJEs[1]}'`)).recordset[0];
    assert(Number(dueFromLeg.dr) === 150, `gross due-from leg must still be 150, got ${dueFromLeg.dr}`);
    assert(Number(dueToLeg.cr) === 100, `gross due-to leg must still be 100, got ${dueToLeg.cr}`);
  });

  // ─── ZERO case: equal positions → no intercompany line ─────────────────────
  await test('ZERO case — equal due-from/due-to (80/80) net to zero → NO intercompany summary line', async () => {
    // Balance each gross leg against DIFFERENT non-intercompany accounts (AR debit / Rev credit) so a
    // non-intercompany summary line survives and the batch isn't empty — isolating the intercompany drop.
    await makeJE(ctx, companyAId, P[1], [{ gl: aDueFromB, debit: 80 }, { gl: revA, credit: 80 }]);
    await makeJE(ctx, companyAId, P[1], [{ gl: arA, debit: 80 }, { gl: aDueToB, credit: 80 }]);
    const res = await buildBatch(companyAId, P[1], 'BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null (non-intercompany legs should still net to lines)');
    const summary = await batchSummary(ctx, res!.batchId);
    const icoLines = summary.filter(s => s.glAccountId === aDueFromB || s.glAccountId === aDueToB);
    assert(icoLines.length === 0, `expected NO intercompany summary line when net is zero, got ${icoLines.length}`);
    // sanity: the AR debit 80 and Rev credit 80 non-intercompany lines survived.
    assert(summary.length === 2, `expected 2 surviving non-intercompany lines, got ${summary.length}`);
  });

  // ─── ONE-SIDED case: only a due-to position → single net credit ────────────
  await test('ONE-SIDED case — only a due-to 60 position → a single net Due-To credit 60', async () => {
    await makeJE(ctx, companyAId, P[2], [{ gl: arA, debit: 60 }, { gl: aDueToB, credit: 60 }]);
    const res = await buildBatch(companyAId, P[2], 'BusinessCentral', user.ID, user);
    assert(res !== null, 'buildBatch returned null');
    const summary = await batchSummary(ctx, res!.batchId);
    const icoLines = summary.filter(s => s.glAccountId === aDueFromB || s.glAccountId === aDueToB);
    assert(icoLines.length === 1, `expected 1 intercompany summary line, got ${icoLines.length}`);
    assert(icoLines[0].glAccountId === aDueToB && icoLines[0].credit === 60, `expected net Due-To credit 60, got ${JSON.stringify(icoLines[0])}`);
  });

  // ─── INV 50015: RAW-SQL bypass — wrong-type/wrong-owner account rejected ────
  await test('INV (50015) — RAW INSERT into IntercompanyRelationship with a wrong-TYPE account is rejected', async () => {
    // Use A's AR account (11201, an Asset) in the Due-To slot (which requires a Liability) → trigger THROWs 50015.
    // Need a fresh canonical pair the UQ won't reject; create a throwaway 3rd company to pair with A.
    const cCode = companyCode('C');
    const cId = await createCompany(user, cCode, ctx.currencyCode);
    // Creating C auto-provisioned the (A,C) and (B,C) rows. Drop the (A,C) row so the UQ_ICR_Pair
    // constraint doesn't fire BEFORE the trigger when we attempt the deliberately-bad insert below.
    await pool.request().query(`DELETE FROM ${SCHEMA}.IntercompanyRelationship WHERE (CompanyAID='${companyAId}' AND CompanyBID='${cId}') OR (CompanyAID='${cId}' AND CompanyBID='${companyAId}')`);
    // Resolve valid-but-WRONG-TYPE accounts: A's AR / C's AR (both Assets) — putting an Asset in a
    // Due-To slot (which requires a Liability) trips trg_ICR_AccountOwnershipAndType (50015).
    // Need 4 DISTINCT accounts (CK_ICR_DistinctAccts) where the Due-To slots hold the WRONG type.
    // Use each company's two Assets (11101 Operating Cash, 11201 AR) — distinct, and putting an Asset
    // in a Due-To slot (which requires Liability) trips the trigger, not the distinct-accounts CHECK.
    const cashAId = (await glIdByCode(ctx, companyAId, '11101'))!;
    const arAId = (await glIdByCode(ctx, companyAId, '11201'))!;
    const cashCId = (await glIdByCode(ctx, cId, '11101'))!;
    const arCId = (await glIdByCode(ctx, cId, '11201'))!;
    // Canonical order A vs C the way CK_ICR_CanonicalPair wants (DB decides — its uniqueidentifier order).
    const ord = (await pool.request().query(`SELECT CASE WHEN CAST('${companyAId}' AS uniqueidentifier) < CAST('${cId}' AS uniqueidentifier) THEN 1 ELSE 0 END AS aFirst`)).recordset[0].aFirst;
    const aSlot = ord ? companyAId : cId;
    const bSlot = ord ? cId : companyAId;
    const aDueTo = ord ? cashAId : cashCId;   // A-slot Due-To: an Asset (WRONG — needs Liability) → 50015
    const aDueFrom = ord ? arAId : arCId;     // A-slot Due-From: an Asset (correct type, distinct)
    const bDueTo = ord ? cashCId : cashAId;   // B-slot Due-To: an Asset (WRONG)
    const bDueFrom = ord ? arCId : arAId;     // B-slot Due-From: an Asset (correct type, distinct)
    // The mssql driver surfaces THROW 50015 with the error NUMBER on err.number, not in err.message —
    // so assert on the trigger's distinctive message text (which only THROW 50015 emits) to prove it fired.
    await expectThrow(() => pool.request().query(
      `INSERT INTO ${SCHEMA}.IntercompanyRelationship (ID, CompanyAID, CompanyBID, ADueToBGLAccountID, ADueFromBGLAccountID, BDueToAGLAccountID, BDueFromAGLAccountID, IsActive) ` +
      `VALUES (NEWID(), '${aSlot}', '${bSlot}', '${aDueTo}', '${aDueFrom}', '${bDueTo}', '${bDueFrom}', 1)`,
    ), 'correct AccountType (Due-To=Liability, Due-From=Asset)');
    await cleanupCompany(ctx, cId);
  });

  // ─── Teardown ──────────────────────────────────────────────────────────────
  await cleanupCompany(ctx, companyAId);
  await cleanupCompany(ctx, companyBId);

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 3 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  await ctx.teardownPool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

/** FK-aware teardown for one company: disable accounting triggers, drop rows in dependency order.
 *  Uses the db_owner teardownPool — the app user can't DISABLE TRIGGER or delete locked JEs (by design). */
async function cleanupCompany(ctx: Ctx, companyId: string): Promise<void> {
  const { teardownPool: pool } = ctx;
  const exec = async (q: string) => { try { await pool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch', 'IntercompanyRelationship']) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  // 1) Delete in FK order with triggers disabled: lines → JEs → batch line items → batches.
  //    (JEs FK to batches via FK_JE_Batch, so JEs go before batches — mirrors the block2 teardown.)
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (SELECT ID FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}')`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}'`);
  // 2) ICR rows referencing this company (either slot) — before its GL accounts (the 4 per-pair FKs).
  await exec(`DELETE FROM ${SCHEMA}.IntercompanyRelationship WHERE CompanyAID='${companyId}' OR CompanyBID='${companyId}'`);
  for (const t of ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineItem', 'JournalEntryBatch', 'IntercompanyRelationship']) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchSequence WHERE CompanyID='${companyId}'`);
  // 4) ACP references its default GL accounts (FK_ACP_AROpen, _Realized/UnrealizedFX, etc.) → null before GL delete.
  await exec(`UPDATE ${SCHEMA}.AccountingCompanyProfile SET AROpenGLAccountID=NULL, DeferredRevenueGLAccountID=NULL, SalesTaxPayableGLAccountID=NULL, RealizedFXGainLossGLAccountID=NULL, UnrealizedFXGainLossGLAccountID=NULL WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingPeriod WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);
}

void main();
