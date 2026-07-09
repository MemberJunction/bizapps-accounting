/**
 * _maint-post-stray.ts — one-off maintenance: sweep every currently-Pending JE into ONE batch and run it
 * through approve → send → Posted (mock ERP, AutoApproveGate). Clears the block2 harness clean-slate guard
 * by completing the demo order JE(s) lifecycle to GLPosted — good demo data (a fully-flowed order) per
 * plan §10. Idempotent-ish: does nothing when nothing is Pending. Run from the instance worktree root:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-post-stray.ts
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
import { buildBatch, approveBatch, sendBatch, AutoApproveGate } from '@mj-biz-apps/accounting-core-entities-server';

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
  const before = await rv.RunView<{ ID: string }>({ EntityName: 'MJ_BizApps_Accounting: Journal Entries', ExtraFilter: `Status='Pending'`, Fields: ['ID'], ResultType: 'simple', BypassCache: true }, user);
  const pending = before.Results ?? [];
  console.log(`Pending JEs before: ${pending.length}`);
  if (pending.length === 0) { finishAndExit('Nothing Pending — no-op.', 0, pool); return; }

  const built = await buildBatch('BusinessCentral', user.ID, user, AutoApproveGate);
  if (!built) { finishAndExit('buildBatch returned null (nothing netted).', 0, pool); return; }
  console.log(`Built batch ${built.batchId}: ${built.jeCount} JE(s), ${built.summaryLineCount} summary line(s), ${built.totalDebits}/${built.totalCredits}`);
  await approveBatch(built.batchId, user.ID, user);
  const posted = await sendBatch(built.batchId, user, { gate: AutoApproveGate });
  console.log(`Batch ${built.batchId} → ${posted.Status} (ref ${posted.ExternalBatchRef})`);
  finishAndExit(`Posted ${built.jeCount} previously-Pending JE(s). Clean slate for block2.`, 0, pool);
}

void main().catch(e => { console.error('MAINT ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(1); });
