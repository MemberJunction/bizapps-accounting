/**
 * intercompany-runtime.ts — live validation of the intercompany Due To / Due From pair (BA-D26).
 *
 * WHY THIS HARNESS EXISTS AT ALL
 * Every rule here guards the same failure mode, and it is a nasty one: a mis-configured or
 * mis-oriented intercompany pair still produces a PERFECTLY BALANCED journal entry. Debits equal
 * credits, the entry posts, every downstream balance assertion passes — and the only symptom is
 * two companies' balance sheets quietly disagreeing, months later. There is no self-evident signal,
 * so the invariants have to be tested explicitly or they are not covered at all.
 *
 * THREE LAYERS, DELIBERATELY OVERLAPPING (see README "Coverage bar")
 *   I1-I7   The DB floor, via RAW SQL that bypasses the entity layer entirely. This is the only
 *           thing standing between a bad row and the ledger when someone writes directly.
 *   I8-I12  IntercompanyAccountMatchEntityServer, via the REAL entity API. Same rules, but the
 *           question here is whether a human gets a readable refusal instead of "THROW 50024",
 *           plus the one rule only it can enforce (ambiguous tie).
 *   I13-I16 AccountingEngineBase.ResolveIntercompanyAccounts against REAL rows — that the reader
 *           orients the pair the way the writer stored it. Unit tests cover the logic; this covers
 *           the cache actually loading the two new collections.
 *
 * Everything created is torn down in a finally block. Two AccountingCompanyProfiles are created
 * (the IsA parent mints the __mj.Company), because an intercompany pair needs two companies and
 * ordered pairs mean the direction has to be real, not simulated.
 *
 * USAGE (cwd MUST be the repo root so .env resolves):
 *   npx tsx test-harnesses/server/intercompany-runtime.ts
 *
 * Exit code: 0 = all passed, 1 = test failures, 2 = bootstrap error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { assertInvariantTriggers } from './trigger-preflight.js';
import { finishAndExit } from './harness-exit.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingIntercompanyAccountMatchEntity,
} from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const IAM_ENTITY = 'MJ_BizApps_Accounting: Intercompany Account Matches';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';

const SCHEMA = '__mj_BizAppsAccounting';
const ACP_TABLE = `${SCHEMA}.AccountingCompanyProfile`;
const GL_TABLE = `${SCHEMA}.GLAccount`;
const IAM_TABLE = `${SCHEMA}.IntercompanyAccountMatch`;
const IAMD_TABLE = `${SCHEMA}.IntercompanyAccountMatchDimension`;
const DIM_TABLE = `${SCHEMA}.Dimension`;
const DIMVAL_TABLE = `${SCHEMA}.DimensionValue`;
const COMPANY_TABLE = '__mj.Company';

const RUN_TAG = `IC-${Date.now()}`;
const suffix = () => Date.now().toString(36).slice(-6).toUpperCase();

// ─── Tiny test runner (same shape as the other server harnesses) ───────────
interface Outcome { Name: string; Passed: boolean; Ms: number; Error?: string }
const outcomes: Outcome[] = [];
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    outcomes.push({ Name: name, Passed: true, Ms: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (e) {
    const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
    outcomes.push({ Name: name, Passed: false, Ms: Date.now() - start, Error: msg });
    console.log(`  ✗ ${name} (${Date.now() - start}ms)\n      ${msg}`);
  }
}
function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

/**
 * Run a raw INSERT that MUST be refused, and return the SQL error number.
 *
 * Asserting merely that "an error was thrown" would pass for the wrong reason — a typo'd column
 * name throws too. The error NUMBER is what proves the intended trigger fired.
 */
async function expectRefused(pool: sql.ConnectionPool, query: string, what: string): Promise<number> {
  try {
    await pool.request().query(query);
  } catch (e) {
    const num = (e as { number?: number }).number ?? 0;
    return num;
  }
  throw new Error(`${what}: the write was ACCEPTED, but it must be refused`);
}

interface Ctx { pool: sql.ConnectionPool; user: UserInfo; currencyCode: string }

