/**
 * batching-scenarios-fixture.ts — MULTI-COMPANY fixture for the Tier-3 batching SCENARIOS harness.
 *
 * 2026-07-06 rework (engine-meeting rulings, CH-4): buildJournalEntryBatch is GLOBAL — one build sweeps every
 * Pending JE across all companies into ONE multi-company batch. The old per-company-build
 * "independence" scenario is gone; the harness now proves the global sweep + per-company netting
 * isolation, and the reject / no-CFO scenarios need their JEs seeded in SEPARATE WAVES (each build
 * consumes everything Pending). So the fixture is staged:
 *
 *   setup                  → 3 companies (CoA + CoB with CFOs; CoC with NO CFO) + a counterparty
 *                            Organization. NO JEs yet. Fails fast if stray Pending JEs exist.
 *                            Prints SCENARIOS_JSON {…} on the last stdout line.
 *   seed '<json>' <wave>   → wave1: CoA's normal (500) + intercompany (300, tagged) JEs AND CoB's
 *                                   normal (200) JE — the multi-company sweep + due-to/from scenarios.
 *                            wave2: CoB one JE (150) — the reject path.
 *                            wave3: CoC one JE (100) — the no-CFO hard-fail.
 *   teardown '<json>'      → removes everything (JEs found via the companies' GL accounts,
 *                            batches via their line items' CompanyID; FK-aware, triggers toggled).
 *
 * Run from the INSTANCE WORKTREE ROOT. Exit: 0 ok · 2 error. NEVER awaits pool.close (finishAndExit).
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
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
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const PERSON_ENTITY = 'MJ_BizApps_Common: People';
const ORG_ENTITY = 'MJ_BizApps_Common: Organizations';

const RUN_TAG = `PWSCEN-${randomUUID().slice(0, 8).toUpperCase()}`;

interface Pools { pool: sql.ConnectionPool; teardownPool: sql.ConnectionPool; user: UserInfo }
interface LineSpec { glCode: string; debit?: number; credit?: number; counterparty?: string }
interface JESpec { entryType: mjBizAppsAccountingJournalEntryEntity['EntryType']; intercompanyFlowId?: string; lines: LineSpec[] }
interface CompanyResult { companyId: string; cfoPersonId: string | null }
interface Scenarios { runTag: string; counterpartyId: string; flowId: string; coA: CompanyResult; coB: CompanyResult; coC: CompanyResult }

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

/** Provision a company (ACP → W1 seeds the COA), map GL→BC, optionally a CFO. NO JEs (waves do that). */
async function provisionCompany(p: Pools, suffix: string, currency: string, withCFO: boolean): Promise<CompanyResult> {
  const { pool, user } = p;
  const md = new Metadata();
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
  return { companyId, cfoPersonId };
}

async function makeJEs(p: Pools, companyId: string, label: string, jeSpecs: JESpec[]): Promise<void> {
  const md = new Metadata();
  const rv = new RunView();
  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, p.user);
  const byCode = new Map((glRes.Results ?? []).map((r) => [r.Code, r.ID]));
  for (let i = 0; i < jeSpecs.length; i++) {
    const spec = jeSpecs[i];
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, p.user);
    je.NewRecord();
    je.EffectiveDate = new Date();
    je.EntryType = spec.entryType;
    je.Status = 'Pending'; je.Description = `${RUN_TAG} ${label} JE ${i + 1}`;
    if (spec.intercompanyFlowId) je.IntercompanyFlowID = spec.intercompanyFlowId;
    if (!(await je.Save())) throw new Error(`${label} JE ${i + 1} save failed: ${je.LatestResult?.CompleteMessage}`);
    let ln = 0;
    for (const ls of spec.lines) {
      ln += 1;
      const glId = byCode.get(ls.glCode);
      if (!glId) throw new Error(`${label}: GL code ${ls.glCode} not found`);
      const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, p.user);
      l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = ln; l.GLAccountID = glId;
      l.DebitAmount = ls.debit ?? null; l.CreditAmount = ls.credit ?? null;
      if (ls.counterparty) l.CounterpartyOrganizationID = ls.counterparty;
      if (!(await l.Save())) throw new Error(`${label} JE ${i + 1} line ${ln} save failed: ${l.LatestResult?.CompleteMessage}`);
    }
  }
}

async function setup(p: Pools): Promise<void> {
  const stray = (await p.pool.request().query(`SELECT COUNT(*) n FROM ${SCHEMA}.JournalEntry WHERE Status='Pending'`)).recordset[0].n;
  if (Number(stray) > 0) throw new Error(`${stray} stray Pending JE(s) exist — clean them up first (buildJournalEntryBatch sweeps ALL Pending JEs).`);
  const currency = await resolveCurrency(p.user);
  const counterpartyId = await ensureCounterpartyOrg(p.user);
  const flowId = randomUUID();
  const coA = await provisionCompany(p, 'A', currency, true);
  const coB = await provisionCompany(p, 'B', currency, true);
  const coC = await provisionCompany(p, 'C', currency, false);
  console.log(`SCENARIOS_JSON ${JSON.stringify({ runTag: RUN_TAG, counterpartyId, flowId, coA, coB, coC })}`);
}

