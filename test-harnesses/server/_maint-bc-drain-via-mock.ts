/** _maint-bc-drain-via-mock.ts — drain legacy JEs off the BC-mapped accounts, via the Mock target.
 *
 *  Marcelo's sequencing (2026-08-21): clear out JEs that point at the OLD fabricated mapping using
 *  the Mock target, THEN leave only the correct accounts pointing at Business Central.
 *
 *  1. flip 11201 + 40100 (proof company) BACK to Mock   -> account-driven routing (D13) picks Mock,
 *                                                          overriding the batch's TargetSystem
 *  2. approve + dispatch every non-terminal batch on that company -> Posted with a MOCK- ref
 *  3. flip those two accounts back to the verified Business Central GUIDs
 *  4. assert NOTHING non-GLPosted is left armed at Business Central
 *  Writes NOTHING to Business Central.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/tasks-entities';
import '@mj-biz-apps/tasks-entities-server';
import '@mj-biz-apps/accounting-core-entities-server';
import { DispatchJournalEntryBatchOperation, approveJournalEntryBatch } from '@mj-biz-apps/accounting-core-entities-server';

const COMPANY = 'A55C0DE1-0001-4000-8000-000000000001';
const BC_MAP: Record<string, string> = { '11201': 'b7abc1de-6cb7-eb11-9b52-000d3aec3ef4', '40100': '5c725174-57c9-eb11-9f0a-000d3aec3ef4' };
const S = '__mj_BizAppsAccounting';
const E = 'MJ_BizApps_Accounting: GL Accounts';

async function setMapping(md: Metadata, user: any, pool: sql.ConnectionPool, system: string, idOf: (code: string) => string): Promise<void> {
  for (const code of Object.keys(BC_MAP)) {
    const row = (await pool.request().query(`SELECT ID FROM ${S}.GLAccount WHERE CompanyID='${COMPANY}' AND Code='${code}'`)).recordset[0];
    const a = await md.GetEntityObject<any>(E, user); await a.Load(row.ID);
    a.ExternalSystem = system; a.ExternalAccountID = idOf(code);
    if (!(await a.Save())) throw new Error(`save ${code}: ${a.LatestResult?.CompleteMessage}`);
    console.log(`   ${code} -> ${system} / ${idOf(code)}`);
  }
}

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();

  console.log('STEP 1 — flip the two accounts back to Mock so routing cannot reach BC');
  await setMapping(md, user, pool, 'Mock', c => `MOCK-${c}`);

  const batches = (await pool.request().query(`SELECT ID, JournalEntryBatchNumber, Status FROM ${S}.JournalEntryBatch WHERE CompanyID='${COMPANY}' AND Status NOT IN ('Posted') ORDER BY JournalEntryBatchNumber`)).recordset;
  let allDrained = true;
  console.log(`\nSTEP 2 — draining ${batches.length} non-terminal batch(es) through Mock`);
  for (const b of batches) {
    console.log(`  ${b.JournalEntryBatchNumber} (${b.Status})`);
    if (b.Status === 'Pending') {
      try { await approveJournalEntryBatch(b.ID, user.ID, user, provider); console.log('    approved'); }
      catch (e: any) { console.log(`    approve skipped: ${e?.message}`); }
    }
    const res = await new DispatchJournalEntryBatchOperation().ExecuteServer({ JournalEntryBatchID: b.ID }, { provider, user });
    const after = (await pool.request().query(`SELECT Status, ExternalJournalEntryBatchRef ref FROM ${S}.JournalEntryBatch WHERE ID='${b.ID}'`)).recordset[0];
    console.log(`    dispatch Success=${res.Success}${res.ErrorMessage ? ' err=' + res.ErrorMessage : ''} -> Status=${after.Status} ref=${after.ref ?? 'null'}`);
    if (!res.Success || after.Status !== 'Posted') allDrained = false;
  }

  if (!allDrained) {
    console.log('\nSTEP 3 — SKIPPED: a batch did not drain. Leaving both accounts on Mock so nothing is armed');
    console.log('   re-run once the drain succeeds; the BC mapping is restored only on a clean drain');
  } else {
    console.log('\nSTEP 3 — restore the verified Business Central GUID mapping');
    await setMapping(md, user, pool, 'BusinessCentral', c => BC_MAP[c]);
  }

  const armed = (await pool.request().query(`
    SELECT je.EntryNumber, je.Status FROM ${S}.JournalEntry je
    JOIN ${S}.JournalEntryLine l ON l.JournalEntryID=je.ID
    JOIN ${S}.GLAccount a ON a.ID=l.GLAccountID
    WHERE a.ExternalSystem='BusinessCentral' AND je.Status <> 'GLPosted'
    GROUP BY je.EntryNumber, je.Status`)).recordset;
  console.log(`\nSTEP 4 — JEs still armed at Business Central (want 0): ${armed.length}`);
  if (armed.length) console.log(JSON.stringify(armed));
  const bc = (await pool.request().query(`SELECT Code, ExternalAccountID FROM ${S}.GLAccount WHERE ExternalSystem='BusinessCentral'`)).recordset;
  console.log(`accounts routing to Business Central: ${JSON.stringify(bc)}`);
  console.log(armed.length === 0 ? '\n✔ CLEAN — only deliberate future JEs can reach Business Central' : '\n✗ still armed, investigate');
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
