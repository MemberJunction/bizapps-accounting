/**
 * block0-runtime.ts — live server-side validation of the Block-0 foundation hooks.
 *
 * Validates W1/W2/W3 against a REAL SQL Server instance DB, through the REAL data
 * provider, using the REAL bizapps-accounting server entity subclasses — i.e. the exact
 * code path MJAPI runs. This is the reliable integration harness (kept in-repo); the
 * Vitest suite in packages/CoreEntitiesServer is pure-logic only (no DB).
 *
 *   W1  AccountingCompanyProfile first-save seeding (AccountingCompanyProfileEntityServer):
 *        1. create + Save() succeeds
 *        2. seeds EXACTLY the 10 minimal GL accounts (IsSystemSeeded), codes as expected
 *        3. generates 17 AccountingPeriods (12 month + 4 quarter + 1 year)
 *        4. wires the 5 default GL-account refs to the right account codes
 *        5. defaults OperatingTimeZone = 'UTC' (Block-0 addition)
 *        6. __mj.RecordChange rows exist for the seeded rows (audit-by-construction)
 *   W2  JournalEntry numbering (JournalEntryEntityServer): EntryNumber = JE-{Code}-{FY}-{seq:000000}
 *   W3  JournalEntryBatch numbering (JournalEntryBatchEntityServer): BatchNumber = BATCH-{Code}-{seq:000000}
 *
 * Everything created is torn down in a finally block (raw SQL by CompanyID) so the run
 * is idempotent and leaves the DB clean. Verification uses raw mssql queries so a wrong
 * count is caught even if the entity layer reports success.
 *
 * USAGE (cwd MUST be the instance worktree root so .env resolves, e.g.
 *   ~/MJDev/instances/bizapps-accounting-dev/mj):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harness/block0-runtime.ts
 *
 * Exit code: 0 = all passed, 1 = test failures, 2 = bootstrap error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { assertInvariantTriggers } from './trigger-preflight.js';
// Register core + bizapps entity subclasses AND the accounting server hooks (W1/W2/W3) on
// the ClassFactory so GetEntityObject returns the real server subclasses (matches MJAPI boot).
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryBatchEntity,
} from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';

const SCHEMA = '__mj_BizAppsAccounting';
const ACP_TABLE = `${SCHEMA}.AccountingCompanyProfile`;
const COMPANY_TABLE = '__mj.Company';
const GL_TABLE = `${SCHEMA}.GLAccount`;
const PERIOD_TABLE = `${SCHEMA}.AccountingPeriod`;
const JE_TABLE = `${SCHEMA}.JournalEntry`;
const BATCH_TABLE = `${SCHEMA}.JournalEntryBatch`;
const JESEQ_TABLE = `${SCHEMA}.JournalEntrySequence`;       // created on-demand by the JE numbering sproc; FKs to Company
const BATCHSEQ_TABLE = `${SCHEMA}.JournalEntryBatchSequence`; // created on-demand by the batch numbering sproc; FKs to Company

const EXPECTED_CODES = ['11101', '11201', '21201', '21301', '21401', '21402', '40100', '40200', '50400', '50500'];
const EXPECTED_REFS: Record<string, string> = {
  AROpenGLAccountID: '11201',
  DeferredRevenueGLAccountID: '21301',
  SalesTaxPayableGLAccountID: '21201',
  RealizedFXGainLossGLAccountID: '50400',
  UnrealizedFXGainLossGLAccountID: '50500',
};

const RUN_TAG = `BLOCK0-${Date.now()}`;
function companyCode(): string {
  return `B0${Date.now().toString(36).slice(-7)}`.toUpperCase(); // ~9 chars, fits nvarchar(20), unique
}
const sameId = (a: string, b: string): boolean => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

// ─── Tiny test runner ──────────────────────────────────────────────────────
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

async function scalar(pool: sql.ConnectionPool, query: string, id: string): Promise<number> {
  const r = await pool.request().input('id', sql.UniqueIdentifier, id).query(query);
  return r.recordset[0].n as number;
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
    throw new Error('Missing DB settings in .env (DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD). Run from the instance worktree root.');
  }
  const pool = await new sql.ConnectionPool({
    server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();

  // NOTE on permissions: CodeGen creates the EntityPermission rows for every
  // __mj_BizAppsAccounting entity on this instance (verified — all 28 entities have their 3 perm
  // rows, created in the codegen run, not by this harness). So NO permission grant is needed here.
  // (An earlier draft of this harness carried a defensive grant copied from the IS-A validation
  // harness — a DIFFERENT instance that genuinely lacked perms; it was a redundant no-op here and
  // was removed.)
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, schema));
  await assertInvariantTriggers(pool); // 1b pre-flight: fail fast if any invariant trigger is missing/disabled
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
  console.log(`\n══════ Block 0 runtime validation — user=${user.Email} currency=${currencyCode} tag=${RUN_TAG} ══════\n`);

  const md = new Metadata();
  let acpId = '';
  let seededGLIds: string[] = [];

  // ─── W1 — profile init seeding ────────────────────────────────────────────
  await test('W1.1 create AccountingCompanyProfile — Save() succeeds', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    acp.NewRecord();
    acp.Set('Name', `${RUN_TAG} Co`);
    acp.Set('Description', 'Block 0 runtime test');
    acp.Set('CompanyCode', companyCode());
    acp.Set('FunctionalCurrencyCode', currencyCode);
    acp.Set('EntityType', 'Subsidiary');
    acpId = acp.ID;
    assert(!!acpId, 'ACP.ID empty after NewRecord (shared PK not minted)');
    const ok = await acp.Save();
    assert(ok, `Save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);
  });

  await test('W1.2 seeds EXACTLY the 10 minimal GL accounts (IsSystemSeeded), correct codes', async () => {
    const rv = new RunView();
    const res = await rv.RunView<{ ID: string; Code: string; IsSystemSeeded: boolean }>(
      { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${acpId}'`, Fields: ['ID', 'Code', 'IsSystemSeeded'], ResultType: 'simple' }, user);
    assert(res.Success, `GL RunView failed: ${res.ErrorMessage}`);
    const rows = res.Results ?? [];
    seededGLIds = rows.map(r => r.ID);
    assert(rows.length === 10, `expected 10 GL accounts, got ${rows.length}`);
    const codes = rows.map(r => r.Code).sort();
    assert(JSON.stringify(codes) === JSON.stringify([...EXPECTED_CODES].sort()),
      `unexpected COA codes: ${codes.join(',')}`);
    assert(rows.every(r => r.IsSystemSeeded === true), 'some seeded GL accounts are not flagged IsSystemSeeded');
    // raw-SQL cross-check
    const dbN = await scalar(pool, `SELECT COUNT(*) AS n FROM ${GL_TABLE} WHERE CompanyID=@id`, acpId);
    assert(dbN === 10, `raw DB GL count expected 10, got ${dbN}`);
  });

  await test('W1.3 generates 17 AccountingPeriods (12 month + 4 quarter + 1 year)', async () => {
    const rv = new RunView();
    const res = await rv.RunView<{ PeriodType: string }>(
      { EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${acpId}'`, Fields: ['PeriodType'], ResultType: 'simple' }, user);
    assert(res.Success, `Period RunView failed: ${res.ErrorMessage}`);
    const rows = res.Results ?? [];
    assert(rows.length === 17, `expected 17 periods, got ${rows.length}`);
    const byType = (t: string) => rows.filter(r => r.PeriodType === t).length;
    assert(byType('Month') === 12, `expected 12 Month periods, got ${byType('Month')}`);
    assert(byType('Quarter') === 4, `expected 4 Quarter periods, got ${byType('Quarter')}`);
    assert(byType('Year') === 1, `expected 1 Year period, got ${byType('Year')}`);
  });

  await test('W1.4 wires the 5 default GL-account refs to the right account codes', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    await acp.Load(acpId);
    const rv = new RunView();
    const glRes = await rv.RunView<{ ID: string; Code: string }>(
      { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${acpId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
    const idToCode = new Map((glRes.Results ?? []).map(r => [r.ID.toLowerCase(), r.Code]));
    for (const [field, expectedCode] of Object.entries(EXPECTED_REFS)) {
      const refId = acp.Get(field) as string | null;
      assert(!!refId, `${field} not wired (null)`);
      const code = idToCode.get((refId as string).toLowerCase());
      assert(code === expectedCode, `${field} -> code ${code ?? '??'} (expected ${expectedCode})`);
    }
  });

  await test('W1.5 defaults OperatingTimeZone = UTC (Block-0 addition)', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    await acp.Load(acpId);
    assert(acp.OperatingTimeZone === 'UTC', `OperatingTimeZone expected 'UTC', got '${acp.OperatingTimeZone}'`);
  });

  await test('W1.6 __mj.RecordChange rows exist for seeded rows (audit-by-construction)', async () => {
    const acpChanges = await scalar(pool,
      `SELECT COUNT(*) AS n FROM __mj.RecordChange WHERE LOWER(RecordID)=LOWER(CONCAT('ID|',CONVERT(NVARCHAR(100),@id)))`, acpId);
    let glChanges = 0;
    for (const glId of seededGLIds) {
      glChanges += await scalar(pool,
        `SELECT COUNT(*) AS n FROM __mj.RecordChange WHERE LOWER(RecordID)=LOWER(CONCAT('ID|',CONVERT(NVARCHAR(100),@id)))`, glId);
    }
    console.log(`      (RecordChange rows — ACP: ${acpChanges}, seeded GL accounts: ${glChanges})`);
    assert(glChanges >= 10, `expected >=10 RecordChange rows for seeded GL accounts, got ${glChanges}`);
    assert(acpChanges >= 1, `expected >=1 RecordChange row for the ACP, got ${acpChanges}`);
  });

  // ─── W2 — JE numbering ────────────────────────────────────────────────────
  await test('W2 JournalEntry gets EntryNumber JE-{Code}-{FY}-{seq:000000}', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    await acp.Load(acpId);
    const code = acp.CompanyCode;
    const eff = new Date();
    const fy = eff.getUTCFullYear();
    // pick an Open Month period containing the effective date
    const rv = new RunView();
    const periodRes = await rv.RunView<{ ID: string }>(
      { EntityName: PERIOD_ENTITY,
        ExtraFilter: `CompanyID='${acpId}' AND PeriodType='Month' AND Status='Open' AND PeriodStart <= '${eff.toISOString().slice(0, 10)}' AND PeriodEnd >= '${eff.toISOString().slice(0, 10)}'`,
        Fields: ['ID'], MaxRows: 1, ResultType: 'simple' }, user);
    assert(periodRes.Success && periodRes.Results.length === 1, `could not resolve an Open month period: ${periodRes.ErrorMessage ?? 'none'}`);
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord();
    je.Set('CompanyID', acpId);
    je.Set('AccountingPeriodID', periodRes.Results[0].ID);
    je.Set('EffectiveDate', eff);
    je.Set('EntryType', 'Manual');
    je.Set('Status', 'Pending');
    je.Set('Description', `${RUN_TAG} W2 numbering test`);
    const ok = await je.Save();
    assert(ok, `JE Save failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
    const num = je.Get('EntryNumber') as string;
    const re = new RegExp(`^JE-${code}-${fy}-\\d{6}$`);
    assert(re.test(num), `EntryNumber '${num}' does not match ${re}`);
  });

  // ─── W3 — batch numbering ─────────────────────────────────────────────────
  await test('W3 JournalEntryBatch gets BatchNumber BATCH-{Code}-{seq:000000}', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    await acp.Load(acpId);
    const code = acp.CompanyCode;
    const rv = new RunView();
    const periodRes = await rv.RunView<{ ID: string }>(
      { EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${acpId}' AND PeriodType='Month'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' }, user);
    const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, user);
    batch.NewRecord();
    batch.Set('CompanyID', acpId);
    batch.Set('AccountingPeriodID', periodRes.Results[0].ID);
    batch.Set('TargetSystem', 'BusinessCentral');
    batch.Set('BatchedAt', new Date());
    batch.Set('BatchedByUserID', user.ID);
    batch.Set('Status', 'Pending');
    batch.Set('TotalEntries', 0);
    batch.Set('TotalDebits', 0);
    batch.Set('TotalCredits', 0);
    const ok = await batch.Save();
    assert(ok, `Batch Save failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
    const num = batch.Get('BatchNumber') as string;
    const re = new RegExp(`^BATCH-${code}-\\d{6}$`);
    assert(re.test(num), `BatchNumber '${num}' does not match ${re}`);
  });

  // ─── Teardown — best-effort, FK-aware order ───────────────────────────────
  // FK order matters: JE/Batch reference Company; ACP references the 5 GLAccounts (so ACP
  // must go BEFORE GLAccount); GLAccount/Period reference Company; Company (the IS-A parent)
  // goes LAST. ACP + Company are keyed by ID (ACP has no CompanyID column — it IS the company).
  if (acpId) {
    const byCompany = (table: string) =>
      pool.request().input('id', sql.UniqueIdentifier, acpId).query(`DELETE FROM ${table} WHERE CompanyID=@id`);
    const byId = (table: string) =>
      pool.request().input('id', sql.UniqueIdentifier, acpId).query(`DELETE FROM ${table} WHERE ID=@id`);
    const steps: Array<() => Promise<unknown>> = [
      () => byCompany(BATCH_TABLE),
      () => byCompany(JE_TABLE),
      () => byId(ACP_TABLE),
      () => byCompany(GL_TABLE),
      () => byCompany(PERIOD_TABLE),
      () => byCompany(JESEQ_TABLE),
      () => byCompany(BATCHSEQ_TABLE),
      () => byId(COMPANY_TABLE),
    ];
    for (const step of steps) {
      try { await step(); } catch (e) { console.log(`      teardown warn: ${e instanceof Error ? e.message : String(e)}`); }
    }
  }

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 0 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
