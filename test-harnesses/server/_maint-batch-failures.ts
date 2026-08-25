import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const S='__mj_BizAppsAccounting';
  const cols=(await p.request().query(`SELECT c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='${S}' AND t.name='JournalEntryBatch'`)).recordset.map(r=>r.name);
  const errCol=cols.find(c=>/error|message|reason|failure/i.test(c)) ?? null;
  console.log('candidate error column:', errCol ?? '(none)');
  const sel=['JournalEntryBatchNumber','Status','TargetSystem','ExternalJournalEntryBatchRef'].concat(errCol?[errCol]:[]).map(c=>`[${c}]`).join(',');
  const r=(await p.request().query(`SELECT TOP 6 ${sel} FROM ${S}.JournalEntryBatch ORDER BY __mj_CreatedAt DESC`)).recordset;
  console.log(JSON.stringify(r,null,2));
  console.log('\n--- ExternalAccountingSystem catalog ---');
  console.log(JSON.stringify((await p.request().query(`SELECT Name, DriverClass, IntegrationName, IsActive FROM ${S}.ExternalAccountingSystem`)).recordset,null,2));
  await p.close();
}
main().catch(e=>{console.error('FAILED:',e?.message??e);process.exit(1);});
