/**
 * engine-runtime.ts — live validation of the ACCOUNTING ENGINE (AM-7 step 4, plan §6):
 * AccountingEngineBase caches + ResolveLinkedAccount against real GLAccountLink rows, and the
 * 'Accounting.CreateJournalEntry' remotable op end-to-end through the REAL provider — the exact
 * in-process call site orders-server will use (`op.Execute(input, { user })`).
 *
 *   E1  success — a draft with mergeable duplicate lines + a dimension tag books atomically:
 *       typed result (EntryNumber JE-{FY}-{seq}, LineCount), raw-SQL cross-check of the JE header,
 *       merged/ordered/numbered lines, per-line company, and the dimension row.
 *   E2  typed failures, live — ACCOUNT_UNKNOWN · ACCOUNT_INACTIVE · DIMENSION_UNKNOWN ·
 *       DIMENSION_VALUE_UNKNOWN · UNBALANCED (overall) · UNBALANCED per company (AM-4) ·
 *       MALFORMED_DRAFT — each returns Success:false with the right code and writes NOTHING.
 *   E3  ATOMIC ROLLBACK — a stale-cache dimension value (row deleted underneath the engine by raw
 *       SQL, so validation passes but the FK fails mid-write) rolls back the WHOLE TransactionGroup:
 *       Success:false INTERNAL_ERROR and raw SQL proves ZERO partial rows (header, lines, dims).
 *   E4  ResolveLinkedAccount — real GLAccountLink windows (expired vs current vs pending),
 *       role by NAME and by ID, ordered GLAccountLinkDimension list, unknown record → null.
 *       (This is the live coverage for the GLAccountRole/Link/LinkDimension trio — testing.md ledger.)
 *
 * PRECONDITION: zero stray Pending JEs (the engine writes Pending JEs; other harnesses' strays
 * would confuse the raw-SQL cross-checks). Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/engine-runtime.ts
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
import '@mj-biz-apps/accounting-core-entities-server';
import { CreateJournalEntryOperation } from '@mj-biz-apps/accounting-core-entities-server';
import {
  AccountingEngineBase,
  type CreateJournalEntryOutput,
  type JournalEntryDraft,
} from '@mj-biz-apps/accounting-engine-base';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingGLAccountLinkEntity,
} from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const LINK_ENTITY = 'MJ_BizApps_Accounting: GL Account Links';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const SCHEMA = '__mj_BizAppsAccounting';
const RUN_TAG = `ENGINE-${Date.now()}`;
let companyCodeCounter = 0;
function companyCode(): string { return `EN${(companyCodeCounter++)}${Date.now().toString(36).slice(-6)}`.toUpperCase(); }

interface Outcome { Name: string; Passed: boolean; Ms: number; Error?: string }
const outcomes: Outcome[] = [];
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try { await fn(); outcomes.push({ Name: name, Passed: true, Ms: Date.now() - start }); console.log(`  ✓ ${name} (${Date.now() - start}ms)`); }
  catch (e) { const msg = e instanceof Error ? (e.stack ?? e.message) : String(e); outcomes.push({ Name: name, Passed: false, Ms: Date.now() - start, Error: msg }); console.log(`  ✗ ${name} (${Date.now() - start}ms)\n      ${msg.split('\n')[0]}`); }
}
function assert(cond: boolean, message: string): void { if (!cond) throw new Error(message); }

interface Company { id: string; arGL: string; revGL: string; cashGL: string }
interface Ctx {
  pool: sql.ConnectionPool;
  teardownPool: sql.ConnectionPool;
  user: UserInfo;
  companyA: Company; companyB: Company;
  dimId: string; dimValSales: string; dimValMktg: string;
  dimId2: string; dimVal2: string;
}

const createdJEIds: string[] = [];
const createdLinkIds: string[] = [];

async function createCompany(user: UserInfo, currencyCode: string, label: string): Promise<Company> {
  const md = new Metadata();
  const rv = new RunView();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} ${label}`;
  acp.Description = `${RUN_TAG} engine test (${label})`;
  acp.CompanyCode = companyCode();
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  const id = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed (${label}): ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
  const glRes = await rv.RunView<{ ID: string; Code: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${id}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  const arGL = byCode.get('11201'); const revGL = byCode.get('40100'); const cashGL = byCode.get('11101');
  if (!arGL || !revGL || !cashGL) throw new Error(`seeded GL accounts not found for ${label}`);
  return { id, arGL, revGL, cashGL };
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
  await assertInvariantTriggers(pool);
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  const stray = (await pool.request().query(`SELECT COUNT(*) n FROM ${SCHEMA}.JournalEntry WHERE Status='Pending'`)).recordset[0].n;
  if (Number(stray) > 0) throw new Error(`${stray} stray Pending JE(s) exist — clean them up before running engine-runtime.`);
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success})`);

  const companyA = await createCompany(ctxUser, currencyCode, 'Co A');
  const companyB = await createCompany(ctxUser, currencyCode, 'Co B');

  // Two dimensions: DEPT (2 values — Sales/Mktg) and REGION (1 value) for the wrong-dimension case.
  const dimId = randomUUID(), dimValSales = randomUUID(), dimValMktg = randomUUID();
  const dimId2 = randomUUID(), dimVal2 = randomUUID();
  await pool.request().query(`INSERT INTO ${SCHEMA}.Dimension (ID, Code, Name) VALUES ('${dimId}','DEPT-${RUN_TAG}','Department ${RUN_TAG}'),('${dimId2}','REG-${RUN_TAG}','Region ${RUN_TAG}')`);
  await pool.request().query(`INSERT INTO ${SCHEMA}.DimensionValue (ID, DimensionID, Code, Name) VALUES ('${dimValSales}','${dimId}','SALES','Sales'),('${dimValMktg}','${dimId}','MKTG','Marketing'),('${dimVal2}','${dimId2}','WEST','West')`);

  return { pool, teardownPool, user: ctxUser, companyA, companyB, dimId, dimValSales, dimValMktg, dimId2, dimVal2 };
}

/** The one call site orders-server will use: op.Execute over the in-process provider. */
async function runOp(ctx: Ctx, draft: JournalEntryDraft): Promise<CreateJournalEntryOutput> {
  const op = new CreateJournalEntryOperation();
  const result = await op.Execute(draft, { user: ctx.user });
  assert(result.Success === true || result.ResultCode !== 'EXECUTION_ERROR', `op transport failed: ${result.ErrorMessage}`);
  assert(result.Output != null, `op returned no Output (ResultCode=${result.ResultCode}, ${result.ErrorMessage ?? ''})`);
  const out = result.Output!;
  if (out.Success && out.JournalEntryID) createdJEIds.push(out.JournalEntryID);
  return out;
}

