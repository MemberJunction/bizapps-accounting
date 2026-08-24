/** _maint-bc-view.ts — READ-ONLY viewer: what is actually in the Business Central environment?
 *
 *  Run any time to inspect the tenant. Writes NOTHING.
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-view.ts [documentNumberFilter]
 *  With no filter it shows MJ-PROOF (Madhav's existing test post) as a worked example of what a
 *  posted batch looks like from our side.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';

async function main(): Promise<void> {
  const filter = (process.argv[2] ?? 'MJ-PROOF').toUpperCase();
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();
  const integRow = (await pool.request().query(`SELECT ID FROM __mj.Integration WHERE ClassName='BusinessCentralConnector'`)).recordset[0];
  const integ = await md.GetEntityObject<any>('MJ: Integrations', user); await integ.Load(integRow.ID);
  const ciRow = (await pool.request().query(`SELECT TOP 1 ID FROM __mj.CompanyIntegration WHERE IntegrationID='${integRow.ID}' AND IsActive=1`)).recordset[0];
  const ci = await md.GetEntityObject<any>('MJ: Company Integrations', user); await ci.Load(ciRow.ID);
  const c: any = ConnectorFactory.Resolve(integ);
  const cfg = await c.ResolveConfig(ci, user);
  const F = (r: any, k: string) => r?.Fields?.[k];

  console.log(`=== connection ===`);
  console.log(`environment : ${cfg.Environment}`);
  console.log(`apiVersion  : ${cfg.ApiVersion}`);
  console.log(`server      : ${cfg.Server}`);
  console.log(`companyId   : ${cfg.CompanyId}`);
  console.log(`BC web UI   : https://businesscentral.dynamics.com/${cfg.TenantId}/${cfg.Environment}`);

  console.log(`\n=== companies visible to this credential ===`);
  const cos = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'companies', WatermarkValue: null, BatchSize: 500, ContextUser: user });
  for (const r of (cos.Records ?? [])) console.log(`  ${String(F(r, 'name') ?? F(r, 'displayName')).padEnd(38)} id=${F(r, 'id')}  businessProfileId=${F(r, 'businessProfileId') ?? '-'}`);
  console.log(`  (total ${(cos.Records ?? []).length})`);

  // NOTE: BC's `journals` object is the JOURNAL BATCH (a container/template), not staged data.
  // Un-posted LINES live in `journalLines` under a journal. Listing containers here only tells you
  // which journals exist to write into.
  console.log(`\n=== journal batches available to write into (containers, NOT staged data) ===`);
  const js = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journals', WatermarkValue: null, BatchSize: 500, ContextUser: user });
  const jrs = js.Records ?? [];
  if (!jrs.length) console.log('  (none)');
  for (const r of jrs) console.log(`  code=${String(F(r, 'code')).padEnd(12)} name=${String(F(r, 'displayName') ?? '').slice(0, 40).padEnd(42)} id=${F(r, 'id')}`);
  console.log(`\n=== UN-POSTED lines currently staged in those journals ===`);
  const jl = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journalLines', WatermarkValue: null, BatchSize: 5000, ContextUser: user });
  const lines = jl.Records ?? [];
  if (!lines.length) console.log('  (none — nothing is staged awaiting a post)');
  const byJournal: Record<string, { n: number; sum: number }> = {};
  const jname: Record<string, string> = {};
  for (const r of jrs) jname[String(F(r, 'id'))] = `${F(r, 'code')} (${F(r, 'displayName')})`;
  for (const r of lines) {
    const j = String(F(r, 'journalId') ?? F(r, 'journalDisplayName') ?? 'unknown');
    byJournal[j] = byJournal[j] ?? { n: 0, sum: 0 };
    byJournal[j].n++; byJournal[j].sum += Number(F(r, 'amount') ?? 0);
  }
  console.log(`  staged lines grouped BY JOURNAL — PostJournal() posts an ENTIRE journal, so any`);
  console.log(`  journal with pre-existing lines is unsafe to write into:`);
  for (const [j, v] of Object.entries(byJournal)) {
    console.log(`    ${(jname[j] ?? j).padEnd(34)} lines=${String(v.n).padEnd(4)} net amount=${v.sum.toFixed(2)}`);
  }
  const clean = jrs.filter(r => !byJournal[String(F(r, 'id'))]);
  console.log(`  journals with ZERO staged lines (safe to write into): ${clean.length ? clean.map(r => String(F(r, 'code'))).join(', ') : 'NONE'}`);
  console.log(`  (total staged lines: ${lines.length})`);

  console.log(`\n=== POSTED general ledger entries matching documentNumber contains "${filter}" ===`);
  const gl = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'generalLedgerEntries', WatermarkValue: null, BatchSize: 100000, ContextUser: user });
  const hits = (gl.Records ?? []).filter(r => String(F(r, 'documentNumber') ?? '').toUpperCase().includes(filter));
  if (!hits.length) console.log('  (no match — nothing with that documentNumber is in the ledger)');
  for (const r of hits) {
    console.log(`  postingDate=${String(F(r, 'postingDate')).slice(0, 10)}  doc=${String(F(r, 'documentNumber')).padEnd(16)} acct=${String(F(r, 'accountNumber')).padEnd(8)} dr=${F(r, 'debitAmount')} cr=${F(r, 'creditAmount')}  ${String(F(r, 'description') ?? '').slice(0, 40)}`);
  }
  console.log(`\n  matched ${hits.length} of ${(gl.Records ?? []).length} total ledger entries · current watermark ${gl.NewWatermarkValue}`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
