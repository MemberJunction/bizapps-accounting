/**
 * batching-multicompany-runtime.ts — Tier-2 (in-process, direct SQL) belt-and-suspenders for
 * MULTI-COMPANY batching. Proves at the ENGINE level (calls `buildBatch` directly — no API) what
 * `test-harnesses/api/batching-scenarios-api.ts` proves at the API contract:
 *
 *   1. Multi-company INDEPENDENCE — building CoA's batch touches ONLY CoA's JEs; CoB's JE stays
 *      Pending (no cross-company bleed). Each company's batch jeCount === its own JE count.
 *   2. Due-to/from, NO balancing (Payments owns intercompany — per Amith) — an intercompany-tagged
 *      JE batches as-is: it locks to Batched, its JE-line CounterpartyOrganizationID is preserved,
 *      and NO balancing/offset JE is auto-created (CoA still has exactly its provisioned JEs).
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/batching-multicompany-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. FK-aware teardown (triggers toggled).
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { finishAndExit } from './harness-exit.js';
import { assertInvariantTriggers } from './trigger-preflight.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import { buildBatch, AutoApproveGate } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonOrganizationEntity } from '@mj-biz-apps/common-entities';

const SCHEMA = '__mj_BizAppsAccounting';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const PERIOD_ENTITY = 'MJ_BizApps_Accounting: Accounting Periods';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const ORG_ENTITY = 'MJ_BizApps_Common: Organizations';
const TARGET = 'BusinessCentral';
const RUN_TAG = `MCBATCH-${randomUUID().slice(0, 8).toUpperCase()}`;

let passed = 0, failed = 0;
function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

interface Pools { pool: sql.ConnectionPool; teardownPool: sql.ConnectionPool; user: UserInfo }
interface LineSpec { glCode: string; debit?: number; credit?: number; counterparty?: string }
interface JESpec { entryType: string; intercompanyFlowId?: string; lines: LineSpec[] }
interface Co { companyId: string; periodId: string; jeIds: string[] }

async function connect(): Promise<Pools> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env — run from the instance worktree root.');
  const port = Number(process.env.DB_PORT ?? 1433);
  const opt = { encrypt: false, trustServerCertificate: true };
  const pool = await new sql.ConnectionPool({ server: host, port, user, password, database, options: opt }).connect();
  const { CODEGEN_DB_USERNAME: cgUser, CODEGEN_DB_PASSWORD: cgPassword } = process.env;
  const teardownPool = cgUser && cgPassword
    ? await new sql.ConnectionPool({ server: host, port, user: cgUser, password: cgPassword, database, options: opt }).connect()
    : pool;
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await assertInvariantTriggers(pool);
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  return { pool, teardownPool, user: ctxUser };
}

async function provision(p: Pools, suffix: string, currency: string, jeSpecs: JESpec[]): Promise<Co> {
  const { pool, user } = p;
  const md = new Metadata();
  const rv = new RunView();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} Co${suffix}`;
  acp.Description = `${RUN_TAG} multicompany tier-2`;
  acp.CompanyCode = `MC${suffix}${randomUUID().slice(0, 4)}`.toUpperCase();
  acp.FunctionalCurrencyCode = currency;
  acp.EntityType = 'Subsidiary';
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP ${suffix} save failed: ${acp.LatestResult?.CompleteMessage}`);
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`);
  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((glRes.Results ?? []).map((r) => [r.Code, r.ID]));
  const periodRes = await rv.RunView<{ ID: string }>({ EntityName: PERIOD_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND PeriodType='Month' AND Status='Open'`, OrderBy: 'PeriodStart ASC', ResultType: 'simple' }, user);
  const periodId = periodRes.Results?.[0]?.ID;
  if (!periodId) throw new Error(`no open Month period for Co${suffix}`);
  const jeIds: string[] = [];
  for (let i = 0; i < jeSpecs.length; i++) {
    const spec = jeSpecs[i];
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord();
    je.CompanyID = companyId; je.AccountingPeriodID = periodId; je.EffectiveDate = new Date();
    je.EntryType = spec.entryType as mjBizAppsAccountingJournalEntryEntity['EntryType'];
    je.Status = 'Pending'; je.Description = `${RUN_TAG} Co${suffix} JE ${i + 1}`;
    if (spec.intercompanyFlowId) je.IntercompanyFlowID = spec.intercompanyFlowId;
    if (!(await je.Save())) throw new Error(`Co${suffix} JE ${i + 1} save failed: ${je.LatestResult?.CompleteMessage}`);
    jeIds.push(je.ID);
    let ln = 0;
    for (const ls of spec.lines) {
      ln += 1;
      const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
      l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = ln; l.GLAccountID = byCode.get(ls.glCode)!;
      l.DebitAmount = ls.debit ?? null; l.CreditAmount = ls.credit ?? null;
      if (ls.counterparty) l.CounterpartyOrganizationID = ls.counterparty;
      if (!(await l.Save())) throw new Error(`Co${suffix} JE ${i + 1} line ${ln} save failed: ${l.LatestResult?.CompleteMessage}`);
    }
  }
  return { companyId, periodId, jeIds };
}

async function scalar(pool: sql.ConnectionPool, q: string): Promise<unknown> {
  const r = await pool.request().query(q);
  const row = r.recordset?.[0];
  return row ? Object.values(row)[0] : undefined;
}

async function teardownCo(p: Pools, companyId: string): Promise<void> {
  const exec = async (q: string) => { try { await p.teardownPool.request().query(q); } catch (e) { console.log(`  teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
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
}

async function main(): Promise<void> {
  let p: Pools;
  try { p = await connect(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  console.log(`\n══════ Multi-company batching (tier-2, in-process) — ${RUN_TAG} ══════`);

  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, p.user);
  const currency = cur.Results?.[0]?.Code;
  if (!currency) { finishAndExit('no currency', 2, p.pool, p.teardownPool); return; }

  // Counterparty org for the intercompany leg.
  const md = new Metadata();
  const org = await md.GetEntityObject<mjBizAppsCommonOrganizationEntity>(ORG_ENTITY, p.user);
  org.NewRecord(); org.Name = `${RUN_TAG} Counterparty`; org.Status = 'Active';
  if (!(await org.Save())) { finishAndExit(`org save failed: ${org.LatestResult?.CompleteMessage}`, 2, p.pool, p.teardownPool); return; }
  const counterpartyId = org.ID;
  const flowId = randomUUID();

  let coA: Co | undefined, coB: Co | undefined;
  try {
    coA = await provision(p, 'A', currency, [
      { entryType: 'Manual', lines: [{ glCode: '11201', debit: 500 }, { glCode: '40100', credit: 500 }] },
      { entryType: 'IntercompanyFlow', intercompanyFlowId: flowId, lines: [{ glCode: '11201', debit: 300, counterparty: counterpartyId }, { glCode: '40100', credit: 300 }] },
    ]);
    coB = await provision(p, 'B', currency, [{ entryType: 'Manual', lines: [{ glCode: '11201', debit: 200 }, { glCode: '40100', credit: 200 }] }]);

    // ── 1. Multi-company INDEPENDENCE ───────────────────────────────────────
    console.log('\n1. Multi-company independence:');
    const batchA = await buildBatch(coA.companyId, coA.periodId, TARGET, p.user.ID, p.user, AutoApproveGate);
    assert(batchA !== null && batchA.jeCount === 2, 'CoA batch contains exactly CoA\'s 2 JEs', `jeCount=${batchA?.jeCount}`);
    const coBPendingAfterA = Number(await scalar(p.pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${coB.companyId}' AND Status='Pending'`));
    assert(coBPendingAfterA === 1, 'building CoA left CoB\'s JE untouched (still Pending) — no cross-company bleed', `CoB pending=${coBPendingAfterA}`);
    const batchB = await buildBatch(coB.companyId, coB.periodId, TARGET, p.user.ID, p.user, AutoApproveGate);
    assert(batchB !== null && batchB.jeCount === 1, 'CoB batch contains exactly CoB\'s 1 JE', `jeCount=${batchB?.jeCount}`);

    // ── 2. Due-to/from: batched as-is, tag preserved, NO balancing ──────────
    console.log('\n2. Due-to/from (no balancing — Payments owns intercompany):');
    const icJeId = coA.jeIds[1]; // the IntercompanyFlow JE
    const icStatus = await scalar(p.pool, `SELECT Status FROM ${SCHEMA}.JournalEntry WHERE ID='${icJeId}'`);
    assert(icStatus === 'Batched', 'the intercompany JE locked to Batched (Accounting received + batched it)', `status=${String(icStatus)}`);
    const preservedCp = await scalar(p.pool, `SELECT TOP 1 CounterpartyOrganizationID FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${icJeId}' AND CounterpartyOrganizationID IS NOT NULL`);
    assert(String(preservedCp).toUpperCase() === counterpartyId.toUpperCase(), 'the JE-line CounterpartyOrganizationID is PRESERVED through batching', `got ${String(preservedCp)}`);
    const coAJeTotal = Number(await scalar(p.pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${coA.companyId}'`));
    assert(coAJeTotal === 2, 'NO balancing/offset JE was auto-created (CoA still has exactly its 2 JEs)', `CoA JE count=${coAJeTotal}`);
  } catch (e) {
    assert(false, 'multi-company scenarios completed without throwing', e instanceof Error ? e.message : String(e));
  } finally {
    if (coA) await teardownCo(p, coA.companyId);
    if (coB) await teardownCo(p, coB.companyId);
    try { await p.teardownPool.request().query(`DELETE FROM __mj_BizAppsCommon.Organization WHERE ID='${counterpartyId}'`); } catch { /* best effort */ }
  }

  const total = passed + failed;
  finishAndExit(`\n────── Multi-company batching: ${passed}/${total} passed ──────`, failed === 0 ? 0 : 1, p.pool, p.teardownPool);
}
void main();
