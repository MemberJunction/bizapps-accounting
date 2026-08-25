/** _maint-bc-make-proof-jes.ts — create clean, unbatched, balanced JEs on the BC proof company.
 *
 *  Every line uses an account mapped to a REAL Business Central account (see
 *  _maint-bc-proof-mapping.ts), so a batch built from these routes to BusinessCentral under the
 *  account-driven routing rule (D13) — no mixed-system batch, which fails loudly by design.
 *  Leaves them Pending and UNBATCHED so a human can build + dispatch the batch from Explorer.
 *    npx tsx ../bizapps-accounting/test-harnesses/server/_maint-bc-make-proof-jes.ts [--apply]
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import { JournalEntryEntityServer, LookupJournalEntryTypeByCode } from '@mj-biz-apps/accounting-core-entities-server';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

interface LineSpec { account: string; debit?: number; credit?: number }
/** Three JEs: a 2-line asset/revenue, a 2-line asset/liability, and a 3-line split. */
const PLAN: Array<{ desc: string; lines: LineSpec[] }> = [
  { desc: 'BC proof — membership dues billed',
    lines: [{ account: 'Accounts Receivable', debit: 1000 }, { account: 'Sales Revenue', credit: 1000 }] },
  { desc: 'BC proof — commission accrued (asset/liability)',
    lines: [{ account: 'Accounts Receivable', debit: 500 }, { account: 'Commission Payable', credit: 500 }] },
  { desc: 'BC proof — split across three accounts',
    lines: [{ account: 'Accounts Receivable', debit: 750 }, { account: 'Sales Revenue', credit: 500 }, { account: 'Commission Payable', credit: 250 }] },
];

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user: UserInfo = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  const md = new Metadata();

  const ci = (await pool.request().query(`SELECT TOP 1 CompanyID FROM __mj.CompanyIntegration ci JOIN __mj.Integration i ON i.ID=ci.IntegrationID WHERE i.ClassName='BusinessCentralConnector' AND ci.IsActive=1`)).recordset[0];
  const companyID: string = ci.CompanyID;
  const gls = (await pool.request().query(`SELECT ID, Name, ExternalSystem, ExternalAccountID FROM __mj_BizAppsAccounting.GLAccount WHERE CompanyID='${companyID}'`)).recordset;
  const glByName = new Map<string, any>(gls.map((g: any) => [g.Name as string, g]));

  // Every account this plan touches must already resolve to Business Central, or the batch would
  // straddle two systems and be rejected. Check before writing anything.
  const used = [...new Set(PLAN.flatMap(p => p.lines.map(l => l.account)))];
  let bad = false;
  for (const name of used) {
    const g = glByName.get(name);
    const ok = g && g.ExternalSystem === 'BusinessCentral';
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${name.padEnd(24)} -> ${g ? `${g.ExternalSystem} / ${g.ExternalAccountID}` : 'NOT FOUND'}`);
    if (!ok) bad = true;
  }
  if (bad) { console.log('\nrefusing to create JEs: an account is not mapped to BusinessCentral'); await pool.close(); process.exit(1); }

  const entryType = await LookupJournalEntryTypeByCode('Manual', user).catch(() => null)
    ?? (await pool.request().query(`SELECT TOP 1 ID, Name FROM __mj_BizAppsAccounting.JournalEntryType WHERE IsJournalEntryBatchSummary=0 ORDER BY Name`)).recordset[0];
  const entryTypeID: string = (entryType as any).ID;
  console.log(`\nentry type: ${(entryType as any).Name ?? entryTypeID}`);
  console.log(`company:    ${companyID}\n`);

  for (const spec of PLAN) {
    const dr = spec.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const cr = spec.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    console.log(`  ${apply ? 'CREATING' : 'would create'}: ${spec.desc}  (${spec.lines.length} lines, Dr ${dr} / Cr ${cr}${dr === cr ? '' : '  ** UNBALANCED **'})`);
    if (dr !== cr) throw new Error('plan is unbalanced — refusing');
    if (!apply) continue;
    const je = await md.GetEntityObject<JournalEntryEntityServer>(JE_ENTITY, user);
    je.NewRecord();
    je.CompanyID = companyID;
    je.EffectiveDate = new Date();
    je.EntryTypeID = entryTypeID;
    je.Status = 'Pending';
    je.Description = spec.desc;
    for (const l of spec.lines) {
      const line = await je.CreateLine(user);
      line.GLAccountID = glByName.get(l.account).ID;
      if (l.debit != null) line.DebitAmount = l.debit;
      if (l.credit != null) line.CreditAmount = l.credit;
    }
    if (!(await je.Save())) throw new Error(`save failed: ${je.LatestResult?.CompleteMessage}`);
    console.log(`     -> ${je.EntryNumber}  (${je.ID})`);
  }
  console.log(`\n${apply ? 'created' : 'dry run — pass --apply'}`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
