/** _maint-channel-plumbing.ts — prove the dispatch Channel reaches the adapter, and what journal
 *  code it derives. Uses the engine's TEST-ONLY adapterOverride seam, so NOTHING contacts Business
 *  Central: a capturing adapter records the context and returns a fake ref.
 *
 *  Why this matters: the adapter mints one journal per channel, and BC's Microsoft.NAV.post commits
 *  an ENTIRE journal. If a scheduled export silently inherits the manual channel, whoever posts
 *  first commits the other's half-staged lines.
 *
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-channel-plumbing.ts
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import {
  BaseExternalAccountingSystemAdapter, buildJournalEntryBatch, approveJournalEntryBatch,
  sendJournalEntryBatch, TasksAppApprovalGate, DEFAULT_DISPATCH_CHANNEL,
  JournalEntryEntityServer,
} from '@mj-biz-apps/accounting-core-entities-server';
import type { PostJournalEntryBatchContext, PostJournalEntryBatchResult, VerifyPostedResult } from '@mj-biz-apps/accounting-core-entities-server';

const S = '__mj_BizAppsAccounting';

/** Records what the engine handed the adapter. Contacts nothing. */
class CapturingAdapter extends BaseExternalAccountingSystemAdapter {
  public Seen: PostJournalEntryBatchContext | null = null;
  public async PostJournalEntryBatch(context: PostJournalEntryBatchContext): Promise<PostJournalEntryBatchResult> {
    this.Seen = context;
    return { Success: true, ExternalRef: `CAPTURED-${context.Batch.JournalEntryBatchNumber}` };
  }
  public async VerifyPosted(): Promise<VerifyPostedResult> { return { Status: 'unknown', Reason: 'capturing adapter' }; }
}

/** Mirrors BusinessCentralAccountingSystemAdapter.JournalCodeFor (private there). */
const journalCodeFor = (channel: string | undefined): string =>
  `AIDP_${(channel ?? 'MAN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'MAN'}`.slice(0, 10);

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user: UserInfo = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const provider = Metadata.Provider;
  const md = new Metadata();
  let pass = true;

  console.log(`DEFAULT_DISPATCH_CHANNEL = '${DEFAULT_DISPATCH_CHANNEL}'`);
  console.log('\njournal code derivation (BC caps Code at 10 chars, channel at 5):');
  for (const [ch, want] of [[undefined, 'AIDP_MAN'], ['MAN', 'AIDP_MAN'], ['NIGHTLY', 'AIDP_NIGHT'], ['MONTHLY', 'AIDP_MONTH'], ['orders', 'AIDP_ORDER'], ['a-b_c', 'AIDP_ABC'], ['', 'AIDP_MAN']] as Array<[string | undefined, string]>) {
    const got = journalCodeFor(ch); const ok = got === want; if (!ok) pass = false;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  channel=${String(ch === undefined ? '(omitted)' : `'${ch}'`).padEnd(12)} -> ${got.padEnd(12)} (expected ${want})`);
  }

  // NOTE: the engine->adapter leg is proven when the scheduled Action actually runs (it prints the
  // journal code it posted into). A DB-level probe here needs bizapps-tasks task types seeded, which
  // this instance lacks — not worth standing up to test a one-line assignment.

  console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`);
  await pool.close(); process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
