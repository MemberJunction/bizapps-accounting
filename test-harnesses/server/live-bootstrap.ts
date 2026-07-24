/**
 * live-bootstrap.ts — shared bootstrap/teardown for the live tier-2 server harness (phase 2).
 *
 * Ported from the proven donor harness (engine-runtime.ts on the old branch), adapted to the
 * rewritten baseline + Vitest:
 *   - dual pools: MJ_Connect-equivalent app pool (drives the real provider) + a db_owner
 *     teardown pool (CODEGEN creds) that may toggle triggers during cleanup;
 *   - setupSQLServerClient wires the REAL SQLServerDataProvider (the same provider MJAPI uses);
 *   - trigger PRE-FLIGHT: the invariant triggers must exist AND be enabled, else raw-SQL
 *     cross-checks pass vacuously (a prior crashed teardown can leave triggers disabled);
 *   - self-contained fixtures: a run-tagged company (ACP save fires the W1 COA seeding) +
 *     dimensions, all torn down FK-aware by tag/ID afterwards. NEVER touches shared demo data.
 *
 * The .env is the INSTANCE WORKTREE root's (mj/.env) — resolved relative to this file.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
// Side-effect imports: fire every @RegisterClass so GetEntityObject returns the server subclasses.
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/tasks-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';

export const SCHEMA = '__mj_BizAppsAccounting';
const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';

/** The hand-authored financial-invariant triggers of the rewritten baseline (NOT CodeGen's trgUpdate*). */
const INVARIANT_TRIGGERS = [
  'trg_JournalEntry_BalancedOnLock',
  'trg_JEL_RecheckParentBalance',
  'trg_JournalEntry_Immutability',
  'trg_JEL_Immutability',
  'trg_JEL_CompanyMatch',
  'trg_JE_CompanyMatch',
  'trg_JEBatch_Immutability',
  'trg_JEBatch_SummaryCoherence',
  'trg_ACP_NoChains',
  'trg_JE_ReversalConsistency',
];

export interface LiveCompany { id: string; code: string; arGL: string; revGL: string; cashGL: string }

export interface LiveCtx {
  pool: sql.ConnectionPool;
  teardownPool: sql.ConnectionPool;
  user: UserInfo;
  runTag: string;
  company: LiveCompany;
  /** A second company — for cross-company invariant cases (e.g. mixed-company draft rollback). */
  companyB: LiveCompany;
  dimId: string;
  dimValSales: string;
  dimValMktg: string;
  /** JE IDs the tests created — teardown deletes exactly these (plus the fixture company orbit). */
  createdJEIds: string[];
  /** Batch IDs the tests created. */
  createdBatchIds: string[];
}

let companyCounter = 0;
function companyCode(tag: string): string {
  return `P2${companyCounter++}${tag.replace(/[^A-Z0-9]/gi, '').slice(-8)}`.toUpperCase().slice(0, 20);
}

