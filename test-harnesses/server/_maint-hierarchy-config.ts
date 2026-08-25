/** READ-ONLY: show EntityField.Configuration for self-referencing FKs, core vs app. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const rows = (await p.request().query(`
    SELECT e.SchemaName, e.Name AS EntityName, f.Name AS FieldName, f.Configuration
    FROM __mj.EntityField f
    JOIN __mj.Entity e ON e.ID = f.EntityID
    WHERE f.RelatedEntityID = f.EntityID AND f.IsVirtual = 0
    ORDER BY CASE WHEN f.Configuration IS NULL THEN 1 ELSE 0 END, e.SchemaName, e.Name, f.Name`)).recordset;
  const seeded = rows.filter(r => r.Configuration);
  const bare   = rows.filter(r => !r.Configuration);
  console.log(`self-referencing FK fields: ${rows.length}   seeded(Configuration NOT NULL): ${seeded.length}   bare(NULL): ${bare.length}\n`);
  console.log('--- SEEDED (hierarchy generation ON) ---');
  for (const r of seeded) console.log(`  [${r.SchemaName}] ${r.EntityName}.${r.FieldName}  ${String(r.Configuration).replace(/\s+/g,'')}`);
  console.log('\n--- BARE (hierarchy generation OFF as of e0bae20ca8) ---');
  for (const r of bare) console.log(`  [${r.SchemaName}] ${r.EntityName}.${r.FieldName}`);
  await p.close();
}
main().catch(e=>{console.error('FAILED:',e?.message??e);process.exit(1);});
