/**
 * seed-demo.ts — runner for the deterministic, idempotent Association demo seed (Block 4).
 *
 * Connects to the live instance DB through the REAL MJ provider + server subclasses (MJAPI's path),
 * calls `seedAssociationDemo(contextUser)` (which creates multi-company AR / deferred-revenue /
 * sales-tax / intercompany data keyed off static UUIDs), prints what it created vs. reused, then
 * VERIFIES the Block-6 read-model views populate (asserting each returns >= 1 row) and exits.
 *
 * UNLIKE the block*-runtime harnesses, this runner does NOT tear down — the demo data PERSISTS by
 * design (it's the fixture set for the Explorer GUI + the upcoming Playwright tier). It is safe to
 * re-run: `seedAssociationDemo` is idempotent (static-UUID guards), so a second run reports the same
 * view counts and creates nothing new.
 *
 * USAGE (cwd = instance worktree root):
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/seed-demo.ts
 * Exit: 0 seeded + all views populated · 1 a view returned 0 rows · 2 bootstrap/seed error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import { finishAndExit } from './harness-exit.js';
import { assertInvariantTriggers } from './trigger-preflight.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { seedAssociationDemo, DemoSeedReport } from './AssociationDemoSeedData.js';

const SCHEMA = '__mj_BizAppsAccounting';

interface Outcome { Name: string; Passed: boolean; Rows: number; Error?: string }
const outcomes: Outcome[] = [];

interface BootCtx { pool: sql.ConnectionPool; user: UserInfo }

async function bootstrap(): Promise<BootCtx> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env (run from the instance worktree root).');
  const pool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await assertInvariantTriggers(pool); // fail fast if any invariant trigger is missing/disabled
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  return { pool, user: ctxUser };
}

function printSeedReport(report: DemoSeedReport): void {
  console.log('\n── Seed report ───────────────────────────────────────────');
  for (const c of report.Companies) console.log(`  company  ${c.Created ? 'CREATED' : 'reused '}  ${c.ID}  ${c.Name}`);
  for (const c of report.Customers) console.log(`  customer ${c.Created ? 'CREATED' : 'reused '}  ${c.ID}  ${c.Name}`);
  for (const t of report.TaxRows) console.log(`  tax row  ${t.Created ? 'CREATED' : 'reused '}  ${t.ID}`);
  console.log(`  JEs created: ${report.JournalEntriesCreated} · skipped (already present): ${report.JournalEntriesSkipped} · batches posted: ${report.BatchesPosted}`);
  for (const n of report.Notes) console.log(`  note: ${n}`);
  console.log('──────────────────────────────────────────────────────────\n');
}

/** Run one view-verification: query the view, require >= 1 row, log a tiny sample. */
async function verifyView(pool: sql.ConnectionPool, name: string, sampleSql: string): Promise<void> {
  try {
    const rs = (await pool.request().query(sampleSql)).recordset;
    const rows = rs.length;
    const passed = rows >= 1;
    outcomes.push({ Name: name, Passed: passed, Rows: rows });
    const sample = rows > 0 ? `  e.g. ${JSON.stringify(rs[0])}` : '';
    console.log(`  ${passed ? '✓' : '✗'} ${name} — ${rows} row(s)${sample}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    outcomes.push({ Name: name, Passed: false, Rows: 0, Error: msg });
    console.log(`  ✗ ${name} — query failed: ${msg.split('\n')[0]}`);
  }
}

const CO1 = 'a55c0de1-0001-4000-8000-000000000001';
const IC_FLOW = 'a55c0de1-1c00-4000-8000-000000000001';

async function verifyViews(pool: sql.ConnectionPool): Promise<void> {
  // The Block-6 `vw_*` read-model views were RETIRED in the rebuild (reports are deferred and get
  // rebuilt as-needed on RunQuery — 2026-07-28 rulings), so verification now asserts the seeded
  // BASE data directly: companies, their COAs, pending JEs, balanced lines, and the IC flow.
  console.log('── Seeded-data verification (each must return >= 1 row) ──');
  await verifyView(pool, 'company profiles (CO1..)',
    `SELECT acp.ID, acp.CompanyCode FROM ${SCHEMA}.AccountingCompanyProfile acp WHERE acp.ID='${CO1}'`);
  await verifyView(pool, 'CO1 chart of accounts',
    `SELECT Code, Name FROM ${SCHEMA}.GLAccount WHERE CompanyID='${CO1}' ORDER BY Code`);
  await verifyView(pool, 'CO1 journal entries',
    `SELECT EntryNumber, Status FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${CO1}'`);
  await verifyView(pool, 'CO1 balanced JE lines (netted to zero per JE)',
    `SELECT je.ID, SUM(l.DebitAmount) AS D, SUM(l.CreditAmount) AS C FROM ${SCHEMA}.JournalEntry je JOIN ${SCHEMA}.JournalEntryLine l ON l.JournalEntryID=je.ID WHERE je.CompanyID='${CO1}' GROUP BY je.ID HAVING SUM(l.DebitAmount) = SUM(l.CreditAmount)`);
  await verifyView(pool, 'dimensions + values',
    `SELECT d.Name, (SELECT COUNT(*) FROM ${SCHEMA}.DimensionValue v WHERE v.DimensionID=d.ID) AS Vals FROM ${SCHEMA}.Dimension d`);
  // There is no IntercompanyFlow table — the flow is a Description tag shared by the two IC legs
  // (the former JE.IntercompanyFlowID column was dropped with D25).
  await verifyView(pool, 'intercompany legs (2 JEs tagged with the flow id)',
    `SELECT EntryNumber, Status FROM ${SCHEMA}.JournalEntry WHERE Description LIKE '%${IC_FLOW}%'`);
  console.log('──────────────────────────────────────────────────────────');
}

async function main(): Promise<void> {
  let ctx: BootCtx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user } = ctx;
  console.log(`\n══════ Association demo seed — user=${user.Email} ══════`);

  let report: DemoSeedReport;
  try {
    report = await seedAssociationDemo(user, Metadata.Provider);
  } catch (e) {
    console.error('SEED ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e));
    finishAndExit('\n────── Association demo seed: FAILED during seeding ──────', 2, pool);
  }
  printSeedReport(report);

  await verifyViews(pool);
  // (The old vw_AROpenByCustomer settled-customer sanity check is gone with the retired views —
  // and its premise too: per-customer AR relied on line counterparty tagging, whose column was
  // removed 2026-07-29. Customer Organizations remain purely as demo entities.)

  const failed = outcomes.filter(o => !o.Passed);
  const summary = `\n────── Association demo seed: ${outcomes.length - failed.length}/${outcomes.length} checks populated ──────`;
  if (failed.length > 0) console.log(`  FAILED views: ${failed.map(f => `${f.Name} (${f.Rows} rows${f.Error ? ', ' + f.Error.split('\n')[0] : ''})`).join(', ')}`);
  // NEVER `await pool.close()` — non-blocking close + force-exit (the MJ provider pool can hang on close).
  finishAndExit(summary, failed.length > 0 ? 1 : 0, pool);
}

void main();
