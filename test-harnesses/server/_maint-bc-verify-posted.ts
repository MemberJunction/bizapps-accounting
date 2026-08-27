/** _maint-bc-verify-posted.ts — READ-ONLY: exercise the adapter's VerifyPosted probe.
 *
 *  Writes NOTHING, to our DB or to Business Central. Drives the REAL adapter method through the
 *  real ConnectorFactory resolution, so it also proves the AccountingBusinessCentralConnector
 *  subclass actually wins registration — if it does not, VerifyPosted returns 'unknown' by design.
 *
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-verify-posted.ts
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { ConnectorFactory } from '@memberjunction/integration-engine';
import { ResolveExternalAccountingSystemAdapter } from '@mj-biz-apps/accounting-core-entities-server';

const S = '__mj_BizAppsAccounting';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user: UserInfo = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();

  // 1. Does the subclass win ClassFactory resolution?
  const integRow = (await pool.request().query(`SELECT ID FROM __mj.Integration WHERE ClassName='BusinessCentralConnector'`)).recordset[0];
  const integ = await md.GetEntityObject<any>('MJ: Integrations', user); await integ.Load(integRow.ID);
  const resolvedName = ConnectorFactory.Resolve(integ).constructor.name;
  const regOk = resolvedName === 'AccountingBusinessCentralConnector';
  console.log(`registration: ConnectorFactory resolved '${resolvedName}'  ${regOk ? 'PASS — the accounting subclass wins' : 'FAIL — the base connector wins; VerifyPosted will return unknown'}`);

  // 2. Drive VerifyPosted through the real adapter for known-posted and known-absent documents.
  const sys = await md.GetEntityObject<any>('MJ_BizApps_Accounting: External Accounting Systems', user);
  const sysRow = (await pool.request().query(`SELECT ID FROM ${S}.ExternalAccountingSystem WHERE Name='BusinessCentral'`)).recordset[0];
  await sys.Load(sysRow.ID);
  const batchRow = (await pool.request().query(`SELECT TOP 1 ID FROM ${S}.JournalEntryBatch WHERE Status='Posted' ORDER BY JournalEntryBatchNumber DESC`)).recordset[0];
  const batch = await md.GetEntityObject<any>('MJ_BizApps_Accounting: Journal Entry Batches', user); await batch.Load(batchRow.ID);
  const resolvedAdapter = await ResolveExternalAccountingSystemAdapter('BusinessCentral', user, Metadata.Provider);
  const adapter = resolvedAdapter.Adapter;
  console.log(`adapter: ${adapter.constructor.name}`);
  const ctx = { Batch: batch, SummaryLines: [], System: resolvedAdapter.System, ContextUser: user, Provider: Metadata.Provider };

  const cases: Array<[string, string, string]> = [
    ['posted batch (real document)', 'AIDP-BATCH-000004', 'posted'],
    ['earlier posted batch',          'AIDP-BATCH-000003', 'posted'],
    ['never posted',                  'AIDP-BATCH-999999', 'absent'],
    ['the OLD wrong ref (journal code)', 'AIDP_MAN',       'absent'],
  ];
  let pass = regOk;
  for (const [label, doc, want] of cases) {
    const got = await adapter.VerifyPosted(doc, ctx as never);
    const ok = got.Status === want;
    if (!ok) pass = false;
    const detail = got.Status === 'posted' ? `${got.EntryCount} entries`
                 : got.Status === 'unknown' ? `reason: ${got.Reason}` : '';
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} ${doc.padEnd(20)} -> '${got.Status}'  (expected '${want}')  ${detail}`);
  }
  console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`);
  await pool.close(); process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
