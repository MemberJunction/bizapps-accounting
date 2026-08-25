/** _maint-bc-gate4-resume.ts — resume GATE 4 from an already-built batch.
 *  ⚠️ POSTS TO THE GENERAL LEDGER. Pass the batch ID as argv[2].
 *  DecidedByPersonID FKs to __mj_BizAppsCommon.Person (NOT __mj.User) and is NULLABLE — so we
 *  attribute to a real Person when one exists, else record the decision unattributed.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@memberjunction/server-bootstrap-lite';
import '@memberjunction/connector-business-central';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/tasks-entities';
import '@mj-biz-apps/tasks-entities-server';
import '@mj-biz-apps/accounting-core-entities-server';
import { DispatchJournalEntryBatchOperation, TasksAppApprovalGate, approveJournalEntryBatch } from '@mj-biz-apps/accounting-core-entities-server';

const S = '__mj_BizAppsAccounting';
async function main(): Promise<void> {
  const batchId = process.argv[2];
  if (!batchId) throw new Error('usage: _maint-bc-gate4-resume.ts <batchId>');
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await UserCache.Instance.Refresh(pool);
  const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];

  const before = (await pool.request().query(`SELECT JournalEntryBatchNumber n, Status, CompanyID FROM ${S}.JournalEntryBatch WHERE ID='${batchId}'`)).recordset[0];
  console.log(`batch ${before.n} is ${before.Status}`);

  if (before.Status === 'Pending') {
    const person = (await pool.request().query(`SELECT TOP 1 ID FROM __mj_BizAppsCommon.Person ORDER BY __mj_CreatedAt`)).recordset[0];
    const personId: string | undefined = person?.ID;
    console.log(`recording Approved decision · DecidedByPersonID=${personId ?? '(null — no Person rows; column is nullable)'}`);
    // Approval has TWO decoupled halves and BOTH are required:
    //   recordDecision        -> the terminal Task decision the gate's assertApproved checks
    //   approveJournalEntryBatch -> the batch's own Status column, which sendJournalEntryBatch checks
    // Neither performs the other, and nothing forces them to happen together.
    await new TasksAppApprovalGate(provider).recordDecision(batchId, 'Approved', personId, 'Gate-4 live proof', user);
    console.log('  task decision recorded');
    await approveJournalEntryBatch(batchId, user.ID, user, provider);
    const st = (await pool.request().query(`SELECT Status FROM ${S}.JournalEntryBatch WHERE ID='${batchId}'`)).recordset[0].Status;
    console.log(`  batch status now: ${st}`);
  }

  console.log('dispatching — this POSTS to the Business Central general ledger…');
  const res = await new DispatchJournalEntryBatchOperation().ExecuteServer({ JournalEntryBatchID: batchId }, { provider, user });
  console.log(`dispatch: Success=${res.Success}${res.ErrorMessage ? '\n  error=' + res.ErrorMessage : ''}`);

  const chk = (await pool.request().query(`
    SELECT b.JournalEntryBatchNumber, b.Status, b.ExternalJournalEntryBatchRef ref,
      (SELECT COUNT(*) FROM ${S}.JournalEntry j WHERE j.JournalEntryBatchID=b.ID) total,
      (SELECT COUNT(*) FROM ${S}.JournalEntry j WHERE j.JournalEntryBatchID=b.ID AND j.Status='GLPosted') posted
    FROM ${S}.JournalEntryBatch b WHERE b.ID='${batchId}'`)).recordset[0];
  console.log(`local state: ${JSON.stringify(chk)}`);
  console.log(res.Success ? `\n✔ GATE 4 PASS — ${chk.JournalEntryBatchNumber} ${chk.Status}, ref=${chk.ref}, ${chk.posted}/${chk.total} GLPosted` : '\n✗ GATE 4 FAILED');
  await pool.close();
  if (!res.Success) process.exit(1);
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
