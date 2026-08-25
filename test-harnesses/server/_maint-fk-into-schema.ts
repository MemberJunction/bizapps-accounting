/** READ-ONLY: which FKs from OUTSIDE a schema point INTO it? (blocks DROP SCHEMA) */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  const schema = process.argv[2] ?? '__mj_BizAppsAccounting';
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const r = (await p.request().query(`
    SELECT fk.name AS fkName,
           SCHEMA_NAME(pt.schema_id) AS childSchema, pt.name AS childTable,
           SCHEMA_NAME(rt.schema_id) AS parentSchema, rt.name AS parentTable
    FROM sys.foreign_keys fk
    JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
    JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
    WHERE SCHEMA_NAME(rt.schema_id) = '${schema}'
      AND SCHEMA_NAME(pt.schema_id) <> '${schema}'
    ORDER BY childSchema, childTable`)).recordset;
  console.log(`external FKs pointing INTO ${schema}: ${r.length}`);
  const bySchema: Record<string, number> = {};
  for (const x of r) { bySchema[x.childSchema] = (bySchema[x.childSchema] ?? 0) + 1; }
  console.log('by child schema:', JSON.stringify(bySchema));
  for (const x of r.slice(0, 15)) console.log(`  ${x.childSchema}.${x.childTable} -> ${x.parentTable}  (${x.fkName})`);
  await p.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
