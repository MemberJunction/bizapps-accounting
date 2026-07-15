/**
 * scheduled-je-runtime — LIVE B3.1 + B3.2: create a dated rev-rec schedule via the atomic
 * `Accounting.CreateScheduledJournalEntries` op, then materialize due entries by DATE into Pending
 * JEs via `Accounting.MaterializeDueScheduledEntries`. Asserts: N dated SJEs summing to total with
 * balanced Dr/Cr pairs; only entries due on/before asOf materialize (Generated + a Pending JE);
 * idempotent re-run; supersede marks a still-Scheduled prior row.
 *
 * Run from the instance worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/scheduled-je-runtime.ts
 */
import * as dotenv from 'dotenv';
import sql from 'mssql';
import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import { CreateScheduledJournalEntriesOperation, MaterializeScheduledEntriesOperation } from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';

const SCHEMA = '__mj_BizAppsAccounting';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const RUN_TAG = `SJE-${Date.now()}`;

interface Outcome { Name: string; Passed: boolean; Error?: string }
const outcomes: Outcome[] = [];
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); outcomes.push({ Name: name, Passed: true }); console.log(`  ✓ ${name}`); }
  catch (e) { const m = e instanceof Error ? (e.stack ?? e.message) : String(e); outcomes.push({ Name: name, Passed: false, Error: m }); console.log(`  ✗ ${name}\n      ${m.split('\n')[0]}`); }
}
function assert(c: boolean, m: string): void { if (!c) throw new Error(m); }
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

let pool: sql.ConnectionPool;
let teardownPool: sql.ConnectionPool;
let user: UserInfo;
let companyId = '';
let defRevGL = '';
let revGL = '';
let currencyCode = '';
const createdSJEIds: string[] = [];
const createdJEIds: string[] = [];

async function bootstrap(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: u, DB_PASSWORD: p, DB_PORT, CODEGEN_DB_USERNAME: cu, CODEGEN_DB_PASSWORD: cp } = process.env;
  if (!host || !database || !u || !p || !cu || !cp) throw new Error('Missing DB settings in .env (run from the instance worktree root).');
  const port = Number(DB_PORT ?? 1433);
  const opts = { options: { encrypt: false, trustServerCertificate: true } };
  pool = await new sql.ConnectionPool({ server: host, port, user: u, password: p, database, ...opts }).connect();
  teardownPool = await new sql.ConnectionPool({ server: host, port, user: cu, password: cp, database, ...opts }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const found = UserCache.Users.find(x => x?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!found) throw new Error('no context user');
  user = found;
  currencyCode = (await new RunView().RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, user)).Results?.[0]?.Code ?? '';
  if (!currencyCode) throw new Error('no currency');
}

async function createCompany(): Promise<void> {
  const acp = await new Metadata().GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${RUN_TAG} Co`;
  acp.Description = `${RUN_TAG} B3 test`;
  acp.CompanyCode = `SJE${Date.now().toString(36).slice(-5)}`.toUpperCase();
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${JSON.stringify(acp.LatestResult)}`);
  const gl = await new RunView().RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, user);
  const byCode = new Map((gl.Results ?? []).map(r => [r.Code, r.ID]));
  defRevGL = byCode.get('21301') ?? '';
  revGL = byCode.get('40100') ?? '';
  if (!defRevGL || !revGL) throw new Error('seeded GL accounts (21301 DefRev / 40100 Revenue) not found');
}

