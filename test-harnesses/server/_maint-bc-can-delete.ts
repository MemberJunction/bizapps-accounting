/** Can this service principal delete journal LINES (vs the journal container)?
 *  Decides whether adapter rollback / anti-accumulation cleanup is possible at all in this tenant. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';
const F = (r: any, k: string) => r?.Fields?.[k];
async function main(): Promise<void> {
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

  const js = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journals', WatermarkValue: null, BatchSize: 500, ContextUser: user });
  const j = (js.Records ?? []).find((r: any) => String(F(r, 'code')).trim().toUpperCase() === 'AIDPSTAGE');
  if (!j) { console.log('AIDPSTAGE not present'); await pool.close(); return; }
  const jid = String(F(j, 'id'));
  const jl = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journalLines', WatermarkValue: null, BatchSize: 5000, ContextUser: user });
  const mine = (jl.Records ?? []).filter((r: any) => String(F(r, 'journalId')) === jid);
  console.log(`AIDPSTAGE id=${jid} · staged lines=${mine.length}`);

  for (const r of mine) {
    const id = String(F(r, 'id') ?? (r as any).ExternalID);
    const del = await c.DeleteRecord({ CompanyIntegration: ci, ObjectName: 'journalLines', ContextUser: user, ExternalID: id });
    console.log(`  DELETE journalLine ${id}: Success=${del.Success} HTTP=${del.StatusCode} ${del.ErrorMessage ?? ''}`);
  }
  const after = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journalLines', WatermarkValue: null, BatchSize: 5000, ContextUser: user });
  console.log(`\nlines remaining in AIDPSTAGE: ${(after.Records ?? []).filter((r: any) => String(F(r, 'journalId')) === jid).length}`);
  const del2 = await c.DeleteRecord({ CompanyIntegration: ci, ObjectName: 'journals', ContextUser: user, ExternalID: jid });
  console.log(`DELETE empty journal AIDPSTAGE: Success=${del2.Success} HTTP=${del2.StatusCode} ${del2.ErrorMessage ?? ''}`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
