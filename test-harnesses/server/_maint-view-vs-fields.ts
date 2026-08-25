/** READ-ONLY: compare a base view's actual columns against the entity's declared EntityFields. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  const entity = process.argv[2] ?? 'MJ_BizApps_Accounting: Accounting Company Profiles';
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const e=(await p.request().query(`SELECT ID, SchemaName, BaseView, BaseViewGenerated, GeneratedBaseViewName FROM __mj.Entity WHERE Name='${entity.replace(/'/g,"''")}'`)).recordset[0];
  if(!e){console.log('entity not found');return;}
  console.log(`entity=${entity}\n  schema=${e.SchemaName} baseView=${e.BaseView} generated=${e.BaseViewGenerated} genName=${e.GeneratedBaseViewName}`);
  const cols=(await p.request().query(`SELECT c.name FROM sys.columns c JOIN sys.views v ON v.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=v.schema_id WHERE s.name='${e.SchemaName}' AND v.name='${e.BaseView}' ORDER BY c.column_id`)).recordset.map(r=>r.name);
  const flds=(await p.request().query(`SELECT Name FROM __mj.EntityField WHERE EntityID='${e.ID}' ORDER BY Sequence`)).recordset.map(r=>r.Name);
  console.log(`  view columns: ${cols.length}   entity fields: ${flds.length}`);
  const inViewOnly=cols.filter(c=>!flds.includes(c));
  const inFieldsOnly=flds.filter(f=>!cols.includes(f));
  console.log(`  IN VIEW, NOT DECLARED (${inViewOnly.length}): ${inViewOnly.join(', ')}`);
  console.log(`  DECLARED, NOT IN VIEW (${inFieldsOnly.length}): ${inFieldsOnly.join(', ')}`);
  await p.close();
}
main().catch(e=>{console.error('FAILED:',e?.message??e);process.exit(1);});
