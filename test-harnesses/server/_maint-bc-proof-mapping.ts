/** _maint-bc-proof-mapping.ts — put the DB in a deliberate, minimal BC-proof state.
 *
 *  Target state (our DB only — writes NOTHING to Business Central):
 *    - ONE company (the one the active CompanyIntegration is bound to) has exactly three
 *      BusinessCentral-mapped accounts, each a REAL, directPost=true, unblocked BC account:
 *          Accounts Receivable  (Asset)     -> BC 11203 Accounts Receivable
 *          Commission Payable   (Liability) -> BC 21101 Accounts Payable
 *          Sales Revenue        (Revenue)   -> BC 41300 Membership Revenue
 *    - EVERY other company's accounts -> 'Mock', so no other company can reach the live ERP.
 *  Routing is account-driven (D13), so this is what decides which batches can dispatch to BC.
 *  Reversible; all writes go through BaseEntity so validation + audit apply.
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-proof-mapping.ts [--apply]
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';

const BC = 'BusinessCentral', MOCK = 'Mock';
/** name -> verified BC GUID. All directPost=true and unblocked as of 2026-08-24. */
const PROOF: Record<string, { guid: string; bc: string }> = {
  'Accounts Receivable': { guid: 'b7abc1de-6cb7-eb11-9b52-000d3aec3ef4', bc: '11203 Accounts Receivable (Asset)' },
  'Commission Payable':  { guid: 'd0abc1de-6cb7-eb11-9b52-000d3aec3ef4', bc: '21101 Accounts Payable (Liability)' },
  'Sales Revenue':       { guid: '5c725174-57c9-eb11-9f0a-000d3aec3ef4', bc: '41300 Membership Revenue (Revenue)' },
};

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();

  const ci = (await pool.request().query(`SELECT TOP 1 CompanyID FROM __mj.CompanyIntegration ci JOIN __mj.Integration i ON i.ID=ci.IntegrationID WHERE i.ClassName='BusinessCentralConnector' AND ci.IsActive=1`)).recordset[0];
  if (!ci) { console.log('no active BC CompanyIntegration — run _maint-bc-credential-setup first'); await pool.close(); return; }
  const proofCompanyID: string = ci.CompanyID;
  console.log(`proof company (from active CompanyIntegration): ${proofCompanyID}\n`);

  const rows = (await pool.request().query(`SELECT ID, Name, AccountType, CompanyID, ExternalSystem, ExternalAccountID FROM __mj_BizAppsAccounting.GLAccount ORDER BY CompanyID, Name`)).recordset;
  let changes = 0;
  for (const r of rows) {
    const isProofCompany = String(r.CompanyID).toUpperCase() === String(proofCompanyID).toUpperCase();
    const target = isProofCompany ? PROOF[r.Name as string] : undefined;
    const wantSystem = target ? BC : MOCK;
    // Leave an already-Mock account's id alone — renaming it is churn with no effect,
    // since 'Mock' is a fake system and nothing resolves the id against a real ERP.
    const alreadyMock = wantSystem === MOCK && r.ExternalSystem === MOCK && String(r.ExternalAccountID ?? '').startsWith('MOCK-');
    const wantExtID  = target ? target.guid
                     : alreadyMock ? r.ExternalAccountID
                     : `MOCK-${String(r.Name).replace(/\s+/g, '-').toUpperCase()}`;
    if (r.ExternalSystem === wantSystem && r.ExternalAccountID === wantExtID) continue;
    changes++;
    const label = target ? `-> ${BC}  ${target.bc}` : `-> ${MOCK}`;
    console.log(`  ${apply ? 'UPDATING' : 'would update'}: [${String(r.CompanyID).slice(9, 13)}] ${String(r.AccountType).padEnd(10)} ${String(r.Name).padEnd(28)} ${String(r.ExternalSystem ?? '-').padEnd(16)} ${label}`);
    if (apply) {
      const gl = await md.GetEntityObject<any>('MJ_BizApps_Accounting: GL Accounts', user);
      await gl.Load(r.ID);
      gl.ExternalSystem = wantSystem;
      gl.ExternalAccountID = wantExtID;
      if (!(await gl.Save())) throw new Error(`save failed for ${r.Name}: ${JSON.stringify(gl.LatestResult?.Errors ?? gl.LatestResult)}`);
    }
  }
  console.log(`\n${changes} account(s) ${apply ? 'updated' : 'would change (dry run — pass --apply)'}`);
  if (apply) {
    const after = (await pool.request().query(`SELECT Name, AccountType, ExternalAccountID FROM __mj_BizAppsAccounting.GLAccount WHERE ExternalSystem='${BC}' ORDER BY AccountType`)).recordset;
    console.log(`\nBusinessCentral-mapped accounts now (${after.length} — expect exactly 3):`);
    after.forEach(a => console.log(`  ${String(a.AccountType).padEnd(10)} ${String(a.Name).padEnd(28)} -> ${a.ExternalAccountID}`));
  }
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
