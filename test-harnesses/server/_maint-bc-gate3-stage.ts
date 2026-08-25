/** _maint-bc-gate3-stage.ts — GATE 3: stage lines in Business Central WITHOUT posting.
 *
 *  Writes to BC, but CANNOT touch the general ledger: staged journalLines are inert until
 *  `Microsoft.NAV.post`, and deleting the journal cascades them away. Nothing here posts.
 *
 *  It drives the CONNECTOR directly, mirroring the adapter's derivation rules, rather than
 *  adding a "skip the post" flag to the adapter — production code gets no test-only seam.
 *  What this de-risks before the irreversible step:
 *    - does BC accept a journal we create by code?
 *    - does the GUID `accountId` form work (vs accountNumber)?
 *    - does the NESTED journalLines path work (connector 2.0.0's headline change)?
 *    - is the posting date inside an open BC accounting period?
 *  Uses a THROWAWAY journal code so it cannot collide with a real dispatch's derived code.
 *
 *  Run from the instance MJ worktree (mj/). Cleanup: pass `--delete` to remove the journal.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import { ConnectorFactory } from '@memberjunction/integration-engine';

const COMPANY = 'A55C0DE1-0002-4000-8000-000000000002';   // Assoc Demo — Cascadia Chapter
const JOURNAL_CODE = 'AIDPSTAGE';                          // throwaway, <=10 chars
const DOC_NUMBER = 'AIDP-TEST-0001';
const S = '__mj_BizAppsAccounting';
const F = (r: any, k: string) => r?.Fields?.[k];

async function main(): Promise<void> {
  const wantDelete = process.argv.includes('--delete');
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

  // ── locate or create the throwaway journal ──
  const journals = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journals', WatermarkValue: null, BatchSize: 500, ContextUser: user });
  let journal = (journals.Records ?? []).find((r: any) => String(F(r, 'code')).trim().toUpperCase() === JOURNAL_CODE);
  let journalId = journal ? String(F(journal, 'id')) : '';

  if (wantDelete) {
    if (!journalId) { console.log(`journal ${JOURNAL_CODE} not present — nothing to delete`); await pool.close(); return; }
    const del = await c.DeleteRecord({ CompanyIntegration: ci, ObjectName: 'journals', ContextUser: user, ExternalID: journalId });
    console.log(`DELETE journal ${JOURNAL_CODE}: Success=${del.Success} ${del.ErrorMessage ?? ''}`);
    await pool.close(); return;
  }

  if (!journalId) {
    const created = await c.CreateRecord({ CompanyIntegration: ci, ObjectName: 'journals', ContextUser: user, Attributes: { code: JOURNAL_CODE, displayName: 'AIDP Gate-3 staging probe (safe to delete)' } });
    console.log(`CREATE journal ${JOURNAL_CODE}: Success=${created.Success} id=${created.ExternalID ?? '-'} ${created.ErrorMessage ?? ''}`);
    if (!created.Success || !created.ExternalID) throw new Error(`journal create failed: ${created.ErrorMessage}`);
    journalId = String(created.ExternalID);
  } else {
    console.log(`journal ${JOURNAL_CODE} already exists (id=${journalId}) — reusing`);
  }

  // ── the two GL accounts, and the GUIDs they map to ──
  const accts = (await pool.request().query(`SELECT Code, Name, ExternalAccountID FROM ${S}.GLAccount WHERE CompanyID='${COMPANY}' AND Code IN ('11201','40100') ORDER BY Code`)).recordset;
  console.log('\nour mapped accounts:');
  for (const a of accts) console.log(`  ${a.Code} ${String(a.Name).padEnd(22)} -> ${a.ExternalAccountID}`);
  const ar = accts.find((a: any) => a.Code === '11201'), rev = accts.find((a: any) => a.Code === '40100');
  if (!ar?.ExternalAccountID || !rev?.ExternalAccountID) throw new Error('both 11201 and 40100 need an ExternalAccountID');

  const postingDate = new Date().toISOString().slice(0, 10);
  const lines = [
    { CompanyIntegration: ci, ObjectName: 'journalLines', ContextUser: user, Attributes: { accountType: 'G/L Account', journalId, accountId: ar.ExternalAccountID, postingDate, documentNumber: DOC_NUMBER, amount: 1, description: 'AIDP gate-3 staging probe (debit AR)' } },
    { CompanyIntegration: ci, ObjectName: 'journalLines', ContextUser: user, Attributes: { accountType: 'G/L Account', journalId, accountId: rev.ExternalAccountID, postingDate, documentNumber: DOC_NUMBER, amount: -1, description: 'AIDP gate-3 staging probe (credit revenue)' } },
  ];
  console.log(`\nstaging ${lines.length} lines · postingDate=${postingDate} · documentNumber=${DOC_NUMBER} · journalId=${journalId}`);
  const staged = await c.BatchCreateRecords(lines);
  staged.forEach((r: any, i: number) => console.log(`  line ${i + 1}: Success=${r.Success} HTTP=${r.StatusCode} id=${r.ExternalID ?? '-'} ${r.ErrorMessage ?? ''}`));
  if (staged.some((r: any) => !r.Success)) {
    console.log('\n✗ STAGING FAILED — nothing posted. Re-run with --delete to remove the journal.');
    await pool.close(); process.exit(1);
  }

  // ── read back: the journal must hold EXACTLY our lines ──
  const all = await c.FetchChanges({ CompanyIntegration: ci, ObjectName: 'journalLines', WatermarkValue: null, BatchSize: 5000, ContextUser: user });
  const mine = (all.Records ?? []).filter((r: any) => String(F(r, 'journalId')) === journalId);
  console.log(`\nread-back — lines now in journal ${JOURNAL_CODE}: ${mine.length} (expected ${lines.length})`);
  let net = 0;
  for (const r of mine) {
    net += Number(F(r, 'amount') ?? 0);
    console.log(`  doc=${F(r, 'documentNumber')} acct=${F(r, 'accountNumber') ?? F(r, 'accountId')} amount=${F(r, 'amount')} date=${String(F(r, 'postingDate')).slice(0, 10)}  ${F(r, 'description')}`);
  }
  console.log(`\nnet amount = ${net} (must be 0 or BC will refuse the post)`);
  console.log(mine.length === lines.length && net === 0 ? '\n✔ GATE 3 PASS — staged, balanced, un-posted. NOTHING is in the general ledger.' : '\n✗ GATE 3 FAIL — inspect before going further.');
  console.log(`\ninspect in BC: General Journals -> batch ${JOURNAL_CODE}`);
  console.log(`cleanup: re-run this script with --delete`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
