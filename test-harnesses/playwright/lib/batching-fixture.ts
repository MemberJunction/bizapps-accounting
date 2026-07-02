/**
 * batching-fixture.ts — server-side fixture for the PRIORITY-2 GUI behavior test.
 *
 * The seeded demo companies only carry ALREADY-dispatched (Acknowledged) batches, and no CFO is
 * configured — so there is nothing for the GUI to approve/dispatch. This script provisions a
 * dedicated, tagged throwaway company that is READY for the GUI to drive the full
 * Build → Approve → Dispatch flow, then prints a JSON descriptor on stdout.
 *
 *   setup  → create a tagged Company + AccountingCompanyProfile (W1 auto-seeds COA + periods),
 *            map its GL accounts to BusinessCentral, create a CFO Person, set
 *            AccountingCompanyProfile.ApprovalCFOPersonID to that Person, and create ONE balanced
 *            Pending JE in an open Month period (so a batch can be built + has the CFO approval gate).
 *            Prints: { companyId, companyName, periodLabel, cfoPersonId }
 *   teardown <companyId> [cfoPersonId] → FK-aware cleanup (disables triggers to drop locked rows),
 *            mirroring block2-runtime.ts teardown.
 *
 * Run from the INSTANCE WORKTREE ROOT (so .env resolves), exactly like the server harnesses:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-fixture.ts setup
 *   npx tsx .../batching-fixture.ts teardown <companyId> <cfoPersonId>
 *
 * Exit: 0 ok · 2 error. NEVER closes the pool with `await` before exit (harness-notes #1) — uses
 * finishAndExit.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
// These shared server-harness helpers live two dirs up. Because the playwright/ folder has its own
// `"type":"module"` package.json while the server/ folder does not, tsx interprets the server .ts
// files as CJS and nests their ESM named exports under `default`. Import the namespace and unwrap
// both shapes so the fixture is robust regardless of how tsx resolves them.
import * as harnessExitNS from '../../server/harness-exit.js';
import * as triggerPreflightNS from '../../server/trigger-preflight.js';

type FinishAndExit = (summary: string, code: number, ...pools: Array<sql.ConnectionPool | undefined>) => never;
type AssertTriggers = (pool: sql.ConnectionPool, schema?: string) => Promise<void>;

const finishAndExit: FinishAndExit =
  (harnessExitNS as { finishAndExit?: FinishAndExit }).finishAndExit ??
  (harnessExitNS as { default?: { finishAndExit: FinishAndExit } }).default!.finishAndExit;
const assertInvariantTriggers: AssertTriggers =
  (triggerPreflightNS as { assertInvariantTriggers?: AssertTriggers }).assertInvariantTriggers ??
  (triggerPreflightNS as { default?: { assertInvariantTriggers: AssertTriggers } }).default!.assertInvariantTriggers;

const SCHEMA = '__mj_BizAppsAccounting';
const TASK_SCHEMA = '__mj_BizAppsTasks';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';

/** Distinctive, GUI-greppable tag so the spec can find the company in the selector. */
const RUN_TAG = `PWBATCH-${Date.now().toString(36).toUpperCase()}`;

interface Pools { pool: sql.ConnectionPool; teardownPool: sql.ConnectionPool; user: UserInfo }

async function connect(): Promise<Pools> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env — run from the instance worktree root.');
  const port = Number(process.env.DB_PORT ?? 1433);
  const opt = { encrypt: false, trustServerCertificate: true };
  const pool = await new sql.ConnectionPool({ server: host, port, user, password, database, options: opt }).connect();
  const { CODEGEN_DB_USERNAME: cgUser, CODEGEN_DB_PASSWORD: cgPassword } = process.env;
  if (!cgUser || !cgPassword) throw new Error('Missing CODEGEN_DB_USERNAME/PASSWORD in .env (needed for FK-aware teardown).');
  const teardownPool = await new sql.ConnectionPool({ server: host, port, user: cgUser, password: cgPassword, database, options: opt }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await assertInvariantTriggers(pool);
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  return { pool, teardownPool, user: ctxUser };
}

