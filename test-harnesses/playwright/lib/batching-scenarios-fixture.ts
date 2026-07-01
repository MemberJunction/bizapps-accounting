/**
 * batching-scenarios-fixture.ts — MULTI-COMPANY fixture for the Tier-3 batching SCENARIOS harness.
 *
 * Fills coverage-matrix gaps the single-company fixture can't reach:
 *   CoA (CFO):  a normal JE + an INTERCOMPANY due-from JE (EntryType 'IntercompanyFlow' +
 *               IntercompanyFlowID + CounterpartyOrganizationID) → 2 JEs.
 *   CoB (CFO):  a normal JE → 1 JE (used for multi-company independence + the reject path).
 *   CoC (NO CFO configured): a normal JE → 1 JE (used for the no-CFO hard-fail).
 *
 * Prints SCENARIOS_JSON {…} on the last stdout line. Teardown removes all 3 companies (by CompanyID,
 * FK-aware, triggers toggled) + the counterparty Organization + the CFO Persons.
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/playwright/lib/batching-scenarios-fixture.ts setup
 *   npx tsx .../batching-scenarios-fixture.ts teardown '<SCENARIOS_JSON>'
 * Exit: 0 ok · 2 error. NEVER awaits pool.close (uses finishAndExit).
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
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonPersonEntity, mjBizAppsCommonOrganizationEntity } from '@mj-biz-apps/common-entities';
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
const ORG_ENTITY = 'MJ_BizApps_Common: Organizations';

const RUN_TAG = `PWSCEN-${randomUUID().slice(0, 8).toUpperCase()}`;

interface Pools { pool: sql.ConnectionPool; teardownPool: sql.ConnectionPool; user: UserInfo }
interface LineSpec { glCode: string; debit?: number; credit?: number; counterparty?: string }
interface JESpec { entryType: string; intercompanyFlowId?: string; lines: LineSpec[] }
interface CompanyResult { companyId: string; periodId: string; cfoPersonId: string | null; jeCount: number }

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

async function resolveCurrency(user: UserInfo): Promise<string> {
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, user);
  const code = cur.Results?.[0]?.Code;
  if (!code) throw new Error(`no currency resolved (success=${cur.Success})`);
  return code;
}

async function ensureCounterpartyOrg(user: UserInfo): Promise<string> {
  const md = new Metadata();
  const org = await md.GetEntityObject<mjBizAppsCommonOrganizationEntity>(ORG_ENTITY, user);
  org.NewRecord();
  org.Name = `${RUN_TAG} Counterparty Org`;
  org.Status = 'Active';
  if (!(await org.Save())) throw new Error(`counterparty org save failed: ${org.LatestResult?.CompleteMessage}`);
  return org.ID;
}

/** Provision a company (ACP → W1 seeds COA + periods), map GL→BC, create the JEs, optionally a CFO. */
async function provisionCompany(p: Pools, suffix: string, currency: string, withCFO: boolean, jeSpecs: JESpec[]): Promise<CompanyResult> {
  const { pool, user } = p;
  const md = new Metadata();
  const rv = new RunView();

  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} Co${suffix}`;
  acp.Description = `${RUN_TAG} scenarios fixture company ${suffix}`;
  acp.CompanyCode = `PWS${suffix}${randomUUID().slice(0, 4)}`.toUpperCase();
  acp.FunctionalCurrencyCode = currency;
  acp.EntityType = 'Subsidiary';
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP ${suffix} save failed: ${acp.LatestResult?.CompleteMessage}`);

  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`);

  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((glRes.Results ?? []).map((r) => [r.Code, r.ID]));

  const periodRes = await rv.RunView<{ ID: string }>(
    { EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`, OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, user,
  );
  const periodId = periodRes.Results?.[0]?.ID;
  if (!periodId) throw new Error(`no open Month period for Co${suffix}`);

  for (let i = 0; i < jeSpecs.length; i++) {
    const spec = jeSpecs[i];
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord();
    je.CompanyID = companyId; je.AccountingPeriodID = periodId; je.EffectiveDate = new Date();
    je.EntryType = spec.entryType as mjBizAppsAccountingJournalEntryEntity['EntryType'];
    je.Status = 'Pending'; je.Description = `${RUN_TAG} Co${suffix} JE ${i + 1}`;
    if (spec.intercompanyFlowId) je.IntercompanyFlowID = spec.intercompanyFlowId;
    if (!(await je.Save())) throw new Error(`Co${suffix} JE ${i + 1} save failed: ${je.LatestResult?.CompleteMessage}`);
    let ln = 0;
    for (const ls of spec.lines) {
      ln += 1;
      const glId = byCode.get(ls.glCode);
      if (!glId) throw new Error(`Co${suffix}: GL code ${ls.glCode} not found`);
      const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
      l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = ln; l.GLAccountID = glId;
      l.DebitAmount = ls.debit ?? null; l.CreditAmount = ls.credit ?? null;
      if (ls.counterparty) l.CounterpartyOrganizationID = ls.counterparty;
      if (!(await l.Save())) throw new Error(`Co${suffix} JE ${i + 1} line ${ln} save failed: ${l.LatestResult?.CompleteMessage}`);
    }
  }

  let cfoPersonId: string | null = null;
  if (withCFO) {
    const person = await md.GetEntityObject<mjBizAppsCommonPersonEntity>(PERSON_ENTITY, user);
    person.NewRecord();
    person.FirstName = 'CFO'; person.LastName = `${RUN_TAG}-${suffix}`; person.Status = 'Active';
    if (!(await person.Save())) throw new Error(`Co${suffix} CFO save failed: ${person.LatestResult?.CompleteMessage}`);
    cfoPersonId = person.ID;
    const acp2 = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
    if (!(await acp2.Load(companyId))) throw new Error(`reload ACP ${suffix} failed`);
    acp2.ApprovalCFOPersonID = cfoPersonId;
    if (!(await acp2.Save())) throw new Error(`Co${suffix} set CFO failed: ${acp2.LatestResult?.CompleteMessage}`);
  }

  return { companyId, periodId, cfoPersonId, jeCount: jeSpecs.length };
}

