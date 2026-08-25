/** _maint-dispatch-mock-proof.ts — live proof of the metadata-driven ERP dispatch (plan S3 gate).
 *
 *  Creates 2 balanced Pending JEs on the demo company, builds a batch with TargetSystem='Mock'
 *  (no demo GL account declares an ExternalSystem, so account-driven routing falls back to the
 *  batch selector), approves it, then dispatches through the REAL remote op
 *  (Accounting.DispatchJournalEntryBatch → catalog row → ClassFactory → MockAccountingSystemAdapter).
 *  Asserts: batch Posted · ExternalJournalEntryBatchRef = MOCK-<number> · all member+summary JEs GLPosted.
 *  Run from instance worktree root (mj/): npx tsx .../_maint-dispatch-mock-proof.ts
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { Metadata } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { DispatchJournalEntryBatchOperation, buildJournalEntryBatch, approveJournalEntryBatch, AutoApproveGate, JournalEntryEntityServer, RequireJournalEntryTypeID } from '@mj-biz-apps/accounting-core-entities-server';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const cfg = new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj');
  const provider = await setupSQLServerClient(cfg);
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!user) throw new Error('no context user');
  const S = '__mj_BizAppsAccounting';

  // 2 balanced Pending JEs on the first demo company with AR 11201 + Rev 40100 (same as _maint-make-pending)
  const gl = (await pool.request().query(`SELECT TOP 1 ar.CompanyID cid, ar.ID arID, rev.ID revID FROM ${S}.GLAccount ar JOIN ${S}.GLAccount rev ON rev.CompanyID=ar.CompanyID AND rev.Code='40100' WHERE ar.Code='11201'`)).recordset[0];
  if (!gl) throw new Error('no demo company with 11201/40100');
  const md = new Metadata();
  const manualTypeId = await RequireJournalEntryTypeID('Manual', user, Metadata.Provider);
  for (let i = 0; i < 2; i++) {
    // Phase-2 encapsulated model: compose lines on the entity BEFORE one transactional Save().
    const je = await md.GetEntityObject<JournalEntryEntityServer>('MJ_BizApps_Accounting: Journal Entries', user);
    je.NewRecord(); je.CompanyID = gl.cid; je.EffectiveDate = new Date(); je.EntryTypeID = manualTypeId; je.Status = 'Pending'; je.Description = `DISPATCH-PROOF ${i + 1}`;
    for (const [gid, dr, cr] of [[gl.arID, 125, null], [gl.revID, null, 125]] as [string, number | null, number | null][]) {
      const l = await je.CreateLine(user);
      l.GLAccountID = gid; if (dr != null) l.DebitAmount = dr; if (cr != null) l.CreditAmount = cr;
    }
    if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  }
  console.log('seeded 2 Pending JEs on company', gl.cid);

  const build = await buildJournalEntryBatch(gl.cid, 'Mock', user.ID, user, provider, AutoApproveGate);
  console.log('batch built:', build.batchId);
  await approveJournalEntryBatch(build.batchId, user.ID, user, provider);

  const op = new DispatchJournalEntryBatchOperation();
  const res = await op.ExecuteServer({ JournalEntryBatchID: build.batchId }, { provider, user });
  console.log('dispatch result:', JSON.stringify(res));
  if (!res.Success) throw new Error(`dispatch FAILED: ${res.ErrorMessage}`);

  const check = (await pool.request().query(`
    SELECT b.Status, b.ExternalJournalEntryBatchRef,
      (SELECT COUNT(*) FROM ${S}.JournalEntry je WHERE je.JournalEntryBatchID=b.ID) AS totalJEs,
      (SELECT COUNT(*) FROM ${S}.JournalEntry je WHERE je.JournalEntryBatchID=b.ID AND je.Status='GLPosted') AS glposted
    FROM ${S}.JournalEntryBatch b WHERE b.ID='${build.batchId}'`)).recordset[0];
  console.log('final state:', JSON.stringify(check));
  const ok = check.Status === 'Posted' && String(check.ExternalJournalEntryBatchRef).startsWith('MOCK-') && check.totalJEs > 0 && check.totalJEs === check.glposted;
  console.log(ok ? '✅ DISPATCH PROOF GREEN (Posted, MOCK ref, all JEs GLPosted)' : '❌ DISPATCH PROOF FAILED');
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error('❌', e instanceof Error ? e.message : e); process.exit(2); });
