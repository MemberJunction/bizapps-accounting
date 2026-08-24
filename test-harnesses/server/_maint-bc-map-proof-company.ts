/** _maint-bc-map-proof-company.ts — point ONE clean company's AR + Revenue at Business Central.
 *
 *  Chosen host: "Assoc Demo — Cascadia Chapter" — has 11201 + 40100, ZERO open batches and ZERO
 *  non-GLPosted JEs, so mapping it to BC cannot arm any pre-existing demo data. Northwind's pair
 *  stays on Mock, which keeps BATCH-000009 (Approved, blocked on its approval Task) inert.
 *
 *  Asserts afterwards that the ONLY things routing to Business Central are these two accounts,
 *  and that NO existing JE is armed.  Writes NOTHING to Business Central.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/tasks-entities';

const COMPANY = 'A55C0DE1-0002-4000-8000-000000000002';   // Assoc Demo — Cascadia Chapter
const BC_MAP: Record<string, { guid: string; bc: string }> = {
  '11201': { guid: 'b7abc1de-6cb7-eb11-9b52-000d3aec3ef4', bc: '11203 Accounts Receivable' },
  '40100': { guid: '5c725174-57c9-eb11-9f0a-000d3aec3ef4', bc: '41300 Membership Revenue' },
};
const S = '__mj_BizAppsAccounting';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();
  const coName = (await pool.request().query(`SELECT Name FROM __mj.Company WHERE ID='${COMPANY}'`)).recordset[0]?.Name;
  console.log(`host company: ${coName} (${COMPANY})`);

  for (const [code, t] of Object.entries(BC_MAP)) {
    const row = (await pool.request().query(`SELECT ID, Name FROM ${S}.GLAccount WHERE CompanyID='${COMPANY}' AND Code='${code}'`)).recordset[0];
    if (!row) throw new Error(`no GL account ${code} on ${coName}`);
    const a = await md.GetEntityObject<any>('MJ_BizApps_Accounting: GL Accounts', user);
    await a.Load(row.ID);
    a.ExternalSystem = 'BusinessCentral';
    a.ExternalAccountID = t.guid;
    if (!(await a.Save())) throw new Error(`save ${code}: ${a.LatestResult?.CompleteMessage}`);
    console.log(`  ✔ ${code} ${String(row.Name).padEnd(22)} -> BC ${t.bc}  ${t.guid}`);
  }

  const bc = (await pool.request().query(`
    SELECT a.Code, a.ExternalAccountID, c.Name company
    FROM ${S}.GLAccount a JOIN __mj.Company c ON c.ID = a.CompanyID
    WHERE a.ExternalSystem='BusinessCentral' ORDER BY c.Name, a.Code`)).recordset;
  console.log(`\naccounts routing to Business Central (want exactly 2, both on ${coName}):`);
  for (const r of bc) console.log(`  ${r.Code}  ${r.company}  ${r.ExternalAccountID}`);

  const armed = (await pool.request().query(`
    SELECT je.EntryNumber, je.Status FROM ${S}.JournalEntry je
    JOIN ${S}.JournalEntryLine l ON l.JournalEntryID=je.ID
    JOIN ${S}.GLAccount a ON a.ID=l.GLAccountID
    WHERE a.ExternalSystem='BusinessCentral' AND je.Status <> 'GLPosted'
    GROUP BY je.EntryNumber, je.Status`)).recordset;
  console.log(`\npre-existing JEs armed at Business Central (want 0): ${armed.length}${armed.length ? ' ' + JSON.stringify(armed) : ''}`);
  const ok = bc.length === 2 && armed.length === 0;
  console.log(ok ? '\n✔ READY — a clean, isolated BC target with nothing legacy armed' : '\n✗ NOT READY');
  if (!ok) process.exit(1);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
