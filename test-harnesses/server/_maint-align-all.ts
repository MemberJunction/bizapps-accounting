/** READ-ONLY: view-vs-EntityField alignment for EVERY entity in a schema. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  const schema = process.argv[2] ?? '__mj_BizAppsAccounting';
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const ents=(await p.request().query(`SELECT ID, Name, BaseView FROM __mj.Entity WHERE SchemaName='${schema}' ORDER BY Name`)).recordset;
  let bad=0;
  for (const e of ents) {
    const cols=(await p.request().query(`SELECT c.name FROM sys.columns c JOIN sys.views v ON v.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=v.schema_id WHERE s.name='${schema}' AND v.name='${e.BaseView}'`)).recordset.map(r=>r.name);
    const flds=(await p.request().query(`SELECT Name FROM __mj.EntityField WHERE EntityID='${e.ID}'`)).recordset.map(r=>r.Name);
    const missing=flds.filter(f=>!cols.includes(f));
    if (missing.length) { bad++; console.log(`  ✗ ${e.Name}: ${flds.length} fields vs ${cols.length} cols — missing in view: ${missing.join(', ')}`); }
  }
  console.log(`\n${ents.length} entities checked · ${bad} MISALIGNED (saves would fail on those)`);
  await p.close();
}
main().catch(e=>{console.error('FAILED:',e?.message??e);process.exit(1);});
