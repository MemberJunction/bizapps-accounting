/**
 * _maint-list-batches.ts — READ-ONLY diagnostic. Lists every JE batch with its status, the # of JEs
 * currently pointing at it, and whether it has an approval Task Link (no link → the UI can't approve/
 * reject it). Run from the instance worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-list-batches.ts
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { RunView } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { finishAndExit } from './harness-exit.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const TASK_LINK_ENTITY = 'MJ_BizApps_Tasks: Task Links';

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

  const rv = new RunView();
  const batches = await rv.RunView<{ ID: string; BatchNumber: string; Status: string; TargetSystem: string; ExternalBatchRef: string | null; TotalEntries: number; BatchedAt: string | null }>(
    { EntityName: BATCH_ENTITY, OrderBy: 'BatchedAt ASC', ResultType: 'simple', BypassCache: true }, user);
  const jes = await rv.RunView<{ BatchID: string | null; Status: string }>(
    { EntityName: JE_ENTITY, ExtraFilter: 'BatchID IS NOT NULL', Fields: ['BatchID', 'Status'], ResultType: 'simple', BypassCache: true }, user);
  const links = await rv.RunView<{ RecordID: string }>(
    { EntityName: TASK_LINK_ENTITY, Fields: ['RecordID'], ResultType: 'simple', BypassCache: true }, user);

  const jeByBatch = new Map<string, number>();
  for (const j of jes.Results ?? []) if (j.BatchID) jeByBatch.set(j.BatchID, (jeByBatch.get(j.BatchID) ?? 0) + 1);
  const linkedBatchIds = new Set((links.Results ?? []).map(l => l.RecordID));

  console.log(`\nTotal batches: ${(batches.Results ?? []).length}\n`);
  console.log('Status       | JEs | Task? | BatchedAt            | ExternalRef            | ID');
  console.log('-------------|-----|-------|----------------------|------------------------|------');
  const stuck: string[] = [];
  for (const b of batches.Results ?? []) {
    const jeCount = jeByBatch.get(b.ID) ?? 0;
    const hasTask = linkedBatchIds.has(b.ID);
    const isStuck = b.Status === 'Pending' && !hasTask;
    if (isStuck) stuck.push(b.ID);
    console.log(
      `${(b.Status ?? '').padEnd(12)} | ${String(jeCount).padStart(3)} | ${(hasTask ? 'yes' : 'NO').padEnd(5)} | ${(b.BatchedAt ? new Date(b.BatchedAt).toISOString().slice(0, 19) : '').padEnd(20)} | ${(b.ExternalBatchRef ?? '—').padEnd(22)} | ${b.ID}${isStuck ? '   <-- STUCK (Pending, no approval task)' : ''}`,
    );
  }
  console.log(`\nStuck (Pending + no approval task, can't approve/reject in UI): ${stuck.length}`);
  if (stuck.length) console.log(stuck.join('\n'));
  finishAndExit('Diagnostic complete (read-only).', 0, pool);
}
main().catch(e => { console.error(e); process.exit(1); });
