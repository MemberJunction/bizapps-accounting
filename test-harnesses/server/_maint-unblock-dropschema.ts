/**
 * MAINT — clear the bizapps-tasks rows that block `mjdev app drop-schema`.
 *
 * mjdev's cleanMetadata sweeps every __mj-CORE foreign key into __mj.Entity, but not other OPEN
 * APPS' foreign keys. __mj_BizAppsTasks.TaskLink.EntityID points at accounting entities (the
 * batch-approval Tasks this app raises), so the DELETE FROM __mj.Entity conflicts with
 * FK_TaskLink_Entity and the whole drop rolls back. Any app that raises approval Tasks hits this.
 *
 * These rows are approval-workflow bookkeeping for batches that are themselves about to be dropped,
 * so removing them loses nothing that survives the drop anyway.
 *
 *   npx tsx .../_maint-unblock-dropschema.ts        # report only
 *   npx tsx .../_maint-unblock-dropschema.ts --yes  # actually delete
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';

const TASKS = '__mj_BizAppsTasks';
const SCHEMA = '__mj_BizAppsAccounting';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const apply = process.argv.includes('--yes');
  const p = await new sql.ConnectionPool({
    server: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 1433),
    user: process.env['CODEGEN_DB_USERNAME'] ?? process.env['DB_USERNAME'],
    password: process.env['CODEGEN_DB_PASSWORD'] ?? process.env['DB_PASSWORD'],
    database: process.env['DB_DATABASE'],
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  const q = async (s: string) => (await p.request().query(s)).recordset;

  const scope = `SELECT ID FROM __mj.Entity WHERE SchemaName='${SCHEMA}'`;
  const before = await q(`SELECT COUNT(*) AS n FROM ${TASKS}.TaskLink WHERE EntityID IN (${scope})`);
  console.log(`TaskLink rows referencing ${SCHEMA} entities: ${before[0].n}`);
  if (!apply) { console.log('(dry run — pass --yes to delete)'); await p.close(); process.exit(0); }

  // Task children first (FK order), then the links, then the now-orphaned tasks.
  const taskIds = `SELECT TaskID FROM ${TASKS}.TaskLink WHERE EntityID IN (${scope})`;
  for (const stmt of [
    `DELETE FROM ${TASKS}.TaskDecision WHERE TaskID IN (${taskIds})`,
    `DELETE FROM ${TASKS}.TaskActivity WHERE TaskID IN (${taskIds})`,
    `DELETE FROM ${TASKS}.TaskAssignment WHERE TaskID IN (${taskIds})`,
    `DELETE FROM ${TASKS}.Task WHERE ID IN (${taskIds})`,
    `DELETE FROM ${TASKS}.TaskLink WHERE EntityID IN (${scope})`,
  ]) {
    try { await p.request().query(stmt); console.log(`  ok: ${stmt.slice(0, 60)}…`); }
    catch (e) { console.log(`  warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
  }
  const after = await q(`SELECT COUNT(*) AS n FROM ${TASKS}.TaskLink WHERE EntityID IN (${scope})`);
  console.log(`remaining: ${after[0].n}`);
  await p.close();
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(2); });
