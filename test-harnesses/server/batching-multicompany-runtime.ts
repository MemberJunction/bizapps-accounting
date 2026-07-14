/**
 * batching-multicompany-runtime.ts — Tier-2 (in-process, direct SQL) belt-and-suspenders for
 * MULTI-COMPANY batching. Proves at the ENGINE level (calls `buildBatch` directly — no API) what
 * `test-harnesses/api/batching-scenarios-api.ts` proves at the API contract.
 *
 * 2026-07-06 rework (engine-meeting rulings, CH-4): batches are MULTI-COMPANY and buildBatch is
 * GLOBAL — one build sweeps every company's Pending JEs into ONE batch, and the ERP-post seam
 * splits by company downstream. "Independence" therefore now lives INSIDE the batch:
 *
 *   1. Per-company netting isolation — the SAME GL account code in two companies must NOT net
 *      together: netting keys on company × account × dims, so each company gets its own summary
 *      lines with exact per-company amounts.
 *   2. Due-to/from, NO balancing (Payments owns intercompany — per Amith) — an intercompany-tagged
 *      JE batches as-is: it locks to Batched, its JE-line CounterpartyOrganizationID and the JE's
 *      IntercompanyFlowID are preserved, and NO balancing/offset JE is auto-created.
 *
 * PRECONDITION: buildBatch is global — requires ZERO stray Pending JEs at bootstrap (fails fast).
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/batching-multicompany-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error. FK-aware teardown (db_owner pool, triggers toggled).
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
interface JESpec { entryType: mjBizAppsAccountingJournalEntryEntity['EntryType']; intercompanyFlowId?: string; lines: LineSpec[] }
interface Co { companyId: string; jeIds: string[] }

const allJEIds: string[] = [];

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
  const stray = (await pool.request().query(`SELECT COUNT(*) n FROM ${SCHEMA}.JournalEntry WHERE Status='Pending'`)).recordset[0].n;
  if (Number(stray) > 0) throw new Error(`${stray} stray Pending JE(s) exist — clean up first (buildBatch sweeps ALL Pending JEs).`);
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
  const jeIds: string[] = [];
  for (let i = 0; i < jeSpecs.length; i++) {
    const spec = jeSpecs[i];
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
    je.NewRecord();
    je.CompanyID = companyId; // MOD-12: single-company JEs
    je.EffectiveDate = new Date();
    je.EntryType = spec.entryType;
    je.Status = 'Pending'; je.Description = `${RUN_TAG} Co${suffix} JE ${i + 1}`;
    if (spec.intercompanyFlowId) je.IntercompanyFlowID = spec.intercompanyFlowId;
    if (!(await je.Save())) throw new Error(`Co${suffix} JE ${i + 1} save failed: ${je.LatestResult?.CompleteMessage}`);
    jeIds.push(je.ID);
    allJEIds.push(je.ID);
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
  return { companyId, jeIds };
}

async function scalar(pool: sql.ConnectionPool, q: string): Promise<unknown> {
  const r = await pool.request().query(q);
  const row = r.recordset?.[0];
  return row ? Object.values(row)[0] : undefined;
}

async function teardown(p: Pools, companies: Co[], counterpartyId: string): Promise<void> {
  const exec = async (q: string) => { try { await p.teardownPool.request().query(q); } catch (e) { console.log(`  teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  const jeIdList = allJEIds.map(id => `'${id}'`).join(',');
  let batchIdList = '';
  if (jeIdList) {
    try {
      const r = await p.teardownPool.request().query(`SELECT DISTINCT BatchID id FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList}) AND BatchID IS NOT NULL`);
      batchIdList = (r.recordset ?? []).map((x: { id: string }) => `'${x.id}'`).join(',');
    } catch (e) { console.log(`  teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
  }
  const toggled = ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatchLineDimension', 'JournalEntryBatchLineItem', 'JournalEntryBatch'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    if (jeIdList) {
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList})`);
    }
    if (batchIdList) {
      await exec(`DELETE bd FROM ${SCHEMA}.JournalEntryBatchLineDimension bd JOIN ${SCHEMA}.JournalEntryBatchLineItem li ON li.ID=bd.JournalEntryBatchLineItemID WHERE li.BatchID IN (${batchIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID IN (${batchIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID IN (${batchIdList})`);
    }
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }
  for (const co of companies) {
    await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID='${co.companyId}'`);
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${co.companyId}'`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${co.companyId}'`);
    await exec(`DELETE FROM __mj_BizAppsAccounting.JournalEntrySequence WHERE CompanyID='${co.companyId}'`); // per-company JE sequence rows (MOD-12)
    await exec(`DELETE FROM __mj.Company WHERE ID='${co.companyId}'`);
  }
  await exec(`DELETE FROM __mj_BizAppsCommon.Organization WHERE ID='${counterpartyId}'`);
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

  const companies: Co[] = [];
  try {
    const coA = await provision(p, 'A', currency, [
      { entryType: 'Manual', lines: [{ glCode: '11201', debit: 500 }, { glCode: '40100', credit: 500 }] },
      { entryType: 'IntercompanyFlow', intercompanyFlowId: flowId, lines: [{ glCode: '11201', debit: 300, counterparty: counterpartyId }, { glCode: '40100', credit: 300 }] },
    ]);
    companies.push(coA);
    const coB = await provision(p, 'B', currency, [{ entryType: 'Manual', lines: [{ glCode: '11201', debit: 200 }, { glCode: '40100', credit: 200 }] }]);
    companies.push(coB);

    // ── 1. One GLOBAL build sweeps both companies; netting is ISOLATED per company ──
    console.log('\n1. Global sweep + per-company netting isolation (CH-4):');
    const built = await buildBatch(TARGET, p.user.ID, p.user, AutoApproveGate);
    assert(built !== null && built.jeCount === 3, 'ONE global build swept all 3 Pending JEs across both companies', `jeCount=${built?.jeCount}`);
    assert(built !== null && built.companyCount === 2, 'the batch reports companyCount = 2 (CH-4 multi-company batch)', `companyCount=${built?.companyCount}`);
    assert(built !== null && built.summaryLineCount === 4, 'same account codes did NOT net across companies — 4 summary lines (2 per company)', `summaryLineCount=${built?.summaryLineCount}`);
    // Exact per-company summary amounts: A nets 500+300 → AR Dr 800 / Rev Cr 800; B → AR Dr 200 / Rev Cr 200.
    const sums = (await p.pool.request().query(
      `SELECT CompanyID, ISNULL(SUM(DebitAmount),0) dr, ISNULL(SUM(CreditAmount),0) cr FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID='${built!.batchId}' GROUP BY CompanyID`)).recordset as Array<{ CompanyID: string; dr: number; cr: number }>;
    const sumOf = (id: string) => sums.find(s => s.CompanyID.toLowerCase() === id.toLowerCase());
    const a = sumOf(coA.companyId), b = sumOf(coB.companyId);
    assert(!!a && Number(a.dr) === 800 && Number(a.cr) === 800, 'CoA summary nets to EXACTLY Dr 800 / Cr 800 (500 + 300, CoA only)', `got ${a?.dr}/${a?.cr}`);
    assert(!!b && Number(b.dr) === 200 && Number(b.cr) === 200, 'CoB summary nets to EXACTLY Dr 200 / Cr 200 (CoB only)', `got ${b?.dr}/${b?.cr}`);

    // ── 2. Due-to/from: batched as-is, tags preserved, NO balancing ─────────
    console.log('\n2. Due-to/from (no balancing — Payments owns intercompany):');
    const icJeId = coA.jeIds[1]; // the IntercompanyFlow JE
    const icStatus = await scalar(p.pool, `SELECT Status FROM ${SCHEMA}.JournalEntry WHERE ID='${icJeId}'`);
    assert(icStatus === 'Batched', 'the intercompany JE locked to Batched (Accounting received + batched it)', `status=${String(icStatus)}`);
    const preservedFlow = await scalar(p.pool, `SELECT IntercompanyFlowID FROM ${SCHEMA}.JournalEntry WHERE ID='${icJeId}'`);
    assert(String(preservedFlow).toUpperCase() === flowId.toUpperCase(), 'the JE\'s IntercompanyFlowID is PRESERVED through batching', `got ${String(preservedFlow)}`);
    const preservedCp = await scalar(p.pool, `SELECT TOP 1 CounterpartyOrganizationID FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID='${icJeId}' AND CounterpartyOrganizationID IS NOT NULL`);
    assert(String(preservedCp).toUpperCase() === counterpartyId.toUpperCase(), 'the JE-line CounterpartyOrganizationID is PRESERVED through batching', `got ${String(preservedCp)}`);
    const totalJEs = Number(await scalar(p.pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry WHERE ID IN (${allJEIds.map(id => `'${id}'`).join(',')})`));
    const anyExtra = Number(await scalar(p.pool, `SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry WHERE BatchID='${built!.batchId}'`));
    assert(totalJEs === 3 && anyExtra === 3, 'NO balancing/offset JE was auto-created (the batch holds exactly the 3 provisioned JEs)', `tracked=${totalJEs} inBatch=${anyExtra}`);
  } catch (e) {
    assert(false, 'multi-company scenarios completed without throwing', e instanceof Error ? e.message : String(e));
  } finally {
    await teardown(p, companies, counterpartyId);
  }

  const total = passed + failed;
  finishAndExit(`\n────── Multi-company batching: ${passed}/${total} passed ──────`, failed === 0 ? 0 : 1, p.pool, p.teardownPool);
}
void main();
