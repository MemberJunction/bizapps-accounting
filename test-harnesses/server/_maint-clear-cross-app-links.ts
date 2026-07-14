/**
 * _maint-clear-cross-app-links.ts — MAINTENANCE: delete cross-app rows that point at
 * __mj_BizAppsAccounting entities via hard FKs into __mj.Entity, which otherwise block
 * `mjdev app drop-schema` (same gap as the orders-side script; filed in ~/MJDev/MJDEV-ISSUES.md).
 * Known blockers here: bizapps-tasks TaskLink.EntityID (approval tasks link JE batches),
 * TaskAssignment.AssigneeEntityID, bizapps-common AddressLink.EntityID.
 * All are regenerable demo/workflow data. Run BEFORE each accounting drop-schema.
 *
 * Run from the instance worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-clear-cross-app-links.ts
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { BaseEntity, Metadata, RunView } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/tasks-entities';

const TARGET_SCHEMA = '__mj_BizAppsAccounting';
const LINK_SPECS: ReadonlyArray<{ entityName: string; fkField: string }> = [
  { entityName: 'MJ_BizApps_Tasks: Task Links', fkField: 'EntityID' },
  { entityName: 'MJ_BizApps_Tasks: Task Assignments', fkField: 'AssigneeEntityID' },
  { entityName: 'MJ_BizApps_Common: Address Links', fkField: 'EntityID' },
];

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 1433),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!user) throw new Error('no context user');

  const md = new Metadata();
  const targetEntityIDs = md.Entities.filter(e => e.SchemaName === TARGET_SCHEMA).map(e => e.ID);
  if (targetEntityIDs.length === 0) { console.log(`No ${TARGET_SCHEMA} entities registered — nothing to clear.`); await pool.close(); process.exit(0); }
  const inList = targetEntityIDs.map(id => `'${id}'`).join(',');

  let failures = 0;
  for (const spec of LINK_SPECS) {
    if (!md.EntityByName(spec.entityName)) { console.log(`${spec.entityName}: not installed — skipped`); continue; }
    const rows = await new RunView().RunView<{ ID: string }>(
      { EntityName: spec.entityName, ExtraFilter: `${spec.fkField} IN (${inList})`, Fields: ['ID'], ResultType: 'simple', BypassCache: true }, user);
    const ids = (rows.Results ?? []).map(r => r.ID);
    console.log(`${spec.entityName} (${spec.fkField}): ${ids.length} row(s) pointing at ${TARGET_SCHEMA} entities`);
    for (const id of ids) {
      const rec: BaseEntity = await md.GetEntityObject(spec.entityName, user);
      await rec.Load(id);
      const ok = await rec.Delete();
      if (!ok) { failures++; console.error(`  FAILED to delete ${id}: ${rec.LatestResult?.CompleteMessage ?? 'unknown'}`); }
      else console.log(`  deleted ${id}`);
    }
  }
  await pool.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
