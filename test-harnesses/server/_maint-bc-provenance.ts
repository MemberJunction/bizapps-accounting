/** _maint-bc-provenance.ts — READ-ONLY: is this BC environment a live-business ledger or a test sandbox?
 *  Writes NOTHING. Samples recent generalLedgerEntries and characterises them, and reports our own
 *  JE/batch exposure to the fabricated BusinessCentral account mapping.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();
  const integRow = (await pool.request().query(`SELECT ID FROM __mj.Integration WHERE ClassName='BusinessCentralConnector'`)).recordset[0];
  const integ = await md.GetEntityObject<any>('MJ: Integrations', user); await integ.Load(integRow.ID);
  const ciRow = (await pool.request().query(`SELECT TOP 1 ID FROM __mj.CompanyIntegration WHERE IntegrationID='${integRow.ID}' AND IsActive=1`)).recordset[0];
  const ci = await md.GetEntityObject<any>('MJ: Company Integrations', user); await ci.Load(ciRow.ID);
  const c: any = ConnectorFactory.Resolve(integ);

  const gl = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'generalLedgerEntries', WatermarkValue: null, BatchSize: 100000, ContextUser: user });
  const recs: any[] = gl.Records ?? [];
  const F = (r: any, k: string) => r?.Fields?.[k];
  console.log(`generalLedgerEntries fetched: ${recs.length} · watermark=${gl.NewWatermarkValue}`);

  const dated = recs.map(r => ({ d: String(F(r, 'postingDate') ?? '').slice(0, 10), doc: String(F(r, 'documentNumber') ?? ''), desc: String(F(r, 'description') ?? ''), dr: Number(F(r, 'debitAmount') ?? 0), cr: Number(F(r, 'creditAmount') ?? 0), acct: String(F(r, 'accountNumber') ?? '') })).filter(x => x.d);
  const byYear: Record<string, number> = {};
  for (const x of dated) { const y = x.d.slice(0, 4); byYear[y] = (byYear[y] ?? 0) + 1; }
  console.log(`\nentries per posting-date YEAR: ${JSON.stringify(Object.fromEntries(Object.entries(byYear).sort()))}`);

  const sorted = [...dated].sort((a, b) => a.d < b.d ? 1 : -1);
  console.log(`\n25 MOST RECENT entries (postingDate · documentNumber · dr/cr · account · description):`);
  for (const x of sorted.slice(0, 25)) console.log(`  ${x.d}  ${x.doc.padEnd(22)} ${String(x.dr || -x.cr).padStart(12)}  ${x.acct.padEnd(8)} ${x.desc.slice(0, 42)}`);

  const total = dated.reduce((s, x) => s + Math.abs(x.dr) + Math.abs(x.cr), 0);
  const testish = dated.filter(x => /test|dummy|aidp|sample|demo|xxx|zzz/i.test(x.doc + ' ' + x.desc)).length;
  console.log(`\ntotal absolute amount across all entries: ${total.toLocaleString()}`);
  console.log(`entries whose doc/description looks test-ish: ${testish} of ${dated.length}`);
  console.log(`distinct documentNumber prefixes (top 12): ${JSON.stringify(Object.entries(dated.reduce((m: any, x) => { const p = x.doc.replace(/[0-9]+$/, '') || '(numeric)'; m[p] = (m[p] ?? 0) + 1; return m; }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 12))}`);

  // ── our exposure to the fabricated mapping ──
  const S = '__mj_BizAppsAccounting';
  const exposure = (await pool.request().query(`
    SELECT je.Status, COUNT(DISTINCT je.ID) jes
    FROM ${S}.JournalEntry je
    JOIN ${S}.JournalEntryLine l ON l.JournalEntryID = je.ID
    JOIN ${S}.GLAccount a ON a.ID = l.GLAccountID
    WHERE a.ExternalSystem = 'BusinessCentral'
    GROUP BY je.Status`)).recordset;
  console.log(`\nour JEs touching a BusinessCentral-mapped account, by status: ${JSON.stringify(exposure)}`);
  const batches = (await pool.request().query(`SELECT Status, COUNT(*) n FROM ${S}.JournalEntryBatch GROUP BY Status`)).recordset;
  console.log(`our JournalEntryBatch rows by status: ${JSON.stringify(batches)}`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