function expectError(out: CreateJournalEntryOutput, code: string): void {
  assert(out.Success === false, `expected Success=false with ${code}, got success ${JSON.stringify(out)}`);
  assert((out.Errors ?? []).some(e => e.Code === code), `expected error code ${code}, got ${JSON.stringify(out.Errors)}`);
}

async function scalar(pool: sql.ConnectionPool, q: string): Promise<unknown> {
  const r = await pool.request().query(q);
  const row = r.recordset?.[0];
  return row ? Object.values(row)[0] : undefined;
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyA, companyB } = ctx;
  console.log(`\n══════ Accounting engine runtime — user=${user.Email} companies=${companyA.id},${companyB.id} tag=${RUN_TAG} ══════\n`);

  // Prime the engine caches over the real provider (MJAPI does this at startup via @RegisterForStartup).
  await AccountingEngineBase.Instance.Config(true, user);

  // ─── E1 — success path ─────────────────────────────────────────────────────
  await test('E1 success — duplicate lines merge, debits order first, dimension lands, EntryNumber assigned (atomic)', async () => {
    const out = await runOp(ctx, {
      EffectiveDate: new Date().toISOString(),
      EntryType: 'OrderBooking',
      Description: `${RUN_TAG} E1`,
      Lines: [
        { GLAccountID: companyA.revGL, CreditAmount: 60, Dimensions: [{ DimensionID: ctx.dimId, DimensionValueID: ctx.dimValSales }] },
        { GLAccountID: companyA.arGL, DebitAmount: 70 },
        { GLAccountID: companyA.arGL, DebitAmount: 30 },                    // merges with the 70
        { GLAccountID: companyA.revGL, CreditAmount: 40 },                  // does NOT merge (no dims)
      ],
    });
    assert(out.Success === true, `expected success, got ${JSON.stringify(out.Errors)}`);
    assert(/^JE-\d{4}-\d{6}$/.test(out.EntryNumber ?? ''), `EntryNumber '${out.EntryNumber}' should be JE-{FY}-{seq:000000}`);
    assert(out.LineCount === 3, `expected 3 normalized lines (AR merged; Rev split by dims), got ${out.LineCount}`);
    // Raw-SQL cross-checks — the truth, not the code under test.
    const je = (await pool.request().query(`SELECT Status, EntryType FROM ${SCHEMA}.JournalEntry WHERE ID='${out.JournalEntryID}'`)).recordset[0];
    assert(!!je && je.Status === 'Pending' && je.EntryType === 'OrderBooking', `JE row wrong: ${JSON.stringify(je)}`);
    const lines = (await pool.request().query(`SELECT LineNumber, GLAccountID, DebitAmount, CreditAmount FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${out.JournalEntryID}' ORDER BY LineNumber`)).recordset;
    assert(lines.length === 3, `expected 3 line rows, got ${lines.length}`);
    assert(Number(lines[0].DebitAmount) === 100 && lines[0].GLAccountID.toLowerCase() === companyA.arGL.toLowerCase(), `line 1 should be the merged Dr AR 100, got ${JSON.stringify(lines[0])}`);
    assert(lines[1].CreditAmount != null && lines[2].CreditAmount != null, 'lines 2-3 should be the credits (debits first)');
    const dimRows = (await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID WHERE l.JournalEntryID='${out.JournalEntryID}'`)).recordset[0].c;
    assert(Number(dimRows) === 1, `expected exactly 1 dimension row, got ${dimRows}`);
  });

  // ─── E2 — typed failures (each writes NOTHING) ─────────────────────────────
  const jeCountBefore = Number(await scalar(pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry`));

  await test('E2 ACCOUNT_UNKNOWN — unknown GL id refused', async () => {
    const out = await runOp(ctx, { EffectiveDate: '2026-07-06', EntryType: 'Manual', Lines: [
      { GLAccountID: randomUUID(), DebitAmount: 100 },
      { GLAccountID: companyA.revGL, CreditAmount: 100 },
    ] });
    expectError(out, 'ACCOUNT_UNKNOWN');
  });

  await test('E2 ACCOUNT_INACTIVE — deactivated GL refused (cache auto-refresh honored via forced re-config)', async () => {
    await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET IsActive=0 WHERE ID='${companyA.cashGL}'`);
    await AccountingEngineBase.Instance.Config(true, user); // raw SQL emits no entity events — force refresh
    const out = await runOp(ctx, { EffectiveDate: '2026-07-06', EntryType: 'Manual', Lines: [
      { GLAccountID: companyA.cashGL, DebitAmount: 100 },
      { GLAccountID: companyA.revGL, CreditAmount: 100 },
    ] });
    expectError(out, 'ACCOUNT_INACTIVE');
  });

  await test('E2 DIMENSION_UNKNOWN — nonexistent dimension refused', async () => {
    const out = await runOp(ctx, { EffectiveDate: '2026-07-06', EntryType: 'Manual', Lines: [
      { GLAccountID: companyA.arGL, DebitAmount: 100 },
      { GLAccountID: companyA.revGL, CreditAmount: 100, Dimensions: [{ DimensionID: randomUUID(), DimensionValueID: ctx.dimValSales }] },
    ] });
    expectError(out, 'DIMENSION_UNKNOWN');
  });

  await test('E2 DIMENSION_VALUE_UNKNOWN — value from ANOTHER dimension refused (no auto-create, CH-12)', async () => {
    const out = await runOp(ctx, { EffectiveDate: '2026-07-06', EntryType: 'Manual', Lines: [
      { GLAccountID: companyA.arGL, DebitAmount: 100 },
      { GLAccountID: companyA.revGL, CreditAmount: 100, Dimensions: [{ DimensionID: ctx.dimId, DimensionValueID: ctx.dimVal2 }] },
    ] });
    expectError(out, 'DIMENSION_VALUE_UNKNOWN');
  });

  await test('E2 UNBALANCED — overall imbalance refused', async () => {
    const out = await runOp(ctx, { EffectiveDate: '2026-07-06', EntryType: 'Manual', Lines: [
      { GLAccountID: companyA.arGL, DebitAmount: 100 },
      { GLAccountID: companyA.revGL, CreditAmount: 80 },
    ] });
    expectError(out, 'UNBALANCED');
  });

  await test('E2 UNBALANCED per company — overall-balanced but cross-company-unbalanced refused (AM-4)', async () => {
    const out = await runOp(ctx, { EffectiveDate: '2026-07-06', EntryType: 'Manual', Lines: [
      { GLAccountID: companyA.arGL, DebitAmount: 100 },
      { GLAccountID: companyB.revGL, CreditAmount: 100 },
    ] });
    expectError(out, 'UNBALANCED');
    assert((out.Errors ?? []).some(e => /AM-4/.test(e.Message)), `expected the per-company AM-4 message, got ${JSON.stringify(out.Errors)}`);
  });

  await test('E2 MALFORMED_DRAFT — single-line draft refused', async () => {
    const out = await runOp(ctx, { EffectiveDate: '2026-07-06', EntryType: 'Manual', Lines: [
      { GLAccountID: companyA.arGL, DebitAmount: 100 },
    ] });
    expectError(out, 'MALFORMED_DRAFT');
  });

  await test('E2 failures wrote NOTHING (raw JE count unchanged)', async () => {
    const after = Number(await scalar(pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry`));
    assert(after === jeCountBefore, `expected ${jeCountBefore} JEs after the failure cases, got ${after}`);
  });

  // ─── E3 — atomic rollback (stale cache → FK failure mid-write) ─────────────
  await test('E3 ATOMIC ROLLBACK — mid-write FK failure leaves ZERO partial rows (raw-SQL proven)', async () => {
    // Delete the Mktg dimension VALUE underneath the engine (raw SQL emits no entity events, so the
    // cache stays stale and validation passes) → the dimension INSERT fails its FK inside the
    // TransactionGroup → the whole write must roll back: no header, no lines, no dims.
    //
    // ⚠ MJ-CORE BUG GUARD (see instance BUGS.md "a FAILED TransactionGroup crashes the whole Node
    // process"): a failed TG makes each queued BaseEntity's rxjs subscriber re-throw on a fresh
    // tick → uncaughtException. The rollback + typed result are CORRECT; only the out-of-band
    // re-throw is broken. Swallow exactly that error, for the duration of this test only.
    const swallowTGCrash = (e: Error): void => {
      if (/Transaction rolled back due to operation failure/.test(e?.message ?? '')) return; // known MJ-core bug
      throw e;
    };
    process.on('uncaughtException', swallowTGCrash);
    try {
      await pool.request().query(`DELETE FROM ${SCHEMA}.DimensionValue WHERE ID='${ctx.dimValMktg}'`);
      const marker = `${RUN_TAG} E3-rollback`;
      const out = await runOp(ctx, {
        EffectiveDate: '2026-07-06', EntryType: 'Manual', Description: marker, Lines: [
          { GLAccountID: companyA.arGL, DebitAmount: 100 },
          { GLAccountID: companyA.revGL, CreditAmount: 100, Dimensions: [{ DimensionID: ctx.dimId, DimensionValueID: ctx.dimValMktg }] },
        ],
      });
      expectError(out, 'INTERNAL_ERROR');
      await new Promise(res => setTimeout(res, 100)); // let the deferred rxjs re-throw fire under the guard
      const partials = Number(await scalar(pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry WHERE Description='${marker}'`));
      assert(partials === 0, `atomicity broken: ${partials} partial JE header(s) survived the rollback`);
      const orphanLines = Number(await scalar(pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntryLine l WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.JournalEntry j WHERE j.ID=l.JournalEntryID)`));
      assert(orphanLines === 0, `atomicity broken: ${orphanLines} orphan line(s) survived`);
      await AccountingEngineBase.Instance.Config(true, user); // re-sync the cache with reality
    } finally {
      process.removeListener('uncaughtException', swallowTGCrash);
    }
  });

  // ─── E4 — ResolveLinkedAccount over real GLAccountLink rows ────────────────
  const targetRecordId = randomUUID(); // stands in for e.g. an Orders Product row
  let targetEntityId = '';
  await test('E4 ResolveLinkedAccount — dated window wins now, expired window wins in its own period, ordered dims', async () => {
    targetEntityId = String(await scalar(pool, `SELECT TOP 1 ID FROM __mj.Entity WHERE Name='MJ_BizApps_Accounting: GL Accounts'`));
    const role = AccountingEngineBase.Instance.GLAccountRoleByName('Sales');
    assert(!!role, "seeded role 'Sales' not found in the engine cache");
    const md = new Metadata();
    const mkLink = async (glId: string, started: string | null, ended: string | null, status: mjBizAppsAccountingGLAccountLinkEntity['Status']): Promise<string> => {
      const link = await md.GetEntityObject<mjBizAppsAccountingGLAccountLinkEntity>(LINK_ENTITY, user);
      link.NewRecord();
      link.GLAccountID = glId;
      link.GLAccountRoleID = role!.ID;
      link.EntityID = targetEntityId;
      link.RecordID = targetRecordId;
      link.Status = status;
      link.StartedAt = started ? new Date(started) : null;
      link.EndedAt = ended ? new Date(ended) : null;
      assert(await link.Save(), `link save failed: ${link.LatestResult?.CompleteMessage}`);
      createdLinkIds.push(link.ID);
      return link.ID;
    };
    await mkLink(companyA.revGL, '2026-01-01', '2026-02-01', 'Active');      // expired window
    const currentId = await mkLink(companyB.revGL, '2026-06-01', null, 'Active'); // current window
    await mkLink(companyA.cashGL, null, null, 'Pending');                    // never eligible
    // Ordered dimension requirements on the current link (Sequence 2 then 1 — must come back sorted).
    await pool.request().query(`INSERT INTO ${SCHEMA}.GLAccountLinkDimension (ID, GLAccountLinkID, DimensionID, Sequence) VALUES (NEWID(),'${currentId}','${ctx.dimId2}',2),(NEWID(),'${currentId}','${ctx.dimId}',1)`);
    await AccountingEngineBase.Instance.Config(true, user);

    const nowHit = AccountingEngineBase.Instance.ResolveLinkedAccount(targetEntityId, targetRecordId, 'Sales', new Date());
    assert(!!nowHit, 'expected the current-window link to resolve for today');
    assert(nowHit!.Link.GLAccountID.toLowerCase() === companyB.revGL.toLowerCase(), `today should resolve the 2026-06 link, got ${nowHit!.Link.GLAccountID}`);
    assert(nowHit!.Dimensions.length === 2 && nowHit!.Dimensions[0].Sequence === 1 && nowHit!.Dimensions[1].Sequence === 2, `expected 2 dims ordered by Sequence, got ${JSON.stringify(nowHit!.Dimensions.map(d => d.Sequence))}`);

    const janHit = AccountingEngineBase.Instance.ResolveLinkedAccount(targetEntityId, targetRecordId, role!.ID, new Date('2026-01-15'));
    assert(!!janHit && janHit.Link.GLAccountID.toLowerCase() === companyA.revGL.toLowerCase(), 'January should resolve the expired-window link (by role ID)');

    const march = AccountingEngineBase.Instance.ResolveLinkedAccount(targetEntityId, targetRecordId, 'Sales', new Date('2026-03-15'));
    assert(march === null, 'March falls between windows — expected null');
  });

  await test('E4 ResolveLinkedAccount — unknown record / unknown role → null (caller walks its fallback chain)', async () => {
    assert(AccountingEngineBase.Instance.ResolveLinkedAccount(targetEntityId, randomUUID(), 'Sales', new Date()) === null, 'unknown record should be null');
    assert(AccountingEngineBase.Instance.ResolveLinkedAccount(targetEntityId, targetRecordId, 'No Such Role', new Date()) === null, 'unknown role should be null');
  });

  // ─── Teardown (db_owner pool) ──────────────────────────────────────────────
  const exec = async (q: string) => { try { await ctx.teardownPool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  const jeIdList = createdJEIds.map(id => `'${id}'`).join(',');
  const toggled = ['JournalEntryLine', 'JournalEntry'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    if (jeIdList) {
      await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID WHERE l.JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList})`);
    }
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }
  if (createdLinkIds.length > 0) {
    const linkList = createdLinkIds.map(id => `'${id}'`).join(',');
    await exec(`DELETE FROM ${SCHEMA}.GLAccountLinkDimension WHERE GLAccountLinkID IN (${linkList})`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccountLink WHERE ID IN (${linkList})`);
  }
  await exec(`DELETE FROM ${SCHEMA}.DimensionValue WHERE DimensionID IN ('${ctx.dimId}','${ctx.dimId2}')`);
  await exec(`DELETE FROM ${SCHEMA}.Dimension WHERE ID IN ('${ctx.dimId}','${ctx.dimId2}')`);
  for (const co of [companyA, companyB]) {
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${co.id}'`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${co.id}'`);
    await exec(`DELETE FROM __mj.Company WHERE ID='${co.id}'`);
  }

  const failed = outcomes.filter(o => !o.Passed);
  finishAndExit(`\n────── Accounting engine runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`, failed.length > 0 ? 1 : 0, pool, ctx.teardownPool);
}

void main();