async function setup(p: Pools): Promise<void> {
  const { pool, user } = p;
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, user);
  const currencyCode = cur.Results?.[0]?.Code;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success} err=${cur.ErrorMessage})`);

  // Company + ACP (the ACP Save triggers W1 → seeds the 10-account COA + 17 periods).
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} GUI Batch Co`;
  acp.Description = `${RUN_TAG} playwright batching fixture`;
  acp.CompanyCode = `PW${Date.now().toString(36).slice(-7)}`.toUpperCase();
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  // Map every GL account to a BusinessCentral external account = its Code (so buildBatch can resolve).
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`);

  // Resolve the AR + Revenue accounts for a balanced JE, and an open Month period.
  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((glRes.Results ?? []).map((r) => [r.Code, r.ID]));
  const arGL = byCode.get('11201');
  const revGL = byCode.get('40100');
  if (!arGL || !revGL) throw new Error(`could not resolve seeded GL accounts (AR 11201 / Rev 40100) for ${companyId}`);

  const periodRes = await rv.RunView<{ ID: string; PeriodType: string; FiscalYear: number }>(
    { EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`, OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, user,
  );
  const period = periodRes.Results?.[0];
  if (!period) throw new Error(`no open Month period seeded for ${companyId}`);
  const periodLabel = `${period.PeriodType} · FY${period.FiscalYear}`;

  const cashGL = byCode.get('11101');
  if (!cashGL) throw new Error(`could not resolve seeded Cash GL account (11101) for ${companyId}`);

  // THREE balanced Pending JEs that NET WITH CANCELING on AR, so the build must consolidate 6 lines
  // → 3 summary lines and report the NETTED totals (600), NOT the gross (800):
  //   JE1 charge:  Dr AR 500 / Cr Rev 500
  //   JE2 payment: Dr Cash 200 / Cr AR 200   ← the AR CREDIT that cancels part of AR's debit
  //   JE3 charge:  Dr AR 100 / Cr Rev 100
  // Netted: AR = 500 − 200 + 100 = 400 (Dr) · Cash = 200 (Dr) · Rev = 600 (Cr) → debits 600 = credits 600.
  const jeSpecs: { lines: { gl: string; debit?: number; credit?: number }[] }[] = [
    { lines: [{ gl: arGL, debit: 500 }, { gl: revGL, credit: 500 }] },
    { lines: [{ gl: cashGL, debit: 200 }, { gl: arGL, credit: 200 }] },
    { lines: [{ gl: arGL, debit: 100 }, { gl: revGL, credit: 100 }] },
  ];
  let firstJeId = '';
  for (let i = 0; i < jeSpecs.length; i++) {
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord();
    je.CompanyID = companyId; je.AccountingPeriodID = period.ID; je.EffectiveDate = new Date();
    je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `${RUN_TAG} pending JE ${i + 1} for GUI batching`;
    if (!(await je.Save())) throw new Error(`JE ${i + 1} save failed: ${je.LatestResult?.CompleteMessage}`);
    if (i === 0) firstJeId = je.ID;
    let ln = 0;
    for (const ls of jeSpecs[i].lines) {
      ln += 1;
      const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
      l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = ln; l.GLAccountID = ls.gl;
      l.DebitAmount = ls.debit ?? null; l.CreditAmount = ls.credit ?? null;
      if (!(await l.Save())) throw new Error(`JE ${i + 1} line ${ln} save failed: ${l.LatestResult?.CompleteMessage}`);
    }
  }
  // Expected NETTED batch (canceling proven: AR 500−200+100=400 Dr; Cash 200 Dr; Rev 600 Cr → 3 summary
  // lines; netted debits 600, NOT the gross 800). The API harness asserts these EXACT values.
  const expected = { jeCount: 3, summaryLineCount: 3, totalDebits: 600, totalCredits: 600, grossDebits: 800 };

  // CFO Person + set it on the company profile (the gate hard-fails the build without it).
  const person = await md.GetEntityObject<mjBizAppsCommonPersonEntity>(PERSON_ENTITY, user);
  person.NewRecord();
  person.FirstName = 'CFO'; person.LastName = `${RUN_TAG}`; person.Status = 'Active';
  if (!(await person.Save())) throw new Error(`CFO Person save failed: ${person.LatestResult?.CompleteMessage}`);
  const cfoPersonId = person.ID;

  const acp2 = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  if (!(await acp2.Load(companyId))) throw new Error(`could not reload ACP ${companyId}`);
  acp2.ApprovalCFOPersonID = cfoPersonId;
  if (!(await acp2.Save())) throw new Error(`set CFO failed: ${acp2.LatestResult?.CompleteMessage}`);

  // Machine-readable descriptor on the LAST stdout line for the spec to parse.
  // periodId is REQUIRED for the spec to pick the right dropdown <option> — all 12 Month periods
  // share the label "Month · FY<year>", so the JE's period can only be disambiguated by its ID.
  console.log(`FIXTURE_JSON ${JSON.stringify({ companyId, companyName: `${RUN_TAG} GUI Batch Co`, runTag: RUN_TAG, periodLabel, periodId: period.ID, cfoPersonId, jeId: firstJeId, expected })}`);
}

