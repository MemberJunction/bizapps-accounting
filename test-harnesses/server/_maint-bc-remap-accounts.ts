/** _maint-bc-remap-accounts.ts — replace the fabricated BusinessCentral account mapping.
 *
 *  WHY: 10 GL accounts carried ExternalSystem='BusinessCentral' with the ACCOUNT NUMBER in
 *  ExternalAccountID. Verified against the live tenant, only 2 of those numbers exist there, and
 *  one (21301) maps to a completely different account ("Deferred Revenue" here vs "Guaranteed Loan
 *  from Subs" in BC). Routing is account-driven, so ANY batch built on these would have routed
 *  itself to Business Central and posted into wrong accounts.
 *
 *  WHAT (our DB only — writes NOTHING to Business Central):
 *    1. every ExternalSystem='BusinessCentral' account -> 'Mock' (safe: cannot reach BC)
 *    2. then ONE company's 11201 + 40100 -> 'BusinessCentral' with REAL verified BC GUIDs
 *  Reversible; all writes go through BaseEntity so validation + audit apply.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';

/** Verified present + postable in the live tenant (accountType=Posting, !blocked, directPosting). */
const BC_TARGETS: Record<string, { guid: string; bcNumber: string; bcName: string }> = {
  '11201': { guid: 'b7abc1de-6cb7-eb11-9b52-000d3aec3ef4', bcNumber: '11203', bcName: 'Accounts Receivable' },
  '40100': { guid: '5c725174-57c9-eb11-9f0a-000d3aec3ef4', bcNumber: '41300', bcName: 'Membership Revenue' },
};

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();
  const S = '__mj_BizAppsAccounting';
  const E = 'MJ_BizApps_Accounting: GL Accounts';

  const before = (await pool.request().query(`SELECT ID, CompanyID, Code, Name, ExternalSystem, ExternalAccountID FROM ${S}.GLAccount WHERE ExternalSystem='BusinessCentral' ORDER BY Code`)).recordset;
  console.log(`STEP 1 — demoting ${before.length} fabricated BusinessCentral mappings to Mock`);
  for (const r of before) {
    const a = await md.GetEntityObject<any>(E, user);
    if (!(await a.Load(r.ID))) throw new Error(`load failed ${r.ID}`);
    a.ExternalSystem = 'Mock';
    a.ExternalAccountID = `MOCK-${r.Code}`;
    if (!(await a.Save())) throw new Error(`save failed ${r.Code}: ${a.LatestResult?.CompleteMessage}`);
  }
  console.log(`  ✔ ${before.length} accounts now ExternalSystem='Mock' — none can route to Business Central`);

  // pick ONE company that has BOTH target codes, deterministically (lowest CompanyID)
  const co = (await pool.request().query(`
    SELECT TOP 1 ar.CompanyID cid
    FROM ${S}.GLAccount ar
    JOIN ${S}.GLAccount rev ON rev.CompanyID = ar.CompanyID AND rev.Code = '40100'
    WHERE ar.Code = '11201' ORDER BY ar.CompanyID`)).recordset[0];
  if (!co) throw new Error('no company carries both 11201 and 40100');
  let coName = '(unknown)';
  for (const q of [`SELECT Name FROM __mj.Company WHERE ID='${co.cid}'`, `SELECT Name FROM __mj_BizAppsCommon.Company WHERE ID='${co.cid}'`]) {
    try { const n = (await pool.request().query(q)).recordset[0]?.Name; if (n) { coName = n; break; } } catch { /* schema not present */ }
  }
  console.log(`\nSTEP 2 — mapping ONE company's pair to real BC GUIDs · company=${coName} (${co.cid})`);
  for (const [code, t] of Object.entries(BC_TARGETS)) {
    const row = (await pool.request().query(`SELECT ID, Name FROM ${S}.GLAccount WHERE CompanyID='${co.cid}' AND Code='${code}'`)).recordset[0];
    if (!row) throw new Error(`company ${co.cid} has no GL account ${code}`);
    const a = await md.GetEntityObject<any>(E, user);
    await a.Load(row.ID);
    a.ExternalSystem = 'BusinessCentral';
    a.ExternalAccountID = t.guid;
    if (!(await a.Save())) throw new Error(`save failed ${code}: ${a.LatestResult?.CompleteMessage}`);
    console.log(`  ✔ ${code} ${String(row.Name).padEnd(24)} -> BC ${t.bcNumber} "${t.bcName}"  ${t.guid}`);
  }

  const after = (await pool.request().query(`SELECT Code, Name, ExternalSystem, ExternalAccountID FROM ${S}.GLAccount WHERE ExternalSystem IS NOT NULL ORDER BY ExternalSystem DESC, Code`)).recordset;
  const bc = after.filter(r => r.ExternalSystem === 'BusinessCentral');
  console.log(`\nFINAL: ${bc.length} account(s) route to Business Central (expected exactly 2):`);
  for (const r of bc) console.log(`  ${r.Code} ${String(r.Name).padEnd(24)} extID=${r.ExternalAccountID}`);
  console.log(`         ${after.length - bc.length} account(s) route to Mock`);

  const exposure = (await pool.request().query(`
    SELECT je.Status, COUNT(DISTINCT je.ID) jes FROM ${S}.JournalEntry je
    JOIN ${S}.JournalEntryLine l ON l.JournalEntryID=je.ID
    JOIN ${S}.GLAccount a ON a.ID=l.GLAccountID
    WHERE a.ExternalSystem='BusinessCentral' GROUP BY je.Status`)).recordset;
  console.log(`\nJEs now touching a BusinessCentral account, by status: ${JSON.stringify(exposure)}`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
