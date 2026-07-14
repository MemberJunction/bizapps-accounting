/** _maint-make-pending.ts — create N balanced Pending JEs on the first company's AR/Rev accounts, for a
 *  live reject/regenerate demo. Prints the JE ids. Run from instance worktree root. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata, RunView } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { finishAndExit } from './harness-exit.js';
import '@memberjunction/server-bootstrap-lite'; import '@mj-biz-apps/common-entities'; import '@mj-biz-apps/accounting-entities'; import '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingJournalEntryEntity, mjBizAppsAccountingJournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';
const N = Number(process.argv[2] ?? 2);
async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const S = '__mj_BizAppsAccounting';
  const gl = (await pool.request().query(`SELECT TOP 1 ar.CompanyID cid, ar.ID arID, rev.ID revID FROM ${S}.GLAccount ar JOIN ${S}.GLAccount rev ON rev.CompanyID=ar.CompanyID AND rev.Code='40100' WHERE ar.Code='11201'`)).recordset[0];
  if (!gl) throw new Error('no demo company with 11201/40100 GL accounts found');
  const md = new Metadata(); const ids: string[] = [];
  for (let i = 0; i < N; i++) {
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>('MJ_BizApps_Accounting: Journal Entries', user);
    je.NewRecord(); je.CompanyID = gl.cid; je.EffectiveDate = new Date(); je.EntryType = 'Manual'; je.Status = 'Pending'; je.Description = `REJECT-DEMO ${i + 1}`;
    if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
    for (const [gid, dr, cr] of [[gl.arID, 100, null], [gl.revID, null, 100]] as [string, number|null, number|null][]) {
      const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>('MJ_BizApps_Accounting: Journal Entry Lines', user);
      l.NewRecord(); l.JournalEntryID = je.ID; l.LineNumber = dr ? 1 : 2; l.GLAccountID = gid; l.DebitAmount = dr; l.CreditAmount = cr;
      if (!(await l.Save())) throw new Error(`line save failed: ${l.LatestResult?.CompleteMessage}`);
    }
    ids.push(je.ID);
  }
  console.log(`CREATED ${ids.length} pending JE(s): ${ids.join(',')}`);
  finishAndExit('done', 0, pool);
}
void main().catch(e => { console.error('ERR', e instanceof Error ? e.message : String(e)); process.exit(1); });