async function connectPool(host: string, port: number, database: string, user: string, password: string): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool({
    server: host, port, user, password, database,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

async function assertInvariantTriggers(pool: sql.ConnectionPool): Promise<void> {
  const rows = (await pool.request().query(
    `SELECT t.name, t.is_disabled FROM sys.triggers t JOIN sys.objects o ON o.object_id = t.parent_id
     JOIN sys.schemas s ON s.schema_id = o.schema_id WHERE s.name = '${SCHEMA}'`,
  )).recordset as Array<{ name: string; is_disabled: boolean }>;
  const byName = new Map(rows.map(r => [r.name, r.is_disabled]));
  const missing = INVARIANT_TRIGGERS.filter(t => !byName.has(t));
  const disabled = INVARIANT_TRIGGERS.filter(t => byName.get(t) === true);
  if (missing.length || disabled.length) {
    throw new Error(
      `Invariant-trigger preflight failed — missing: [${missing.join(', ')}] disabled: [${disabled.join(', ')}]. ` +
      `A broken migrate or a crashed prior teardown (which toggles DISABLE/ENABLE TRIGGER ALL) leaves the raw-SQL checks vacuous. ` +
      `Re-enable with: ENABLE TRIGGER ALL ON ${SCHEMA}.<table>, or re-run drop-schema → migrate.`,
    );
  }
}

async function createCompany(user: UserInfo, runTag: string, label = 'Live Harness Co'): Promise<LiveCompany> {
  const md = new Metadata();
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>(
    { EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, user);
  const currencyCode = cur.Results?.[0]?.Code;
  if (!currencyCode) throw new Error(`no Currency rows found (success=${cur.Success}) — seed bizapps-common currencies first`);

  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.Name = `${runTag} ${label}`;
  acp.Description = `${runTag} phase-2 live harness fixture (safe to delete)`;
  acp.CompanyCode = companyCode(runTag);
  acp.FunctionalCurrencyCode = currencyCode;
  acp.EntityType = 'Subsidiary';
  const id = acp.ID;
  if (!(await acp.Save())) throw new Error(`fixture ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  // W1 (AccountingCompanyProfileEntityServer) seeded the default COA on first save — resolve the refs.
  const glRes = await rv.RunView<{ ID: string; Code: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${id}'`, Fields: ['ID', 'Code'], ResultType: 'simple', BypassCache: true }, user);
  const byCode = new Map((glRes.Results ?? []).map(r => [r.Code, r.ID]));
  const arGL = byCode.get('11201'); const revGL = byCode.get('40100'); const cashGL = byCode.get('11101');
  if (!arGL || !revGL || !cashGL) throw new Error('W1 COA seeding did not produce the expected accounts (11201/40100/11101)');
  return { id, code: acp.CompanyCode, arGL, revGL, cashGL };
}

export async function bootstrapLive(): Promise<LiveCtx> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(here, '..', '..', '..', '..', '..', '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB_* settings — expected the instance worktree .env (mj/.env)');
  const port = Number(process.env.DB_PORT ?? 1433);
  const pool = await connectPool(host, port, database, user, password);

  const { CODEGEN_DB_USERNAME: cgUser, CODEGEN_DB_PASSWORD: cgPassword } = process.env;
  if (!cgUser || !cgPassword) throw new Error('Missing CODEGEN_DB_USERNAME/PASSWORD (db_owner teardown pool)');
  const teardownPool = await connectPool(host, port, database, cgUser, cgPassword);

  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await assertInvariantTriggers(pool);
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('no context user found in UserCache');

  const runTag = `P2LIVE-${Date.now().toString(36).toUpperCase()}`;
  const company = await createCompany(ctxUser, runTag, 'Live Harness Co A');
  const companyB = await createCompany(ctxUser, runTag, 'Live Harness Co B');

  const dimId = randomUUID(); const dimValSales = randomUUID(); const dimValMktg = randomUUID();
  await pool.request().query(
    `INSERT INTO ${SCHEMA}.Dimension (ID, Code, Name) VALUES ('${dimId}','DEPT-${runTag}','Department ${runTag}')`);
  await pool.request().query(
    `INSERT INTO ${SCHEMA}.DimensionValue (ID, DimensionID, Code, Name) VALUES ` +
    `('${dimValSales}','${dimId}','SALES','Sales'),('${dimValMktg}','${dimId}','MKTG','Marketing')`);

  return { pool, teardownPool, user: ctxUser, runTag, company, companyB, dimId, dimValSales, dimValMktg, createdJEIds: [], createdBatchIds: [] };
}

/** FK-aware, trigger-toggling teardown of everything the run created. Warnings, never throws. */
export async function teardownLive(ctx: LiveCtx): Promise<void> {
  const exec = async (q: string) => {
    try { await ctx.teardownPool.request().query(q); }
    catch (e) { console.warn(`teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
  };
  const jeIds = ctx.createdJEIds.map(id => `'${id}'`).join(',');
  const batchIds = ctx.createdBatchIds.map(id => `'${id}'`).join(',');
  const companyIdList = [ctx.company.id, ctx.companyB.id].map(id => `'${id}'`).join(',');
  const toggled = ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatch'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    // Also sweep by company: locked/summary JEs the tests didn't track individually.
    await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID IN (${companyIdList})${jeIds ? ` OR l.JournalEntryID IN (${jeIds})` : ''}`);
    await exec(`DELETE l FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID IN (${companyIdList})${jeIds ? ` OR l.JournalEntryID IN (${jeIds})` : ''}`);
    await exec(`UPDATE ${SCHEMA}.JournalEntryBatch SET SummaryJournalEntryID = NULL WHERE CompanyID IN (${companyIdList})`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID IN (${companyIdList})${jeIds ? ` OR ID IN (${jeIds})` : ''}`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID IN (${companyIdList})${batchIds ? ` OR ID IN (${batchIds})` : ''}`);
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }
  await exec(`DELETE FROM ${SCHEMA}.DimensionValue WHERE DimensionID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.Dimension WHERE ID='${ctx.dimId}'`);
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID IN (${companyIdList})`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID IN (${companyIdList})`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID IN (${companyIdList})`);
  await exec(`DELETE FROM __mj.Company WHERE ID IN (${companyIdList})`);

  // NEVER await a full pool close (it can hang on lingering sockets — donor harness lesson);
  // race it against a short timeout so vitest's forked worker can exit.
  const raceClose = (p: sql.ConnectionPool) => Promise.race([
    p.close().catch(() => undefined),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  await raceClose(ctx.pool);
  await raceClose(ctx.teardownPool);
}

/** Convenience: single-value raw-SQL probe (the truth the tests cross-check against). */
export async function scalar(pool: sql.ConnectionPool, q: string): Promise<unknown> {
  const r = await pool.request().query(q);
  const row = r.recordset?.[0];
  return row ? Object.values(row)[0] : undefined;
}