async function setup(p: Pools): Promise<void> {
  const currency = await resolveCurrency(p.user);
  const counterpartyId = await ensureCounterpartyOrg(p.user);
  const flowId = randomUUID();

  // CoA: a normal charge + an intercompany due-from leg (tagged with the flow + counterparty).
  const coA = await provisionCompany(p, 'A', currency, true, [
    { entryType: 'Manual', lines: [{ glCode: '11201', debit: 500 }, { glCode: '40100', credit: 500 }] },
    { entryType: 'IntercompanyFlow', intercompanyFlowId: flowId, lines: [{ glCode: '11201', debit: 300, counterparty: counterpartyId }, { glCode: '40100', credit: 300 }] },
  ]);
  // CoB: one normal JE (independence + reject scenarios).
  const coB = await provisionCompany(p, 'B', currency, true, [
    { entryType: 'Manual', lines: [{ glCode: '11201', debit: 200 }, { glCode: '40100', credit: 200 }] },
  ]);
  // CoC: one normal JE but NO CFO configured (no-CFO hard-fail).
  const coC = await provisionCompany(p, 'C', currency, false, [
    { entryType: 'Manual', lines: [{ glCode: '11201', debit: 100 }, { glCode: '40100', credit: 100 }] },
  ]);

  console.log(`SCENARIOS_JSON ${JSON.stringify({ runTag: RUN_TAG, counterpartyId, flowId, coA, coB, coC })}`);
}

async function teardownCompany(p: Pools, companyId: string, cfoPersonId: string | null): Promise<void> {
  const exec = async (q: string) => { try { await p.teardownPool.request().query(q); } catch (e) { console.log(`  teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
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
}

async function teardown(p: Pools, json: string): Promise<void> {
  const d = JSON.parse(json) as { counterpartyId: string; coA: CompanyResult; coB: CompanyResult; coC: CompanyResult };
  for (const co of [d.coA, d.coB, d.coC]) await teardownCompany(p, co.companyId, co.cfoPersonId);
  try { await p.teardownPool.request().query(`DELETE FROM __mj_BizAppsCommon.Organization WHERE ID='${d.counterpartyId}'`); } catch (e) { console.log(`  teardown warn (org): ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
  console.log('  scenarios teardown complete');
}

async function main(): Promise<void> {
  const [, , cmd, arg1] = process.argv;
  let pools: Pools;
  try { pools = await connect(); } catch (e) { console.error('FIXTURE BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  try {
    if (cmd === 'setup') await setup(pools);
    else if (cmd === 'teardown') { if (!arg1) throw new Error('teardown requires the SCENARIOS_JSON arg'); await teardown(pools, arg1); }
    else throw new Error(`unknown command '${cmd}'. Use: setup | teardown '<json>'`);
  } catch (e) {
    console.error('FIXTURE ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e));
    finishAndExit('scenarios fixture failed', 2, pools.pool, pools.teardownPool);
    return;
  }
  finishAndExit('scenarios fixture ok', 0, pools.pool, pools.teardownPool);
}
void main();
