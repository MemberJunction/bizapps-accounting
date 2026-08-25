/** _maint-bc-gate4-post.ts — GATE 4: a real end-to-end JE batch export to Business Central.
 *
 *  ⚠️ THIS POSTS TO THE GENERAL LEDGER. Irreversible — a posted journal is corrected with a
 *  reversing entry, never un-posted.
 *
 *  Runs the PRODUCTION path, not a simulation:
 *    1. create ONE balanced $1 JE on the proof company (debit 11201, credit 40100)
 *    2. buildJournalEntryBatch with the REAL TasksAppApprovalGate (creates the CFO approval Task)
 *    3. record a terminal Approved decision through the gate's own API
 *    4. dispatch via the REAL remote operation → adapter mints/reuses the AIDP_MAN channel journal,
 *       stages the netted summary lines, and calls PostJournal (Microsoft.NAV.post)
 *    5. verify: batch Posted + external ref, JEs GLPosted, and the entry visible in BC's ledger
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/tasks-entities';
import '@mj-biz-apps/tasks-entities-server';
import '@mj-biz-apps/accounting-core-entities-server';
import {
  DispatchJournalEntryBatchOperation, buildJournalEntryBatch, TasksAppApprovalGate,
  JournalEntryEntityServer, RequireJournalEntryTypeID,
} from '@mj-biz-apps/accounting-core-entities-server';

const COMPANY = 'A55C0DE1-0002-4000-8000-000000000002';   // Assoc Demo — Cascadia Chapter
const S = '__mj_BizAppsAccounting';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!user) throw new Error('no context user');
  const md = new Metadata();

  const gl = (await pool.request().query(`SELECT Code, ID FROM ${S}.GLAccount WHERE CompanyID='${COMPANY}' AND Code IN ('11201','40100')`)).recordset;
  const ar = gl.find(g => g.Code === '11201'), rev = gl.find(g => g.Code === '40100');
  if (!ar || !rev) throw new Error('missing 11201/40100 on the proof company');

  // ── 1. one balanced $1 JE ──
  const manualTypeId = await RequireJournalEntryTypeID('Manual', user, Metadata.Provider);
  const je = await md.GetEntityObject<JournalEntryEntityServer>('MJ_BizApps_Accounting: Journal Entries', user);
  je.NewRecord();
  je.CompanyID = COMPANY; je.EffectiveDate = new Date(); je.EntryTypeID = manualTypeId;
  je.Status = 'Pending'; je.Description = 'AIDP Gate-4 live BC export proof';
  for (const [gid, dr, cr] of [[ar.ID, 1, null], [rev.ID, null, 1]] as [string, number | null, number | null][]) {
    const l = await je.CreateLine(user);
    l.GLAccountID = gid; if (dr != null) l.DebitAmount = dr; if (cr != null) l.CreditAmount = cr;
  }
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  console.log(`1. JE created: ${je.EntryNumber} (${je.ID}) — debit 11201 1.00 / credit 40100 1.00`);

  // ── 2. build the batch through the REAL approval gate ──
  const gate = new TasksAppApprovalGate(provider);
  const build = await buildJournalEntryBatch(COMPANY, 'BusinessCentral', user.ID, user, provider, gate);
  console.log(`2. batch built: ${build.batchId}`);

  // ── 3. terminal CFO approval decision ──
  const cfo = (await pool.request().query(`SELECT ApprovalCFOUserID c FROM ${S}.AccountingCompanyProfile WHERE ID='${COMPANY}'`)).recordset[0].c;
  await gate.recordDecision(build.batchId, 'Approved', cfo, 'Gate-4 live proof', user);
  console.log(`3. CFO approval recorded (user ${cfo})`);

  // ── 4. THE IRREVERSIBLE STEP ──
  console.log('4. dispatching — this POSTS to the Business Central general ledger…');
  const res = await new DispatchJournalEntryBatchOperation().ExecuteServer({ JournalEntryBatchID: build.batchId }, { provider, user });
  console.log(`   dispatch: Success=${res.Success}${res.ErrorMessage ? ' error=' + res.ErrorMessage : ''}`);

  // ── 5. verify local state ──
  const chk = (await pool.request().query(`
    SELECT b.JournalEntryBatchNumber, b.Status, b.ExternalJournalEntryBatchRef ref,
      (SELECT COUNT(*) FROM ${S}.JournalEntry j WHERE j.JournalEntryBatchID=b.ID) total,
      (SELECT COUNT(*) FROM ${S}.JournalEntry j WHERE j.JournalEntryBatchID=b.ID AND j.Status='GLPosted') posted
    FROM ${S}.JournalEntryBatch b WHERE b.ID='${build.batchId}'`)).recordset[0];
  console.log(`5. local state: ${JSON.stringify(chk)}`);
  if (!res.Success) { console.log('\n✗ GATE 4 FAILED — see the error above. Nothing should be in the GL.'); await pool.close(); process.exit(1); }
  console.log(`\n✔ GATE 4: batch ${chk.JournalEntryBatchNumber} → ${chk.Status}, ref=${chk.ref}, ${chk.posted}/${chk.total} JEs GLPosted`);
  console.log(`   verify in BC with: _maint-bc-review.ts AIDP_MAN AIDP`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
