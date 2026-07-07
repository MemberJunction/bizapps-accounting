/**
 * block0-runtime.ts — live server-side validation of the Block-0 foundation hooks.
 *
 * Validates W1/W2/W3 against a REAL SQL Server instance DB, through the REAL data
 * provider, using the REAL bizapps-accounting server entity subclasses — i.e. the exact
 * code path MJAPI runs. This is the reliable integration harness (kept in-repo); the
 * Vitest suite in packages/CoreEntitiesServer is pure-logic only (no DB).
 *
 * 2026-07-06 rework (engine-meeting rulings): AccountingPeriod is GONE (the ERP owns
 * periods — CH-1), and JE/batch numbering is GLOBAL, not company-scoped (D-SEQ):
 *
 *   R1  GLAccountRole reference data: exactly the 8 seeded roles, in sequence order
 *        (proves the migrations-only deploy carried the metadata-sync seed).
 *   W1  AccountingCompanyProfile first-save seeding (AccountingCompanyProfileEntityServer):
 *        1. create + Save() succeeds
 *        2. seeds EXACTLY the 10 minimal GL accounts (IsSystemSeeded), codes as expected
 *        3. wires the 5 default GL-account refs to the right account codes
 *        4. defaults OperatingTimeZone = 'UTC' (Block-0 addition)
 *        5. __mj.RecordChange rows exist for the seeded rows (audit-by-construction)
 *        (Period generation was RETIRED — no AccountingPeriod rows exist to assert.)
 *   W2  JournalEntry numbering (JournalEntryEntityServer): EntryNumber = JE-{FY}-{seq:000000}
 *        (GLOBAL per-fiscal-year sequence; two saves in one FY are strictly increasing)
 *   W3  JournalEntryBatch numbering (JournalEntryBatchEntityServer): BatchNumber = BATCH-{seq:000000}
 *        (GLOBAL singleton sequence; two saves are strictly increasing)
 *
 * Everything created is torn down in a finally block (raw SQL — JEs/batches by tracked ID,
 * company-scoped rows by CompanyID) so the run is idempotent and leaves the DB clean.
 * The global sequence tables (JournalEntrySequence / JournalEntryBatchSequence) are shared
 * state and are intentionally NOT touched by teardown. Verification uses raw mssql queries
 * so a wrong count is caught even if the entity layer reports success.
 *
 * USAGE (cwd MUST be the instance worktree root so .env resolves, e.g.
 *   ~/MJDev/instances/accounting-engine-dev/mj):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/block0-runtime.ts
 *
 * Exit code: 0 = all passed, 1 = test failures, 2 = bootstrap error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { assertInvariantTriggers } from './trigger-preflight.js';
import { finishAndExit } from './harness-exit.js';
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
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const ROLE_ENTITY = 'MJ_BizApps_Accounting: GL Account Roles';

const SCHEMA = '__mj_BizAppsAccounting';
const ACP_TABLE = `${SCHEMA}.AccountingCompanyProfile`;
const COMPANY_TABLE = '__mj.Company';
const GL_TABLE = `${SCHEMA}.GLAccount`;
const JE_TABLE = `${SCHEMA}.JournalEntry`;
const BATCH_TABLE = `${SCHEMA}.JournalEntryBatch`;

const EXPECTED_CODES = ['11101', '11201', '21201', '21301', '21401', '21402', '40100', '40200', '50400', '50500'];
const EXPECTED_ROLES: ReadonlyArray<{ sequence: number; name: string }> = [
  { sequence: 10, name: 'Cash' },
  { sequence: 20, name: 'Accounts Receivable' },
  { sequence: 30, name: 'Inventory' },
  { sequence: 40, name: 'Cost of Goods Sold' },
  { sequence: 50, name: 'Sales' },
  { sequence: 60, name: 'Sales Discounts' },
  { sequence: 70, name: 'Sales Returns and Allowances' },
  { sequence: 80, name: 'Deferred Revenue' },
];

const RUN_TAG = `BLOCK0-${Date.now()}`;
function companyCode(): string {
  return `B0${Date.now().toString(36).slice(-7)}`.toUpperCase(); // ~9 chars, fits nvarchar(20), unique
}

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

/** Extract the numeric tail of a JE-{FY}-{seq} / BATCH-{seq} number for monotonicity checks. */
function sequencePart(num: string): number {
  const tail = num.split('-').pop() ?? '';
  return Number.parseInt(tail, 10);
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
  // __mj_BizAppsAccounting entity on this instance, so NO permission grant is needed here.
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, schema));
  await assertInvariantTriggers(pool); // pre-flight: fail fast if any invariant trigger is missing/disabled
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
  const createdJEIds: string[] = [];
  const createdBatchIds: string[] = [];

  // ─── R1 — GL account role reference data (metadata-sync seed) ─────────────
  await test('R1 GLAccountRole reference data — exactly the 8 seeded roles, in sequence', async () => {
    const rv = new RunView();
    const res = await rv.RunView<{ Name: string; Sequence: number; Status: string }>(
      { EntityName: ROLE_ENTITY, Fields: ['Name', 'Sequence', 'Status'], OrderBy: 'Sequence ASC', ResultType: 'simple' }, user);
    assert(res.Success, `Role RunView failed: ${res.ErrorMessage}`);
    const rows = res.Results ?? [];
    assert(rows.length === EXPECTED_ROLES.length, `expected ${EXPECTED_ROLES.length} roles, got ${rows.length}`);
    for (let i = 0; i < EXPECTED_ROLES.length; i++) {
      assert(rows[i].Name === EXPECTED_ROLES[i].name && rows[i].Sequence === EXPECTED_ROLES[i].sequence,
        `role[${i}] expected ${EXPECTED_ROLES[i].sequence}/${EXPECTED_ROLES[i].name}, got ${rows[i].Sequence}/${rows[i].Name}`);
      assert(rows[i].Status === 'Active', `role ${rows[i].Name} expected Status Active, got ${rows[i].Status}`);
    }
  });

  // ─── W1 — profile init seeding ────────────────────────────────────────────
  await test('W1.1 create AccountingCompanyProfile — Save() succeeds', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    acp.NewRecord();
    acp.Name = `${RUN_TAG} Co`;
    acp.Description = 'Block 0 runtime test';
    acp.CompanyCode = companyCode();
    acp.FunctionalCurrencyCode = currencyCode;
    acp.EntityType = 'Subsidiary';
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

  await test('W1.3 wires the 5 default GL-account refs to the right account codes', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    await acp.Load(acpId);
    const rv = new RunView();
    const glRes = await rv.RunView<{ ID: string; Code: string }>(
      { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${acpId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
    const idToCode = new Map((glRes.Results ?? []).map(r => [r.ID.toLowerCase(), r.Code]));
    const codeOf = (refId: string | null): string | undefined =>
      refId ? idToCode.get(refId.toLowerCase()) : undefined;
    // Typed reads (rule 2b) — one line per wired ref.
    assert(codeOf(acp.AROpenGLAccountID) === '11201', `AROpenGLAccountID -> ${codeOf(acp.AROpenGLAccountID) ?? 'null'} (expected 11201)`);
    assert(codeOf(acp.DeferredRevenueGLAccountID) === '21301', `DeferredRevenueGLAccountID -> ${codeOf(acp.DeferredRevenueGLAccountID) ?? 'null'} (expected 21301)`);
    assert(codeOf(acp.SalesTaxPayableGLAccountID) === '21201', `SalesTaxPayableGLAccountID -> ${codeOf(acp.SalesTaxPayableGLAccountID) ?? 'null'} (expected 21201)`);
    assert(codeOf(acp.RealizedFXGainLossGLAccountID) === '50400', `RealizedFXGainLossGLAccountID -> ${codeOf(acp.RealizedFXGainLossGLAccountID) ?? 'null'} (expected 50400)`);
    assert(codeOf(acp.UnrealizedFXGainLossGLAccountID) === '50500', `UnrealizedFXGainLossGLAccountID -> ${codeOf(acp.UnrealizedFXGainLossGLAccountID) ?? 'null'} (expected 50500)`);
  });

  await test('W1.4 defaults OperatingTimeZone = UTC (Block-0 addition)', async () => {
    const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    await acp.Load(acpId);
    assert(acp.OperatingTimeZone === 'UTC', `OperatingTimeZone expected 'UTC', got '${acp.OperatingTimeZone}'`);
  });

  await test('W1.5 __mj.RecordChange rows exist for seeded rows (audit-by-construction)', async () => {
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

  // ─── W2 — JE numbering (GLOBAL per fiscal year — D-SEQ) ───────────────────
  const makeJE = async (label: string): Promise<mjBizAppsAccountingJournalEntryEntity> => {
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord();
    je.EffectiveDate = new Date();
    je.EntryType = 'Manual';
    je.Status = 'Pending';
    je.Description = `${RUN_TAG} ${label}`;
    const ok = await je.Save();
    assert(ok, `JE Save failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
    createdJEIds.push(je.ID);
    return je;
  };

  let firstEntrySeq = 0;
  await test('W2.1 JournalEntry gets EntryNumber JE-{FY}-{seq:000000} (global — no company segment)', async () => {
    const fy = new Date().getUTCFullYear();
    const je = await makeJE('W2.1 numbering test');
    const num = je.EntryNumber;
    const re = new RegExp(`^JE-${fy}-\\d{6}$`);
    assert(re.test(num), `EntryNumber '${num}' does not match ${re}`);
    firstEntrySeq = sequencePart(num);
  });

  await test('W2.2 second JE in the same fiscal year gets a strictly higher global sequence', async () => {
    const je = await makeJE('W2.2 numbering test');
    const seq = sequencePart(je.EntryNumber);
    assert(seq > firstEntrySeq, `expected sequence > ${firstEntrySeq}, got ${seq} ('${je.EntryNumber}')`);
  });

  // ─── W3 — batch numbering (GLOBAL singleton sequence — D-SEQ) ─────────────
  const makeBatch = async (): Promise<mjBizAppsAccountingJournalEntryBatchEntity> => {
    const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, user);
    batch.NewRecord();
    batch.TargetSystem = 'BusinessCentral';
    batch.BatchedAt = new Date();
    batch.BatchedByUserID = user.ID;
    batch.Status = 'Pending';
    batch.TotalEntries = 0;
    batch.TotalDebits = 0;
    batch.TotalCredits = 0;
    const ok = await batch.Save();
    assert(ok, `Batch Save failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'}`);
    createdBatchIds.push(batch.ID);
    return batch;
  };

  let firstBatchSeq = 0;
  await test('W3.1 JournalEntryBatch gets BatchNumber BATCH-{seq:000000} (global — no company segment)', async () => {
    const batch = await makeBatch();
    const num = batch.BatchNumber;
    const re = /^BATCH-\d{6}$/;
    assert(re.test(num), `BatchNumber '${num}' does not match ${re}`);
    firstBatchSeq = sequencePart(num);
  });

  await test('W3.2 second batch gets a strictly higher global sequence', async () => {
    const batch = await makeBatch();
    const seq = sequencePart(batch.BatchNumber);
    assert(seq > firstBatchSeq, `expected sequence > ${firstBatchSeq}, got ${seq} ('${batch.BatchNumber}')`);
  });

  // ─── Teardown — best-effort, FK-aware order ───────────────────────────────
  // JEs/batches are GLOBAL now (no CompanyID) → delete by tracked ID. ACP references the
  // 5 GLAccounts (so ACP goes BEFORE GLAccount); GLAccount references Company; Company
  // (the IS-A parent) goes LAST. The global sequence tables are shared state — not touched.
  const byId = (table: string, id: string) =>
    pool.request().input('id', sql.UniqueIdentifier, id).query(`DELETE FROM ${table} WHERE ID=@id`);
  const byCompany = (table: string) =>
    pool.request().input('id', sql.UniqueIdentifier, acpId).query(`DELETE FROM ${table} WHERE CompanyID=@id`);
  const steps: Array<() => Promise<unknown>> = [
    ...createdBatchIds.map(id => () => byId(BATCH_TABLE, id)),
    ...createdJEIds.map(id => () => byId(JE_TABLE, id)),
  ];
  if (acpId) {
    steps.push(
      () => byId(ACP_TABLE, acpId),
      () => byCompany(GL_TABLE),
      () => byId(COMPANY_TABLE, acpId),
    );
  }
  for (const step of steps) {
    try { await step(); } catch (e) { console.log(`      teardown warn: ${e instanceof Error ? e.message : String(e)}`); }
  }

  const failed = outcomes.filter(o => !o.Passed);
  // NEVER `await pool.close()` before exit — the MJ provider pool can hang on close (lingering
  // handles), so the process would print the summary and never exit. Non-blocking close + force-exit.
  finishAndExit(`\n────── Block 0 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`, failed.length > 0 ? 1 : 0, pool);
}

void main();
