/**
 * _maint-delete-stray-pending.ts — DELETE every currently-Pending journal entry (its line dimensions →
 * lines → the JE, FK-order, via the entity layer). The counterpart to _maint-post-stray.ts (which POSTS
 * strays to GLPosted): use DELETE when the strays are throwaway scratch you want GONE rather than kept as
 * demo data — e.g. manual "test" JEs, or the order-to-JE teardown-gap orphans (payment-capture JEs with
 * no OrderID) that recur and trip the batching harnesses' clean-slate guards.
 *
 * SAFE-BY-SCOPE: only touches Status='Pending' rows — never a Batched/Approved/Posted (locked) entry, and
 * never a batch. Pending is the unbatched candidate pool, so deleting one loses no committed accounting.
 * Still: this is DESTRUCTIVE for whatever Pending drafts exist — run it deliberately, not on a whim.
 *
 * Run from the instance worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-delete-stray-pending.ts
 * Exit: 0 done (incl. no-op) · 1 error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { Metadata, RunView } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import { finishAndExit } from './harness-exit.js';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';

const JE = 'MJ_BizApps_Accounting: Journal Entries';
const JEL = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

async function deleteJournalEntry(md: Metadata, rv: RunView, jeId: string, user: Parameters<Metadata['GetEntityObject']>[1]): Promise<void> {
  // FK-order teardown: line dimensions → lines → the JE (each via its typed entity so triggers/hooks fire).
  const lines = await rv.RunView<{ ID: string }>(
    { EntityName: JEL, ExtraFilter: `JournalEntryID='${jeId}'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true }, user);
  for (const l of lines.Results ?? []) {
    const dims = await rv.RunView<{ ID: string }>(
      { EntityName: JELD, ExtraFilter: `JournalEntryLineID='${l.ID}'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true }, user);
    for (const d of dims.Results ?? []) {
      const dim = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineDimensionEntity>(JELD, user);
      await dim.Load(d.ID);
      if (!(await dim.Delete())) throw new Error(`delete line-dimension ${d.ID} failed: ${dim.LatestResult?.CompleteMessage ?? 'unknown'}`);
    }
    const line = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL, user);
    await line.Load(l.ID);
    if (!(await line.Delete())) throw new Error(`delete line ${l.ID} failed: ${line.LatestResult?.CompleteMessage ?? 'unknown'}`);
  }
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE, user);
  await je.Load(jeId);
  if (!(await je.Delete())) throw new Error(`delete JE ${jeId} failed: ${je.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

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
  const rv = new RunView();
  const pending = await rv.RunView<{ ID: string; EntryNumber: string; Description: string | null }>(
    { EntityName: JE, ExtraFilter: `Status='Pending'`, Fields: ['ID', 'EntryNumber', 'Description'], ResultType: 'simple', BypassCache: true }, user);
  const rows = pending.Results ?? [];
  console.log(`Pending JEs to delete: ${rows.length}`);
  if (rows.length === 0) { finishAndExit('Nothing Pending — no-op.', 0, pool); return; }

  for (const r of rows) {
    await deleteJournalEntry(md, rv, r.ID, user);
    console.log(`  deleted ${r.EntryNumber}${r.Description ? ` ("${r.Description}")` : ''}`);
  }
  finishAndExit(`Deleted ${rows.length} stray Pending JE(s).`, 0, pool);
}

void main().catch(e => { console.error('MAINT ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(1); });
