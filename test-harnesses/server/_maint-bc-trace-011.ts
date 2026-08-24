import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const S = '__mj_BizAppsAccounting';
  const b = (await p.request().query(`SELECT JournalEntryBatchNumber n, Status, ExternalJournalEntryBatchRef ref, CompanyID, __mj_CreatedAt c FROM ${S}.JournalEntryBatch WHERE JournalEntryBatchNumber IN ('BATCH-000010','BATCH-000011') ORDER BY JournalEntryBatchNumber`)).recordset;
  console.log('BATCHES:', JSON.stringify(b, null, 2));
  const j = (await p.request().query(`SELECT je.EntryNumber, je.Status, je.Description, b.JournalEntryBatchNumber bn FROM ${S}.JournalEntry je JOIN ${S}.JournalEntryBatch b ON b.ID=je.JournalEntryBatchID WHERE b.JournalEntryBatchNumber IN ('BATCH-000010','BATCH-000011')`)).recordset;
  console.log('JEs:', JSON.stringify(j, null, 2));
  await p.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
