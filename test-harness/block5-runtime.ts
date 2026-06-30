/**
 * block5-runtime.ts — live validation of the Block-5 COA-mapping approval workflow (server-side).
 *
 * Runs against a REAL instance DB through the REAL provider + server subclasses (MJAPI's path).
 *   propose → UNapproved mapping is INVISIBLE to §5.5 resolution (resolveExternalAccount ignores it).
 *   approve → the mapping now resolves (override beats inline).
 *   strict 1:1 → approving a SECOND mapping for the same local GL supersedes the prior (EffectiveTo closed),
 *               and resolution returns the NEW external account.
 *   idempotency → re-approving an approved mapping is a no-op (nothing re-superseded).
 *   INV approval coherence (DB) → raw-SQL bypass: set ApprovedByUserID without ApprovedAt → rejected
 *               (CK_COAMapping_ApprovalCoherence) — the un-bypassable floor under the workflow.
 *
 * (dimension-through-batch — the other Block-5 server concern — is delivered + proven in block2-runtime.ts.)
 *
 * USAGE (cwd = instance worktree root): npx tsx packages/dev-apps/bizapps-accounting/test-harness/block5-runtime.ts
 * Exit: 0 all passed · 1 failures · 2 bootstrap error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { proposeMapping, approveMapping, resolveExternalAccount } from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const SCHEMA = '__mj_BizAppsAccounting';
const RUN_TAG = `BLOCK5-${Date.now()}`;
function companyCode(): string { return `B5${Date.now().toString(36).slice(-7)}`.toUpperCase(); }

interface Outcome { Name: string; Passed: boolean; Ms: number; Error?: string }
const outcomes: Outcome[] = [];
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try { await fn(); outcomes.push({ Name: name, Passed: true, Ms: Date.now() - start }); console.log(`  ✓ ${name} (${Date.now() - start}ms)`); }
  catch (e) { const msg = e instanceof Error ? (e.stack ?? e.message) : String(e); outcomes.push({ Name: name, Passed: false, Ms: Date.now() - start, Error: msg }); console.log(`  ✗ ${name} (${Date.now() - start}ms)\n      ${msg.split('\n')[0]}`); }
}
function assert(cond: boolean, message: string): void { if (!cond) throw new Error(message); }

interface Ctx { pool: sql.ConnectionPool; user: UserInfo; companyId: string; glId: string }

async function bootstrap(): Promise<Ctx> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env (run from the instance worktree root).');
  const pool = await new sql.ConnectionPool({ server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>({ EntityName: CURRENCY_ENTITY, Fields: ['Code'], MaxRows: 1, ResultType: 'simple' }, ctxUser);
  const currencyCode = cur.Results?.[0]?.Code as string;
  if (!currencyCode) throw new Error(`no currency resolved (success=${cur.Success})`);

  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, ctxUser);
  acp.NewRecord();
  acp.Set('Name', `${RUN_TAG} Co`); acp.Set('Description', `${RUN_TAG} block5 test`);
  acp.Set('CompanyCode', companyCode()); acp.Set('FunctionalCurrencyCode', currencyCode); acp.Set('EntityType', 'Subsidiary');
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed: ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  const glRes = await rv.RunView<{ ID: string; Code: string }>({ EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}' AND Code='40100'`, Fields: ['ID', 'Code'], ResultType: 'simple' }, ctxUser);
  const glId = glRes.Results?.[0]?.ID as string;
  if (!glId) throw new Error('GL account 40100 not seeded');
  // Ensure NO inline ExternalAccountID, so resolution depends purely on the mapping table.
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem=NULL, ExternalAccountID=NULL WHERE ID='${glId}'`);
  return { pool, user: ctxUser, companyId, glId };
}

async function main(): Promise<void> {
  let ctx: Ctx;
  try { ctx = await bootstrap(); } catch (e) { console.error('BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  const { pool, user, companyId, glId } = ctx;
  console.log(`\n══════ Block 5 runtime validation — user=${user.Email} company=${companyId} tag=${RUN_TAG} ══════\n`);

  let mappingA = '', mappingB = '';
  await test('propose — an UNapproved mapping is invisible to §5.5 resolution', async () => {
    mappingA = await proposeMapping(
      { companyId, externalSystem: 'BusinessCentral', externalAccountId: 'BC-1000', internalGLAccountId: glId, effectiveFrom: new Date('2020-01-01'), changeNote: `${RUN_TAG} A` },
      user,
    );
    const resolved = await resolveExternalAccount(glId, companyId, 'BusinessCentral', user);
    assert(resolved === null, `unapproved mapping must NOT resolve; got '${resolved}'`);
  });

  await test('approve — the mapping now resolves (BC-1000)', async () => {
    const res = await approveMapping(mappingA, user.ID, user);
    assert(res.supersededMappingIds.length === 0, 'first approval supersedes nothing');
    const resolved = await resolveExternalAccount(glId, companyId, 'BusinessCentral', user);
    assert(resolved === 'BC-1000', `expected BC-1000, got '${resolved}'`);
  });

  await test('strict 1:1 — approving a 2nd mapping for the same GL supersedes the first; resolution returns BC-2000', async () => {
    mappingB = await proposeMapping(
      { companyId, externalSystem: 'BusinessCentral', externalAccountId: 'BC-2000', internalGLAccountId: glId, effectiveFrom: new Date('2026-06-01'), changeNote: `${RUN_TAG} B` },
      user,
    );
    const res = await approveMapping(mappingB, user.ID, user);
    assert(res.supersededMappingIds.includes(mappingA), `approving B should supersede A; superseded=${JSON.stringify(res.supersededMappingIds)}`);
    // A should now be closed out (EffectiveTo set to the day before B's EffectiveFrom).
    const aTo = (await pool.request().query(`SELECT EffectiveTo FROM ${SCHEMA}.ChartOfAccountsMapping WHERE ID='${mappingA}'`)).recordset[0].EffectiveTo;
    assert(aTo !== null, 'superseded mapping A must have EffectiveTo set');
    const resolved = await resolveExternalAccount(glId, companyId, 'BusinessCentral', user);
    assert(resolved === 'BC-2000', `expected the new mapping BC-2000 to win, got '${resolved}'`);
  });

  await test('idempotency — re-approving an already-approved mapping is a no-op', async () => {
    const res = await approveMapping(mappingB, user.ID, user);
    assert(res.supersededMappingIds.length === 0, `re-approve should supersede nothing, got ${JSON.stringify(res.supersededMappingIds)}`);
  });

  await test('INV approval coherence — DB-bypass: set ApprovedByUserID without ApprovedAt → rejected (CK_COAMapping_ApprovalCoherence)', async () => {
    const mappingC = await proposeMapping(
      { companyId, externalSystem: 'NetSuite', externalAccountId: 'NS-1', internalGLAccountId: glId, effectiveFrom: new Date('2020-01-01'), changeNote: `${RUN_TAG} C` },
      user,
    );
    let threw = false, msg = '';
    try { await pool.request().query(`UPDATE ${SCHEMA}.ChartOfAccountsMapping SET ApprovedByUserID='${user.ID}' WHERE ID='${mappingC}'`); }
    catch (e) { threw = true; msg = e instanceof Error ? e.message : String(e); }
    assert(threw, 'expected the incoherent approval UPDATE to be rejected');
    assert(/CK_COAMapping_ApprovalCoherence|CHECK constraint/i.test(msg), `expected the approval-coherence CHECK to fire, got: ${msg.split('\n')[0]}`);
  });

  // ─── Teardown ──────────────────────────────────────────────────────────────
  const exec = async (q: string) => { try { await pool.request().query(q); } catch (e) { void e; } };
  await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingPeriod WHERE CompanyID='${companyId}'`);
  await exec(`DELETE FROM __mj.Company WHERE ID='${companyId}'`);

  const failed = outcomes.filter(o => !o.Passed);
  console.log(`\n────── Block 5 runtime: ${outcomes.length - failed.length}/${outcomes.length} passed ──────`);
  await pool.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