async function teardown(p: Pools, companyId: string, cfoPersonId?: string): Promise<void> {
  const exec = async (q: string) => { try { await p.teardownPool.request().query(q); } catch (e) { console.log(`  teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };

  // Tasks raised by the gate (FK order: decisions/activity/assignments/links → task).
  try {
    const r = await p.teardownPool.request().query(
      `SELECT t.ID id FROM ${TASK_SCHEMA}.TaskLink l JOIN ${TASK_SCHEMA}.Task t ON t.ID=l.TaskID JOIN __mj.Entity e ON e.ID=l.EntityID WHERE e.Name='MJ_BizApps_Accounting: Journal Entry Batches' AND l.RecordID IN (SELECT ID FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}')`);
    const taskIds = r.recordset.map((x: { id: string }) => `'${x.id}'`).join(',');
    if (taskIds) {
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskDecision WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskActivity WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskAssignment WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskLink WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.Task WHERE ID IN (${taskIds})`);
    }
  } catch (e) { console.log(`  teardown warn (tasks): ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }

  // Locked accounting rows need triggers disabled. Always re-enable in finally (harness-notes #3).
  const toggled = ['JournalEntryBatchLineItem', 'JournalEntryLine', 'JournalEntry', 'JournalEntryBatch'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineDimension WHERE JournalEntryBatchLineItemID IN (SELECT ID FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}')`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}'`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (SELECT ID FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}')`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${companyId}'`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID='${companyId}'`);
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }

  await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchSequence WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingPeriod WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);
  if (cfoPersonId) await exec(`DELETE FROM __mj_BizAppsCommon.Person WHERE ID='${cfoPersonId}'`);
  console.log(`  teardown complete for company ${companyId}`);
}

async function main(): Promise<void> {
  const [, , cmd, arg1, arg2] = process.argv;
  let pools: Pools;
  try { pools = await connect(); } catch (e) { console.error('FIXTURE BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  try {
    if (cmd === 'setup') await setup(pools);
    else if (cmd === 'teardown') {
      if (!arg1) throw new Error('teardown requires <companyId> [cfoPersonId]');
      await teardown(pools, arg1, arg2);
    } else throw new Error(`unknown command '${cmd}'. Use: setup | teardown <companyId> [cfoPersonId]`);
  } catch (e) {
    console.error('FIXTURE ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e));
    finishAndExit('fixture failed', 2, pools.pool, pools.teardownPool);
    return;
  }
  finishAndExit('fixture ok', 0, pools.pool, pools.teardownPool);
}

void main();
