/** _maint-check-fieldvalues.ts — READ-ONLY: print EntityFieldValues for the value-list fields we want to
 *  drive from metadata instead of hardcoding. Run from the instance worktree root. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite'; import '@mj-biz-apps/common-entities'; import '@mj-biz-apps/accounting-entities';

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const md = new Metadata();
  const checks: [string, string][] = [
    ['MJ_BizApps_Accounting: Journal Entry Batches', 'Status'],
    ['MJ_BizApps_Accounting: Journal Entry Batches', 'TargetSystem'],
    ['MJ_BizApps_Accounting: GL Accounts', 'AccountType'],
  ];
  for (const [ent, fld] of checks) {
    const e = md.EntityByName(ent);
    const f = e?.Fields?.find(x => x.Name === fld);
    const vals = (f?.EntityFieldValues ?? []).map(v => v.Value);
    console.log(`${ent} . ${fld}  ->  [${vals.join(', ')}]  (count=${vals.length})`);
  }
  await pool.close(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
