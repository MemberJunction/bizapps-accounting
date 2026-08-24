/** _maint-bc-inspect-armed.ts — READ-ONLY: which JEs/batches would now route to Business Central?
 *  Account-driven routing (D13) means any batch whose JE lines touch a BusinessCentral-mapped
 *  GL account dispatches to BC. This lists exactly what is currently armed.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const S = '__mj_BizAppsAccounting';
  const q = async (t: string, sqlText: string) => { console.log(`\n── ${t} ──`); console.log(JSON.stringify((await pool.request().query(sqlText)).recordset, null, 2)); };

  await q('JEs touching a BusinessCentral account, NOT yet GLPosted (the armed set)', `
    SELECT je.ID, je.EntryNumber, je.Status, je.CompanyID, je.JournalEntryBatchID,
           STRING_AGG(CONVERT(nvarchar(max), a.Code), ',') AS codes
    FROM ${S}.JournalEntry je
    JOIN ${S}.JournalEntryLine l ON l.JournalEntryID = je.ID
    JOIN ${S}.GLAccount a ON a.ID = l.GLAccountID
    WHERE a.ExternalSystem = 'BusinessCentral' AND je.Status <> 'GLPosted'
    GROUP BY je.ID, je.EntryNumber, je.Status, je.CompanyID, je.JournalEntryBatchID`);

  await q('batches those JEs belong to', `
    SELECT DISTINCT b.ID, b.JournalEntryBatchNumber, b.Status, b.TargetSystem, b.ExternalJournalEntryBatchRef
    FROM ${S}.JournalEntryBatch b
    JOIN ${S}.JournalEntry je ON je.JournalEntryBatchID = b.ID
    JOIN ${S}.JournalEntryLine l ON l.JournalEntryID = je.ID
    JOIN ${S}.GLAccount a ON a.ID = l.GLAccountID
    WHERE a.ExternalSystem = 'BusinessCentral' AND je.Status <> 'GLPosted'`);

  await q('all non-terminal batches', `
    SELECT ID, JournalEntryBatchNumber, Status, TargetSystem, CompanyID
    FROM ${S}.JournalEntryBatch WHERE Status NOT IN ('Posted') ORDER BY JournalEntryBatchNumber`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
