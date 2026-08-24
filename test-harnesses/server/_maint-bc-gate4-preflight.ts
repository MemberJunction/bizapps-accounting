/** READ-ONLY Gate 4 pre-flight: is everything the real dispatch path needs actually in place? */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const S = '__mj_BizAppsAccounting', CO = 'A55C0DE1-0002-4000-8000-000000000002';
  const q = async (t: string, sqlText: string) => { const r = (await p.request().query(sqlText)).recordset; console.log(`\n-- ${t}\n${JSON.stringify(r, null, 2)}`); return r; };
  await q('company', `SELECT ID, Name FROM __mj.Company WHERE ID='${CO}'`);
  await q('AccountingCompanyProfile (ApprovalCFOUserID must NOT be null)', `SELECT ID, ApprovalCFOUserID FROM ${S}.AccountingCompanyProfile WHERE ID='${CO}'`);
  await q('that CFO user', `SELECT u.ID, u.Name, u.Email FROM __mj.[User] u JOIN ${S}.AccountingCompanyProfile a ON a.ApprovalCFOUserID=u.ID WHERE a.ID='${CO}'`);
  await q('Approval Request task type seeded', `SELECT ID, Name FROM __mj_BizAppsTasks.TaskType WHERE Name='Approval Request'`);
  await q('task decision outcomes seeded', `SELECT Code, Name FROM __mj_BizAppsTasks.TaskDecisionOutcome ORDER BY Code`);
  await q('GL accounts to be used', `SELECT Code, Name, ExternalSystem, ExternalAccountID FROM ${S}.GLAccount WHERE CompanyID='${CO}' AND Code IN ('11201','40100') ORDER BY Code`);
  await q('Manual journal entry type', `SELECT ID, Name FROM ${S}.JournalEntryType WHERE Name='Manual'`);
  await q('existing open batches on this company (want 0)', `SELECT ID, JournalEntryBatchNumber, Status FROM ${S}.JournalEntryBatch WHERE CompanyID='${CO}' AND Status NOT IN ('Posted')`);
  await p.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