async function seed(p: Pools, sc: Scenarios, wave: string): Promise<void> {
  if (wave === 'wave1') {
    // CoA: a normal charge + an intercompany due-from leg (tagged with the flow + counterparty).
    await makeJEs(p, sc.coA.companyId, 'CoA-w1', [
      { entryType: 'Manual', lines: [{ glCode: '11201', debit: 500 }, { glCode: '40100', credit: 500 }] },
      { entryType: 'IntercompanyFlow', intercompanyFlowId: sc.flowId, lines: [{ glCode: '11201', debit: 300, counterparty: sc.counterpartyId }, { glCode: '40100', credit: 300 }] },
    ]);
    await makeJEs(p, sc.coB.companyId, 'CoB-w1', [
      { entryType: 'Manual', lines: [{ glCode: '11201', debit: 200 }, { glCode: '40100', credit: 200 }] },
    ]);
  } else if (wave === 'wave2') {
    await makeJEs(p, sc.coB.companyId, 'CoB-w2', [
      { entryType: 'Manual', lines: [{ glCode: '11201', debit: 150 }, { glCode: '40100', credit: 150 }] },
    ]);
  } else if (wave === 'wave3') {
    await makeJEs(p, sc.coC.companyId, 'CoC-w3', [
      { entryType: 'Manual', lines: [{ glCode: '11201', debit: 100 }, { glCode: '40100', credit: 100 }] },
    ]);
  } else {
    throw new Error(`unknown wave '${wave}'. Use wave1 | wave2 | wave3`);
  }
  console.log(`SEEDED ${wave}`);
}

async function teardownCompany(p: Pools, companyId: string, cfoPersonId: string | null): Promise<void> {
  const exec = async (q: string) => { try { await p.teardownPool.request().query(q); } catch (e) { console.log(`  teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  // Batches this company participated in (multi-company batches are shared — batch rows are only
  // dropped once no line items / JEs reference them, at the end).
  try {
    const r = await p.teardownPool.request().query(
      `SELECT t.ID id FROM ${TASK_SCHEMA}.TaskLink l JOIN ${TASK_SCHEMA}.Task t ON t.ID=l.TaskID JOIN __mj.Entity e ON e.ID=l.EntityID WHERE e.Name='MJ_BizApps_Accounting: Journal Entry Batches' AND l.RecordID IN (SELECT DISTINCT JournalEntryBatchID FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}')`);
    const taskIds = r.recordset.map((x: { id: string }) => `'${x.id}'`).join(',');
    if (taskIds) {
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskDecision WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskActivity WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskAssignment WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.TaskLink WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.Task WHERE ID IN (${taskIds})`);
    }
  } catch (e) { console.log(`  teardown warn (tasks): ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }

  // JEs are GLOBAL — capture this company's JE IDs via its GL accounts BEFORE deleting lines.
  let jeIdList = '';
  try {
    const r = await p.teardownPool.request().query(
      `SELECT DISTINCT l.JournalEntryID id FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.GLAccount gl ON gl.ID=l.GLAccountID WHERE gl.CompanyID='${companyId}'`);
    jeIdList = r.recordset.map((x: { id: string }) => `'${x.id}'`).join(',');
  } catch (e) { console.log(`  teardown warn (je scan): ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }

  const toggled = ['JournalEntryBatchLineDimension', 'JournalEntryBatchLineItem', 'JournalEntryLine', 'JournalEntry', 'JournalEntryBatch'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineDimension WHERE JournalEntryBatchLineItemID IN (SELECT ID FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}')`);
    if (jeIdList) {
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList})`);
    }
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID='${companyId}'`);
    await exec(`DELETE b FROM ${SCHEMA}.JournalEntryBatch b WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.JournalEntryBatchLineItem li WHERE li.JournalEntryBatchID=b.ID) AND NOT EXISTS (SELECT 1 FROM ${SCHEMA}.JournalEntry je WHERE je.JournalEntryBatchID=b.ID)`);
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }
  await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);
  if (cfoPersonId) await exec(`DELETE FROM __mj_BizAppsCommon.Person WHERE ID='${cfoPersonId}'`);
}

async function teardown(p: Pools, json: string): Promise<void> {
  const d = JSON.parse(json) as Scenarios;
  for (const co of [d.coA, d.coB, d.coC]) await teardownCompany(p, co.companyId, co.cfoPersonId);
  try { await p.teardownPool.request().query(`DELETE FROM __mj_BizAppsCommon.Organization WHERE ID='${d.counterpartyId}'`); } catch (e) { console.log(`  teardown warn (org): ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
  console.log('  scenarios teardown complete');
}

async function main(): Promise<void> {
  const [, , cmd, arg1, arg2] = process.argv;
  let pools: Pools;
  try { pools = await connect(); } catch (e) { console.error('FIXTURE BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  try {
    if (cmd === 'setup') await setup(pools);
    else if (cmd === 'seed') { if (!arg1 || !arg2) throw new Error("seed requires '<SCENARIOS_JSON>' <wave>"); await seed(pools, JSON.parse(arg1) as Scenarios, arg2); }
    else if (cmd === 'teardown') { if (!arg1) throw new Error('teardown requires the SCENARIOS_JSON arg'); await teardown(pools, arg1); }
    else throw new Error(`unknown command '${cmd}'. Use: setup | seed '<json>' <wave> | teardown '<json>'`);
  } catch (e) {
    console.error('FIXTURE ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e));
    finishAndExit('scenarios fixture failed', 2, pools.pool, pools.teardownPool);
    return;
  }
  finishAndExit('scenarios fixture ok', 0, pools.pool, pools.teardownPool);
}
void main();
