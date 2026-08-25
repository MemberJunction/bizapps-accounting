/** _maint-bc-discover-coa.ts — READ-ONLY: the sandbox's real chart of accounts + dimensions.
 *  Writes NOTHING. Use it to pick a real asset/liability pair before mapping GL accounts.
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-discover-coa.ts
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
  const F = (r: any, k: string) => r?.Fields?.[k];
  const fetch = async (obj: string, size = 2000): Promise<any[]> => {
    try { const r = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: obj, WatermarkValue: null, BatchSize: size, ContextUser: user });
      return r?.Records ?? r?.records ?? []; } catch (e) { console.log(`  [${obj}] FAILED: ${(e as Error).message.slice(0,110)}`); return []; }
  };

  console.log('=== accounts (chart of accounts) ===');
  const accts = await fetch('accounts');
  console.log(`  ${accts.length} rows`);
  const byCat: Record<string, any[]> = {};
  for (const a of accts) { const cat = String(F(a,'category') ?? F(a,'accountType') ?? '(none)'); (byCat[cat] ??= []).push(a); }
  for (const [cat, rows] of Object.entries(byCat)) {
    console.log(`\n  -- ${cat} (${rows.length}) --`);
    for (const a of rows.slice(0, 99)) {
      console.log(`     ${String(F(a,'number')).padEnd(8)} ${String(F(a,'displayName')).slice(0,38).padEnd(40)} blocked=${F(a,'blocked')} directPost=${F(a,'directPosting')}  id=${F(a,'id')}`);
    }
    if (rows.length > 99) console.log(`     … ${rows.length - 14} more`);
  }

  for (const obj of ['dimensions', 'dimensionValues']) {
    console.log(`\n=== ${obj} ===`);
    const rows = await fetch(obj);
    console.log(`  ${rows.length} rows`);
    for (const d of rows.slice(0, 25)) {
      console.log(`     code=${String(F(d,'code')).padEnd(14)} display=${String(F(d,'displayName')).slice(0,30).padEnd(32)} dimId=${F(d,'dimensionId') ?? '-'}  id=${F(d,'id')}`);
    }
    if (rows.length > 25) console.log(`     … ${rows.length - 25} more`);
  }
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
