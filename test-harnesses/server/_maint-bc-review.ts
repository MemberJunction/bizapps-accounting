/** _maint-bc-review.ts — READ-ONLY substitute for the BC web UI.
 *  Renders what the General Journals page would show for a batch (lines + resolved account
 *  names + total balance), and proves whether anything with our document prefix has reached
 *  the general ledger. Writes NOTHING.
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-review.ts [journalCode] [docPrefix]
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';
const F = (r: any, k: string) => r?.Fields?.[k];

async function main(): Promise<void> {
  const code = (process.argv[2] ?? 'AIDPSTAGE').toUpperCase();
  const prefix = (process.argv[3] ?? 'AIDP').toUpperCase();
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();
  const ig = (await pool.request().query(`SELECT ID FROM __mj.Integration WHERE ClassName='BusinessCentralConnector'`)).recordset[0];
  const integ = await md.GetEntityObject<any>('MJ: Integrations', user); await integ.Load(ig.ID);
  const cir = (await pool.request().query(`SELECT TOP 1 ID FROM __mj.CompanyIntegration WHERE IntegrationID='${ig.ID}' AND IsActive=1`)).recordset[0];
  const ci = await md.GetEntityObject<any>('MJ: Company Integrations', user); await ci.Load(cir.ID);
  const c: any = ConnectorFactory.Resolve(integ);

  const accts = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'accounts', WatermarkValue: null, BatchSize: 2000, ContextUser: user });
  const nameOf = new Map<string, string>();
  for (const a of (accts.Records ?? [])) nameOf.set(String(F(a, 'number')).trim(), String(F(a, 'displayName')));

  const js = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journals', WatermarkValue: null, BatchSize: 500, ContextUser: user });
  const j = (js.Records ?? []).find((r: any) => String(F(r, 'code')).trim().toUpperCase() === code);
  console.log(`=== GENERAL JOURNALS · Batch Name: ${code} ===`);
  if (!j) { console.log('  batch does NOT exist (deleted, or never created)'); }
  else {
    const jid = String(F(j, 'id'));
    console.log(`  displayName: ${F(j, 'displayName')}`);
    const jl = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journalLines', WatermarkValue: null, BatchSize: 5000, ContextUser: user });
    const mine = (jl.Records ?? []).filter((r: any) => String(F(r, 'journalId')) === jid);
    console.log(`\n  Posting Date  Document No.      Account No.  Account Name                    Amount   Description`);
    console.log(`  ------------  ----------------  -----------  ------------------------------  -------  -----------`);
    let bal = 0;
    for (const r of mine) {
      const acct = String(F(r, 'accountNumber') ?? '');
      const amt = Number(F(r, 'amount') ?? 0); bal += amt;
      console.log(`  ${String(F(r, 'postingDate')).slice(0, 10)}    ${String(F(r, 'documentNumber') ?? '').padEnd(16)}  ${acct.padEnd(11)}  ${(nameOf.get(acct) ?? '?').slice(0, 30).padEnd(30)}  ${amt.toFixed(2).padStart(7)}  ${F(r, 'description') ?? ''}`);
    }
    console.log(`\n  Total Balance: ${bal.toFixed(2)}   ${bal === 0 ? '(0.00 — BC will accept a post)' : '(NON-ZERO — BC would refuse the post)'}`);
    console.log(`  Lines: ${mine.length}`);
  }

  console.log(`\n=== GENERAL LEDGER ENTRIES · Document No. starts with "${prefix}" ===`);
  const gl = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'generalLedgerEntries', WatermarkValue: null, BatchSize: 100000, ContextUser: user });
  const hits = (gl.Records ?? []).filter((r: any) => String(F(r, 'documentNumber') ?? '').toUpperCase().startsWith(prefix));
  if (!hits.length) console.log(`  NONE — nothing with the "${prefix}" prefix has reached the general ledger.`);
  for (const r of hits) console.log(`  ${String(F(r, 'postingDate')).slice(0, 10)}  ${F(r, 'documentNumber')}  acct=${F(r, 'accountNumber')}  dr=${F(r, 'debitAmount')} cr=${F(r, 'creditAmount')}  ${F(r, 'description') ?? ''}`);
  console.log(`\n  (searched ${(gl.Records ?? []).length} ledger entries)`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