async function bootstrap(): Promise<Ctx> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const host = process.env.DB_HOST;
  const database = process.env.DB_DATABASE;
  const user = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const schema = process.env.MJ_CORE_SCHEMA || '__mj';
  if (!host || !database || !user || !password) {
    throw new Error('Missing DB settings in .env (DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD). Run from the repo root.');
  }
  const pool = await new sql.ConnectionPool({
    server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();

  await setupSQLServerClient(new SQLServerProviderConfigData(pool, schema));
  await assertInvariantTriggers(pool);
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found in UserCache.');

  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>(
    { EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  if (!cur.Success || cur.Results.length === 0) {
    throw new Error(`Could not resolve a seeded currency code: ${cur.ErrorMessage ?? 'no rows'}`);
  }
  return { pool, user: ctxUser, currencyCode: cur.Results[0].Code };
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try {
    ctx = await bootstrap();
  } catch (e) {
    console.error('BOOTSTRAP ERROR:', e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
  const { pool, user, currencyCode } = ctx;
  console.log(`\n══════ Intercompany runtime validation — user=${user.Email} tag=${RUN_TAG} ══════\n`);

  const md = new Metadata();
  const companyIds: string[] = [];
  const createdMatchIds: string[] = [];
  const createdDimIds: string[] = [];

  // Accounts: A owns a Liability (its Due To) + a stray Asset; B owns an Asset (its Due From) +
  // a Revenue account used to prove the account-TYPE rule bites.
  let companyA = '', companyB = '';
  let aDueTo = '', aAsset = '', bDueFrom = '', aRevenue = '';
  let dimDept = '', dimRegion = '', valueRegionEmea = '';

  try {
    // ─── Fixture: two companies ────────────────────────────────────────────
    for (const label of ['A', 'B']) {
      const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
      acp.NewRecord();
      acp.Name = `${RUN_TAG} Co ${label}`;
      acp.Description = 'intercompany runtime harness';
      acp.CompanyCode = `IC${label}${suffix()}`;
      acp.FunctionalCurrencyCode = currencyCode;
      acp.EntityType = 'Subsidiary';
      const ok = await acp.Save();
      if (!ok) throw new Error(`fixture: could not create company ${label}: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
      companyIds.push(acp.ID);
    }
    [companyA, companyB] = companyIds;

    // ─── Fixture: the GL accounts, written raw (fixture setup, not the code under test) ──
    const mkAccount = async (companyId: string, code: string, name: string, type: string): Promise<string> => {
      const id = randomUUID();
      await pool.request()
        .input('id', sql.UniqueIdentifier, id)
        .input('company', sql.UniqueIdentifier, companyId)
        .input('code', sql.NVarChar(40), code)
        .input('name', sql.NVarChar(200), name)
        .input('type', sql.NVarChar(15), type)
        .query(`INSERT INTO ${GL_TABLE} (ID, CompanyID, Code, Name, AccountType) VALUES (@id, @company, @code, @name, @type)`);
      return id;
    };
    const s = suffix();
    aDueTo = await mkAccount(companyA, `ICT-2100-${s}`, 'Due To B', 'Liability');
    aAsset = await mkAccount(companyA, `ICT-1000-${s}`, 'Cash A', 'Asset');
    aRevenue = await mkAccount(companyA, `ICT-4000-${s}`, 'Revenue A', 'Revenue');
    bDueFrom = await mkAccount(companyB, `ICT-1200-${s}`, 'Due From A', 'Asset');

    // ─── Fixture: two dimensions and one value ────────────────────────────
    // Created HERE rather than inside a test: when this lived in I6, a fixture failure surfaced as
    // a passing refusal test (the insert threw, which is what I6 was looking for) and then broke
    // three unrelated checks downstream. Fixtures must fail loudly as fixtures.
    dimDept = randomUUID(); dimRegion = randomUUID(); valueRegionEmea = randomUUID();
    await pool.request().query(
      `INSERT INTO ${DIM_TABLE} (ID, Code, Name) VALUES
         ('${dimDept}',   'ICT-DEPT-${s}',   '${RUN_TAG} Dept'),
         ('${dimRegion}', 'ICT-REGION-${s}', '${RUN_TAG} Region')`);
    await pool.request().query(
      `INSERT INTO ${DIMVAL_TABLE} (ID, DimensionID, Code, Name) VALUES ('${valueRegionEmea}','${dimRegion}','EMEA','EMEA')`);

    const pair = (source: string, target: string, dueTo: string, dueFrom: string, status = 'Active') =>
      `INSERT INTO ${IAM_TABLE} (ID, SourceCompanyID, TargetCompanyID, DueToGLAccountID, DueFromGLAccountID, Status)
       VALUES (NEWID(), '${source}', '${target}', '${dueTo}', '${dueFrom}', '${status}')`;

    // ═══ LAYER 1 — the DB floor (raw SQL, entity layer bypassed) ═══════════
    console.log('── Layer 1: DB triggers + CHECK constraints (raw SQL) ──');

    await test('I1 a correctly-oriented pair is ACCEPTED', async () => {
      const id = randomUUID();
      await pool.request().query(
        `INSERT INTO ${IAM_TABLE} (ID, SourceCompanyID, TargetCompanyID, DueToGLAccountID, DueFromGLAccountID, Status)
         VALUES ('${id}', '${companyA}', '${companyB}', '${aDueTo}', '${bDueFrom}', 'Active')`);
      createdMatchIds.push(id);
      const n = await pool.request().query(`SELECT COUNT(*) AS n FROM ${IAM_TABLE} WHERE ID='${id}'`);
      assert(n.recordset[0].n === 1, 'the valid pair did not persist');
    });

    await test('I2 DueTo belonging to the OTHER company is refused (50024)', async () => {
      // Source=B, but the DueTo account belongs to A. This is the swapped-pair mistake, and it is
      // the one that would otherwise post a balanced-but-wrong entry.
      const num = await expectRefused(pool, pair(companyB, companyA, aDueTo, bDueFrom), 'I2');
      assert(num === 50024, `expected error 50024, got ${num}`);
    });

    await test('I3 DueFrom belonging to the SOURCE company is refused (50025)', async () => {
      const num = await expectRefused(pool, pair(companyA, companyB, aDueTo, aAsset), 'I3');
      assert(num === 50025, `expected error 50025, got ${num}`);
    });

    await test('I4 a Revenue account as the Due To leg is refused (50026)', async () => {
      const num = await expectRefused(pool, pair(companyA, companyB, aRevenue, bDueFrom), 'I4');
      assert(num === 50026, `expected error 50026, got ${num}`);
    });

    await test('I5 a company owing ITSELF is refused (CHECK)', async () => {
      const num = await expectRefused(pool, pair(companyA, companyA, aDueTo, aAsset), 'I5');
      assert(num === 547, `expected a CHECK-constraint violation (547), got ${num}`);
    });

    await test('I6 a dimension VALUE from a different dimension is refused (50027)', async () => {
      // valueRegionEmea belongs to dimRegion, so pinning it under dimDept is the mismatch.
      const num = await expectRefused(pool,
        `INSERT INTO ${IAMD_TABLE} (ID, IntercompanyAccountMatchID, Side, DimensionID, DimensionValueID)
         VALUES (NEWID(), '${createdMatchIds[0]}', 'DueTo', '${dimDept}', '${valueRegionEmea}')`, 'I6');
      assert(num === 50027, `expected error 50027, got ${num}`);
    });

    await test('I7 an invalid Side is refused (CHECK)', async () => {
      const num = await expectRefused(pool,
        `INSERT INTO ${IAMD_TABLE} (ID, IntercompanyAccountMatchID, Side, DimensionID)
         VALUES (NEWID(), '${createdMatchIds[0]}', 'Either', '${dimDept}')`, 'I7');
      assert(num === 547, `expected a CHECK-constraint violation (547), got ${num}`);
    });

    await test('I8 a matching dimension VALUE is accepted, and both Sides can carry the same Dimension', async () => {
      const a = randomUUID(), b = randomUUID();
      await pool.request().query(
        `INSERT INTO ${IAMD_TABLE} (ID, IntercompanyAccountMatchID, Side, DimensionID, DimensionValueID, Sequence)
         VALUES ('${a}', '${createdMatchIds[0]}', 'DueTo',   '${dimRegion}', '${valueRegionEmea}', 10),
                ('${b}', '${createdMatchIds[0]}', 'DueFrom', '${dimRegion}', NULL, 20)`);
      createdDimIds.push(a, b);
      const n = await pool.request().query(
        `SELECT COUNT(*) AS n FROM ${IAMD_TABLE} WHERE IntercompanyAccountMatchID='${createdMatchIds[0]}'`);
      assert(n.recordset[0].n === 2, `expected 2 dimension rows, got ${n.recordset[0].n}`);
    });

    // ═══ LAYER 2 — the entity server (real entity API) ═════════════════════
    console.log('\n── Layer 2: IntercompanyAccountMatchEntityServer (entity API) ──');

    // The pair created in I1 occupies (A→B, StartedAt NULL, Active), so the tie test below has
    // something real to collide with.
    await test('I9 a reversed pair is refused with a READABLE message, not a raw SQL error', async () => {
      const m = await md.GetEntityObject<mjBizAppsAccountingIntercompanyAccountMatchEntity>(IAM_ENTITY, user);
      m.NewRecord();
      m.SourceCompanyID = companyB;
      m.TargetCompanyID = companyA;
      m.DueToGLAccountID = aDueTo;      // belongs to A, but source is B
      m.DueFromGLAccountID = bDueFrom;  // belongs to B, but target is A
      m.Status = 'Active';
      const ok = await m.Save();
      assert(!ok, 'a reversed pair saved through the entity API');
      const msg = m.LatestResult?.CompleteMessage ?? '';
      // The point of layer 2 is the MESSAGE. Asserting only !ok would pass even if the save had
      // failed for an unrelated reason, which is exactly how a check ends up green for nothing.
      assert(/SourceCompanyID/i.test(msg) && /swap/i.test(msg),
        `expected a readable orientation message naming SourceCompanyID and suggesting a swap, got: ${msg}`);
      assert(!/50024/.test(msg), `expected the entity layer to refuse BEFORE the trigger, but got the raw SQL error: ${msg}`);
    });

    await test('I10 a Revenue account as the Due To leg is refused with a message naming the type', async () => {
      const m = await md.GetEntityObject<mjBizAppsAccountingIntercompanyAccountMatchEntity>(IAM_ENTITY, user);
      m.NewRecord();
      m.SourceCompanyID = companyA;
      m.TargetCompanyID = companyB;
      m.DueToGLAccountID = aRevenue;
      m.DueFromGLAccountID = bDueFrom;
      m.Status = 'Active';
      const ok = await m.Save();
      assert(!ok, 'a Revenue Due To leg saved through the entity API');
      const msg = m.LatestResult?.CompleteMessage ?? '';
      assert(/Liability/i.test(msg) && /Revenue/i.test(msg),
        `expected a message naming both the required and actual account type, got: ${msg}`);
    });

    await test('I11 a SECOND Active pair with the same StartedAt is refused (ambiguous tie)', async () => {
      // This is the rule ONLY the entity server enforces. Two Active rows sharing a StartedAt make
      // resolution arbitrary — the tie-break is a strict '>' — and both pairs balance, so nothing
      // downstream would ever notice which one won.
      const m = await md.GetEntityObject<mjBizAppsAccountingIntercompanyAccountMatchEntity>(IAM_ENTITY, user);
      m.NewRecord();
      m.SourceCompanyID = companyA;
      m.TargetCompanyID = companyB;
      m.DueToGLAccountID = aDueTo;
      m.DueFromGLAccountID = bDueFrom;
      m.Status = 'Active';   // StartedAt left null — same as the I1 row
      const ok = await m.Save();
      assert(!ok, 'a duplicate Active pair with the same StartedAt saved');
      const msg = m.LatestResult?.CompleteMessage ?? '';
      assert(/StartedAt/i.test(msg), `expected a message about the StartedAt collision, got: ${msg}`);
    });

    await test('I12 a SUPERSEDING pair with a later StartedAt IS accepted (overlap is legal)', async () => {
      // Overlapping windows are how a mapping is replaced — only the TIE is ambiguous. If this ever
      // starts failing, the tie check has over-reached into blocking legitimate supersession.
      const m = await md.GetEntityObject<mjBizAppsAccountingIntercompanyAccountMatchEntity>(IAM_ENTITY, user);
      m.NewRecord();
      m.SourceCompanyID = companyA;
      m.TargetCompanyID = companyB;
      m.DueToGLAccountID = aDueTo;
      m.DueFromGLAccountID = bDueFrom;
      m.Status = 'Active';
      m.StartedAt = new Date('2026-09-01T00:00:00Z');
      const ok = await m.Save();
      assert(ok, `superseding pair was refused: ${m.LatestResult?.CompleteMessage ?? 'unknown'}`);
      createdMatchIds.push(m.ID);
    });

    // ═══ LAYER 3 — the engine resolver against REAL rows ═══════════════════
    console.log('\n── Layer 3: AccountingEngineBase.ResolveIntercompanyAccounts (real rows) ──');

    await test('I13 the cache loads the two new collections', async () => {
      await AccountingEngineBase.Instance.Config(true, user);
      const matches = AccountingEngineBase.Instance.IntercompanyAccountMatches;
      const dims = AccountingEngineBase.Instance.IntercompanyAccountMatchDimensions;
      assert(matches.length >= 2, `expected at least the 2 pairs created here, got ${matches.length}`);
      assert(dims.length >= 2, `expected at least the 2 dimension rows created here, got ${dims.length}`);
    });

    await test('I14 resolves A→B with the legs on the correct companies', async () => {
      const r = AccountingEngineBase.Instance.ResolveIntercompanyAccounts(companyA, companyB, new Date('2026-07-26'));
      assert(r !== null, 'expected a resolved pair for A→B');
      assert(r!.DueTo.GLAccountID.toLowerCase() === aDueTo.toLowerCase(), 'DueTo resolved to the wrong account');
      assert(r!.DueTo.CompanyID.toLowerCase() === companyA.toLowerCase(), 'the Due To liability must sit on the SOURCE company');
      assert(r!.DueFrom.GLAccountID.toLowerCase() === bDueFrom.toLowerCase(), 'DueFrom resolved to the wrong account');
      assert(r!.DueFrom.CompanyID.toLowerCase() === companyB.toLowerCase(), 'the Due From receivable must sit on the TARGET company');
    });

    await test('I15 does NOT resolve the reverse direction (ordered pairs)', async () => {
      const r = AccountingEngineBase.Instance.ResolveIntercompanyAccounts(companyB, companyA, new Date('2026-07-26'));
      assert(r === null, 'B→A resolved from a row that only describes A→B');
    });

    await test('I16 picks the superseding row once its window opens', async () => {
      const before = AccountingEngineBase.Instance.ResolveIntercompanyAccounts(companyA, companyB, new Date('2026-07-26'));
      const after = AccountingEngineBase.Instance.ResolveIntercompanyAccounts(companyA, companyB, new Date('2026-10-01'));
      assert(before !== null && after !== null, 'both dates should resolve');
      assert(before!.Match.ID.toLowerCase() === createdMatchIds[0].toLowerCase(), 'July should still resolve the original pair');
      assert(after!.Match.ID.toLowerCase() !== before!.Match.ID.toLowerCase(),
        'October should resolve the superseding pair, not the original');
    });

    await test('I17 carries the DueTo side dimensions, ordered, with the pinned value', async () => {
      const r = AccountingEngineBase.Instance.ResolveIntercompanyAccounts(companyA, companyB, new Date('2026-07-26'))!;
      assert(r.DueTo.Dimensions.length === 1, `expected 1 DueTo dimension, got ${r.DueTo.Dimensions.length}`);
      assert(r.DueTo.Dimensions[0].DimensionValueID?.toLowerCase() === valueRegionEmea.toLowerCase(),
        'the pinned DueTo dimension value did not survive resolution');
      assert(r.DueFrom.Dimensions.length === 1 && r.DueFrom.Dimensions[0].DimensionValueID === null,
        'the DueFrom side should carry one dimension with a null (from-context) value');
    });

  } finally {
    // ─── Teardown — FK-aware order ────────────────────────────────────────
    const exec = (q: string) => pool.request().query(q);
    const steps: Array<() => Promise<unknown>> = [
      () => exec(`DELETE FROM ${IAMD_TABLE} WHERE IntercompanyAccountMatchID IN (SELECT ID FROM ${IAM_TABLE} WHERE SourceCompanyID IN ('${companyIds.join("','")}') OR TargetCompanyID IN ('${companyIds.join("','")}'))`),
      () => exec(`DELETE FROM ${IAM_TABLE} WHERE SourceCompanyID IN ('${companyIds.join("','")}') OR TargetCompanyID IN ('${companyIds.join("','")}')`),
      () => exec(`DELETE FROM ${DIMVAL_TABLE} WHERE DimensionID IN ('${dimDept}','${dimRegion}')`),
      () => exec(`DELETE FROM ${DIM_TABLE} WHERE ID IN ('${dimDept}','${dimRegion}')`),
      ...companyIds.map(id => () => exec(`DELETE FROM ${ACP_TABLE} WHERE ID='${id}'`)),
      ...companyIds.map(id => () => exec(`DELETE FROM ${GL_TABLE} WHERE CompanyID='${id}'`)),
      ...companyIds.map(id => () => exec(`DELETE FROM ${COMPANY_TABLE} WHERE ID='${id}'`)),
    ];
    if (companyIds.length > 0) {
      for (const step of steps) {
        try { await step(); } catch (e) { console.log(`      teardown warn: ${e instanceof Error ? e.message : String(e)}`); }
      }
    }
  }

  const failed = outcomes.filter(o => !o.Passed);
  finishAndExit(
    `\n────── Intercompany runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`,
    failed.length > 0 ? 1 : 0,
    pool,
  );
}

void main();
