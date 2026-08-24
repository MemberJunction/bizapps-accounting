/** _maint-bc-recon.ts — Gate 1: READ-ONLY reconnaissance of the Business Central sandbox.
 *
 *  Writes NOTHING to Business Central. Establishes, from the live tenant:
 *    1. the GL chart of accounts, pulled incrementally
 *    2. that the watermark ADVANCES (second pull must not re-yield the whole chart)
 *    3. which accounts are actually POSTABLE (accountType='Posting' AND !blocked AND directPosting)
 *    4. a generalLedgerEntries watermark captured BEFORE any post, to bound the later verify
 *    5. provenance of the Credential / CompanyIntegration rows now in the DB
 *
 *  Run from the instance MJ worktree (mj/):
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-recon.ts
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path'; import fs from 'fs';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();

  // ── 5. provenance of the connection rows ──
  const prov = (await pool.request().query(`
    SELECT c.ID credID, c.Name credName, c.__mj_CreatedAt credCreated, c.__mj_UpdatedAt credUpdated,
           ci.ID ciID, ci.__mj_CreatedAt ciCreated, ci.IsActive
    FROM __mj.Credential c
    JOIN __mj.CompanyIntegration ci ON ci.CredentialID = c.ID
    WHERE c.CredentialTypeID='220D6680-68A4-4DC4-A271-2206C64C585E'`)).recordset;
  console.log('connection rows:', JSON.stringify(prov, null, 2));
  const nActive = (await pool.request().query(`SELECT COUNT(*) n FROM __mj.CompanyIntegration ci JOIN __mj.Integration i ON i.ID=ci.IntegrationID WHERE i.ClassName='BusinessCentralConnector' AND ci.IsActive=1`)).recordset[0].n;
  console.log(`active CompanyIntegrations for BusinessCentralConnector: ${nActive} (adapter requires exactly 1)`);

  const integ = await md.GetEntityObject<any>('MJ: Integrations', user);
  const integRow = (await pool.request().query(`SELECT ID FROM __mj.Integration WHERE ClassName='BusinessCentralConnector'`)).recordset[0];
  await integ.Load(integRow.ID);
  const ci = await md.GetEntityObject<any>('MJ: Company Integrations', user);
  await ci.Load(prov[0].ciID);
  const connector: any = ConnectorFactory.Resolve(integ);
  console.log(`connector: ${connector.constructor?.name} · SupportsBatchWrite=${connector.SupportsBatchWrite} · SupportsSearch=${connector.SupportsSearch}`);

  const f = (r: any, k: string) => { const F = r?.Fields ?? {}; return F[k] ?? F[k[0].toUpperCase() + k.slice(1)]; };

  // ── 1. first accounts pull ──
  const p1 = await connector.FetchChanges({ CompanyIntegration: ci, ObjectName: 'accounts', WatermarkValue: null, BatchSize: 1000, ContextUser: user });
  const recs: any[] = p1.Records ?? [];
  console.log(`\npull #1 accounts: ${recs.length} records · NewWatermark=${p1.NewWatermarkValue ?? 'null'} · hasMore=${p1.HasMore} nextCursor=${p1.NextCursor ?? 'none'}`);

  if (recs.length) {
    console.log('sample record: ExternalID=' + recs[0].ExternalID + ' ObjectType=' + recs[0].ObjectType);
    console.log('Fields keys: ' + Object.keys(recs[0].Fields ?? {}).join(', '));
    console.log('sample accountType/blocked/directPosting: ' + JSON.stringify({at: f(recs[0],'accountType'), b: f(recs[0],'blocked'), dp: f(recs[0],'directPosting')}));
  }

  // ── 2. second pull FROM that watermark — must not re-yield everything ──
  const p2 = await connector.FetchChanges({ CompanyIntegration: ci, ObjectName: 'accounts', WatermarkValue: p1.NewWatermarkValue, BatchSize: 1000, ContextUser: user });
  const n2 = (p2.Records ?? []).length;
  console.log(`pull #2 accounts (from watermark): ${n2} records · NewWatermark=${p2.NewWatermarkValue ?? 'null'}`);
  console.log(`${n2 < recs.length ? '✔' : '✗'} watermark ${n2 < recs.length ? 'ADVANCES' : 'DID NOT ADVANCE — re-pulled ' + n2 + ' of ' + recs.length}`);

  // ── 3. postable subset ──
  const postable = recs.filter(r => String(f(r, 'accountType')) === 'Posting' && (f(r, 'blocked') === false || String(f(r, 'blocked')) === 'false') && (f(r, 'directPosting') === true || String(f(r, 'directPosting')) === 'true'));
  const byType: Record<string, number> = {};
  for (const r of recs) { const t = String(f(r, 'accountType') ?? 'unknown'); byType[t] = (byType[t] ?? 0) + 1; }
  console.log(`\naccountType breakdown: ${JSON.stringify(byType)}`);
  console.log(`POSTABLE (Posting && !blocked && directPosting): ${postable.length} of ${recs.length}`);
  console.log('\nfirst 15 postable accounts (id is what journalLines.accountId needs):');
  for (const r of postable.slice(0, 15)) console.log(`  ${String(f(r, 'number')).padEnd(12)} ${String(f(r, 'displayName')).slice(0, 44).padEnd(46)} ${f(r, 'id') ?? r.ExternalID}`);

  // ── 4. pre-post GL watermark ──
  const gl = await connector.FetchChanges({ CompanyIntegration: ci, ObjectName: 'generalLedgerEntries', WatermarkValue: null, BatchSize: 1, ContextUser: user });
  console.log(`\ngeneralLedgerEntries PRE-POST watermark: ${gl.NewWatermarkValue ?? 'null'} (existing entries sampled: ${(gl.Records ?? []).length})`);

  // ── our side: what GL accounts claim an external system ──
  const S = '__mj_BizAppsAccounting';
  const ours = (await pool.request().query(`SELECT Code, Name, ExternalSystem, ExternalAccountID FROM ${S}.GLAccount WHERE ExternalSystem IS NOT NULL ORDER BY Code`)).recordset;
  console.log(`\nour GL accounts declaring an ExternalSystem: ${ours.length}`);
  for (const r of ours) console.log(`  ${r.Code} ${String(r.Name).slice(0, 30).padEnd(32)} system=${r.ExternalSystem} extID=${r.ExternalAccountID ?? 'NULL'}`);

  const out = path.resolve(process.cwd(), '..', '..', '..', 'logs', 'bc-recon-accounts.json');
  fs.writeFileSync(out, JSON.stringify({ watermark1: p1.NewWatermarkValue, watermark2: p2.NewWatermarkValue, glWatermark: gl.NewWatermarkValue, total: recs.length, postable }, null, 2));
  console.log(`\nfull postable list written to ${out}`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