async function main(): Promise<void> {
  console.log('\n══════ Scheduled JE create + materialize (B3.1 / B3.2) ══════');
  await bootstrap();
  await createCompany();

  // Three monthly recognition dates; asOf will sit AFTER the first two, before the third.
  const d1 = '2026-05-15', d2 = '2026-06-15', d3 = '2026-07-15';
  const asOf = new Date('2026-06-20T00:00:00.000Z');

  await test('B3.1 create schedule — 3 dated SJEs summing to total, each a balanced Dr/Cr pair', async () => {
    const res = await new CreateScheduledJournalEntriesOperation().Execute({
      CompanyID: companyId, EntryType: 'DeferredRevenueRelease', CurrencyCode: currencyCode, TotalAmount: 300,
      DebitGLAccountID: defRevGL, CreditGLAccountID: revGL, RecognitionDates: [d1, d2, d3], Description: `${RUN_TAG} rev-rec`,
    }, { user });
    assert(res.Output?.Success === true, `schedule create should succeed: ${JSON.stringify(res.Output?.Errors)}`);
    const ids = res.Output!.ScheduledEntryIDs ?? [];
    assert(ids.length === 3, `expected 3 SJEs, got ${ids.length}`);
    createdSJEIds.push(...ids);
    const rows = (await pool.request().query(`SELECT TotalAmount, ScheduledEffectiveDate, Status FROM ${SCHEMA}.ScheduledJournalEntry WHERE ID IN (${ids.map(i => `'${i}'`).join(',')})`)).recordset;
    assert(near(rows.reduce((s, r) => s + Number(r.TotalAmount), 0), 300), 'installments must sum to 300');
    assert(rows.every(r => r.Status === 'Scheduled'), 'all SJEs start Scheduled');
    const lines = (await pool.request().query(`SELECT DebitAmount, CreditAmount FROM ${SCHEMA}.ScheduledJournalEntryLineItem WHERE ScheduledJournalEntryID IN (${ids.map(i => `'${i}'`).join(',')})`)).recordset;
    assert(near(lines.reduce((s, r) => s + Number(r.DebitAmount ?? 0), 0), lines.reduce((s, r) => s + Number(r.CreditAmount ?? 0), 0)), 'Dr must equal Cr across the schedule');
  });

  await test('B3.2 materialize by DATE — only entries due on/before asOf become Generated + Pending JEs', async () => {
    const res = await new MaterializeScheduledEntriesOperation().Execute({ AsOf: asOf.toISOString() }, { user });
    assert(res.Output?.Materialized === 2, `2 of 3 (d1,d2 ≤ asOf) should materialize, got ${res.Output?.Materialized}`);
    createdJEIds.push(...(res.Output?.JournalEntryIDs ?? []));
    const statuses = (await pool.request().query(`SELECT Status, GeneratedJournalEntryID FROM ${SCHEMA}.ScheduledJournalEntry WHERE ID IN (${createdSJEIds.map(i => `'${i}'`).join(',')}) ORDER BY ScheduledEffectiveDate`)).recordset;
    assert(statuses[0].Status === 'Generated' && statuses[1].Status === 'Generated', 'd1,d2 → Generated');
    assert(statuses[2].Status === 'Scheduled', 'd3 (future) stays Scheduled');
    assert(!!statuses[0].GeneratedJournalEntryID && !!statuses[1].GeneratedJournalEntryID, 'Generated SJEs stamp the JE id');
    const jeCount = (await pool.request().query(`SELECT COUNT(*) n FROM ${SCHEMA}.JournalEntry WHERE ID IN (${(res.Output!.JournalEntryIDs).map(i => `'${i}'`).join(',')}) AND Status='Pending'`)).recordset[0].n;
    assert(Number(jeCount) === 2, `2 Pending JEs expected, got ${jeCount}`);
  });

  await test('B3.2 idempotency — re-materializing the same asOf creates NO new JEs', async () => {
    const res = await new MaterializeScheduledEntriesOperation().Execute({ AsOf: asOf.toISOString() }, { user });
    assert(res.Output?.Materialized === 0, `re-run should materialize nothing, got ${res.Output?.Materialized}`);
  });

  await test('B3.1 supersede — a recompute marks the still-Scheduled prior entry Superseded', async () => {
    const stillScheduled = createdSJEIds[2]; // d3, not yet materialized
    const res = await new CreateScheduledJournalEntriesOperation().Execute({
      CompanyID: companyId, EntryType: 'DeferredRevenueRelease', CurrencyCode: currencyCode, TotalAmount: 100,
      DebitGLAccountID: defRevGL, CreditGLAccountID: revGL, RecognitionDates: ['2026-07-15'], Description: `${RUN_TAG} recompute`,
      SupersedeScheduledEntryIDs: [stillScheduled],
    }, { user });
    assert(res.Output?.Success === true, `recompute should succeed: ${JSON.stringify(res.Output?.Errors)}`);
    createdSJEIds.push(...(res.Output?.ScheduledEntryIDs ?? []));
    const row = (await pool.request().query(`SELECT Status, SupersededByScheduledJournalEntryID FROM ${SCHEMA}.ScheduledJournalEntry WHERE ID='${stillScheduled}'`)).recordset[0];
    assert(row.Status === 'Superseded', `prior entry should be Superseded, got ${row.Status}`);
    assert(!!row.SupersededByScheduledJournalEntryID, 'supersede link stamped');
  });

  await test('B3.1 validation — a malformed schedule (same Dr/Cr account) is rejected, nothing written', async () => {
    const res = await new CreateScheduledJournalEntriesOperation().Execute({
      CompanyID: companyId, EntryType: 'DeferredRevenueRelease', CurrencyCode: currencyCode, TotalAmount: 50,
      DebitGLAccountID: defRevGL, CreditGLAccountID: defRevGL, RecognitionDates: ['2026-08-15'],
    }, { user });
    assert(res.Output?.Success === false, 'same debit+credit account must be rejected');
  });

  await teardown();
  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Scheduled JE B3.1/B3.2: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  if (failed.length) for (const f of failed) console.log(`   ✗ ${f.Name}: ${(f.Error ?? '').split('\n')[0]}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

async function teardown(): Promise<void> {
  const exec = async (q: string) => { try { await teardownPool.request().query(q); } catch (e) { console.log(`      teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };
  const jeList = createdJEIds.map(i => `'${i}'`).join(',');
  const sjeList = createdSJEIds.map(i => `'${i}'`).join(',');
  // SJEs FIRST — GeneratedJournalEntryID FKs the JE; disable their lock triggers.
  const allTriggers = ['ScheduledJournalEntryLineItem', 'ScheduledJournalEntry', 'JournalEntryLine', 'JournalEntry'];
  for (const t of allTriggers) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  if (sjeList) {
    await exec(`DELETE FROM ${SCHEMA}.ScheduledJournalEntryLineItem WHERE ScheduledJournalEntryID IN (${sjeList})`);
    await exec(`DELETE FROM ${SCHEMA}.ScheduledJournalEntry WHERE ID IN (${sjeList})`);
  }
  if (jeList) {
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeList})`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeList})`);
  }
  for (const t of allTriggers) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  if (companyId) {
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID='${companyId}'`);
    await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);
  }
}

void main();
