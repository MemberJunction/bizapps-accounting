/**
 * _maint-clean-batches.ts — one-off demo cleanup. Resolves STUCK batches (Pending + no approval task, so the
 * UI can't approve/reject them) and tidies the list:
 *   1. cancelJournalEntryBatch() each stuck batch  → its JEs unlock back to Pending, summaries deleted, batch → Cancelled
 *   2. buildJournalEntryBatch(NoApprovalWorkflowGate) → approve → send  → sweep all Pending JEs to Posted (can't re-stick)
 *   3. delete every empty Cancelled batch row  → list shows only real (Posted) batches
 * Run from the instance worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-clean-batches.ts
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { finishAndExit } from './harness-exit.js';
import { NoApprovalWorkflowGate } from './NoApprovalWorkflowGate.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { cancelJournalEntryBatch, buildJournalEntryBatch, approveJournalEntryBatch, sendJournalEntryBatch } from '@mj-biz-apps/accounting-core-entities-server';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

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
  const md = new Metadata();

  // ── 1. cancel stuck (Pending + no approval-task-link) batches ────────────────
  const [batches, links] = await Promise.all([
    rv.RunView<{ ID: string; Status: string }>({ EntityName: BATCH_ENTITY, Fields: ['ID', 'Status'], ResultType: 'simple', BypassCache: true }, user),
    rv.RunView<{ RecordID: string }>({ EntityName: TASK_LINK_ENTITY, Fields: ['RecordID'], ResultType: 'simple', BypassCache: true }, user),
  ]);
  const linked = new Set((links.Results ?? []).map(l => l.RecordID));
  const stuck = (batches.Results ?? []).filter(b => b.Status === 'Pending' && !linked.has(b.ID));
  console.log(`Stuck batches to cancel: ${stuck.length}`);
  for (const b of stuck) {
    await cancelJournalEntryBatch(b.ID, user);
    console.log(`  cancelled ${b.ID} (JEs freed → Pending)`);
  }

  // ── 2. sweep all Pending JEs into one fresh batch → Posted (NoApprovalWorkflowGate) ──
  const pend = await rv.RunView<{ ID: string }>({ EntityName: JE_ENTITY, ExtraFilter: `Status='Pending'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true }, user);
  const pendCount = (pend.Results ?? []).length;
  console.log(`Pending JEs to sweep: ${pendCount}`);
  if (pendCount > 0) {
    const built = await buildJournalEntryBatch('BusinessCentral', user.ID, user, NoApprovalWorkflowGate);
    if (built) {
      await approveJournalEntryBatch(built.batchId, user.ID, user);
      const posted = await sendJournalEntryBatch(built.batchId, user, { gate: NoApprovalWorkflowGate });
      console.log(`  swept ${built.jeCount} JE(s) → batch ${built.batchId} → ${posted.Status} (${posted.ExternalJournalEntryBatchRef})`);
    } else {
      console.log('  buildJournalEntryBatch netted nothing (JEs may not net to a balanced summary) — left Pending.');
    }
  }

  // ── 3. delete empty Cancelled batch rows ─────────────────────────────────────
  const cancelled = await rv.RunView<{ ID: string }>({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Cancelled'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true }, user);
  console.log(`Cancelled batch rows to delete: ${(cancelled.Results ?? []).length}`);
  let deleted = 0, kept = 0;
  for (const c of cancelled.Results ?? []) {
    const batch = await md.GetEntityObject<mjBizAppsAccountingJournalEntryBatchEntity>(BATCH_ENTITY, user);
    await batch.Load(c.ID);
    if (await batch.Delete()) { deleted++; console.log(`  deleted ${c.ID}`); }
    else { kept++; console.log(`  KEPT ${c.ID} (delete failed: ${batch.LatestResult?.CompleteMessage ?? 'unknown'})`); }
  }

  finishAndExit(`Done. Cancelled ${stuck.length} stuck; swept ${pendCount} Pending JE(s); deleted ${deleted} Cancelled row(s) (${kept} kept).`, 0, pool);
}
main().catch(e => { console.error(e); process.exit(1); });
