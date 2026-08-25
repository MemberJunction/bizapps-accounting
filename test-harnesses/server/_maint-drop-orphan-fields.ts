/** Remove EntityField rows that describe base-view columns which do not exist.
 *  Cause (traced 2026-08-24): MJ PR #3948 / commit e0bae20ca8 gated recursive-hierarchy
 *  generation behind EntityField.Configuration.Hierarchy.IsHierarchy. Journal Entries'
 *  two reversal pointers are correctly NOT opted in, so CodeGen stopped projecting
 *  Root* columns into vwJournalEntries while the baseline's EntityField rows persisted,
 *  making field count (26) disagree with view column count (24) and failing every save.
 *  SUPERSEDED as a fix by migrations/V202608241730__v1.0.x__Regenerate_CodeGen_MJ6_Hierarchy_Gate.sql,
 *  which does this durably for every database. Kept as a diagnostic.
 *  Read-only unless --apply is passed. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const schema = '__mj_BizAppsAccounting';
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const ents=(await p.request().query(`SELECT ID, Name, BaseView FROM __mj.Entity WHERE SchemaName='${schema}'`)).recordset;
  let total=0;
  for (const e of ents) {
    const cols=(await p.request().query(`SELECT c.name FROM sys.columns c JOIN sys.views v ON v.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=v.schema_id WHERE s.name='${schema}' AND v.name='${e.BaseView}'`)).recordset.map(r=>r.name);
    if (!cols.length) continue;
    const orphans=(await p.request().query(`SELECT ID, Name FROM __mj.EntityField WHERE EntityID='${e.ID}'`)).recordset.filter((f:any)=>!cols.includes(f.Name));
    for (const o of orphans) {
      console.log(`  ${apply?'DELETING':'would delete'}: ${e.Name}.${o.Name}`);
      if (apply) await p.request().query(`DELETE FROM __mj.EntityField WHERE ID='${o.ID}'`);
      total++;
    }
  }
  console.log(`\n${total} orphaned field(s) ${apply?'deleted':'found (dry run — pass --apply)'}`);
  await p.close();
}
main().catch(e=>{console.error('FAILED:',e?.message??e);process.exit(1);});
