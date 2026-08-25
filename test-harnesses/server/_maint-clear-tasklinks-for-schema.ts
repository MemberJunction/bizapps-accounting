/** _maint-clear-tasklinks-for-schema.ts — clear bizapps-tasks TaskLink rows that reference a
 *  schema's __mj.Entity rows, so `mjdev app drop-schema` can delete that metadata.
 *
 *  WHY: drop-schema clears the referencing tables MJ core knows about, but a THIRD-PARTY app's FK
 *  into __mj.Entity (here FK_TaskLink_Entity) blocks the DELETE and the whole drop rolls back.
 *  Usage: npx tsx <this> [schemaName]
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  const schema = process.argv[2] ?? '__mj_BizAppsAccounting';
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const before = (await p.request().query(`SELECT COUNT(*) n FROM __mj_BizAppsTasks.TaskLink WHERE EntityID IN (SELECT ID FROM __mj.Entity WHERE SchemaName='${schema}')`)).recordset[0].n;
  console.log(`TaskLink rows referencing ${schema} entities: ${before}`);
  if (before > 0) {
    const tasks = (await p.request().query(`SELECT DISTINCT TaskID FROM __mj_BizAppsTasks.TaskLink WHERE EntityID IN (SELECT ID FROM __mj.Entity WHERE SchemaName='${schema}')`)).recordset.map(r => `'${r.TaskID}'`);
    console.log(`  belonging to ${tasks.length} task(s) — deleting their decisions, assignments, links, then the tasks`);
    if (tasks.length) {
      const inList = tasks.join(',');
      for (const stmt of [
        `DELETE FROM __mj_BizAppsTasks.TaskDecision WHERE TaskID IN (${inList})`,
        `DELETE FROM __mj_BizAppsTasks.TaskAssignment WHERE TaskID IN (${inList})`,
        `DELETE FROM __mj_BizAppsTasks.TaskActivity WHERE TaskID IN (${inList})`,
        `DELETE FROM __mj_BizAppsTasks.TaskLink WHERE TaskID IN (${inList})`,
        `DELETE FROM __mj_BizAppsTasks.Task WHERE ID IN (${inList})`,
      ]) {
        try { const r = await p.request().query(stmt); console.log(`  ${stmt.split(' FROM ')[1].split(' WHERE')[0]}: ${r.rowsAffected[0]} deleted`); }
        catch (e) { console.log(`  (skipped) ${stmt.split(' FROM ')[1].split(' WHERE')[0]}: ${(e as Error).message.slice(0, 90)}`); }
      }
    }
  }
  const after = (await p.request().query(`SELECT COUNT(*) n FROM __mj_BizAppsTasks.TaskLink WHERE EntityID IN (SELECT ID FROM __mj.Entity WHERE SchemaName='${schema}')`)).recordset[0].n;
  console.log(`remaining: ${after} ${after === 0 ? '✔ drop-schema can proceed' : '✗ still blocked'}`);
  await p.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
