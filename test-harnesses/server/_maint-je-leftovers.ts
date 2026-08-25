/** READ-ONLY: JE orphan check — root EntityFields, orphan TVFs, view column count. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const f = (await p.request().query(`
    SELECT f.Name FROM __mj.EntityField f JOIN __mj.Entity e ON e.ID=f.EntityID
    WHERE e.Name='MJ_BizApps_Accounting: Journal Entries' AND f.Name LIKE 'Root%'`)).recordset;
  console.log(`Root* EntityField rows remaining: ${f.length} ${f.map(r=>r.Name).join(', ')}`);
  const fn = (await p.request().query(`
    SELECT o.name, o.type_desc FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
    WHERE s.name='__mj_BizAppsAccounting' AND o.name LIKE 'fnJournalEntry%'`)).recordset;
  console.log(`fnJournalEntry* objects in DB: ${fn.length}`);
  for (const r of fn) console.log(`   ${r.name}  (${r.type_desc})`);
  const cols=(await p.request().query(`SELECT COUNT(*) n FROM sys.columns c JOIN sys.views v ON v.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=v.schema_id WHERE s.name='__mj_BizAppsAccounting' AND v.name='vwJournalEntries'`)).recordset[0].n;
  const flds=(await p.request().query(`SELECT COUNT(*) n FROM __mj.EntityField f JOIN __mj.Entity e ON e.ID=f.EntityID WHERE e.Name='MJ_BizApps_Accounting: Journal Entries'`)).recordset[0].n;
  console.log(`vwJournalEntries columns: ${cols}   EntityFields: ${flds}   ${cols===flds?'ALIGNED':'MISMATCH'}`);
  await p.close();
}
main().catch(e=>{console.error('FAILED:',e?.message??e);process.exit(1);});
