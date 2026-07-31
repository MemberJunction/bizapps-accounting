/**
 * _maint-clean-test-residue.ts — sweep leaked test companies + orphaned accounting rows.
 *
 * Why it exists (2026-07-30): the orders integration suite's bundle teardown removes its ORDERS
 * artifacts but leaks the ACCOUNTING companies it provisions (IT-ORD-* tagged ACP + Company +
 * seeded GL accounts), and the cross-app harness's pre-fix teardown ran without the CODEGEN
 * credentials, so locked (GLPosted) JEs/batches survived as orphans after their company was
 * deleted. This script finishes the job, strictly scoped:
 *   1. Company-rooted cleanup (the batching-fixture delete order) for every company whose
 *      __mj.Company name starts with 'IT-ORD' — never touches the Assoc demo companies.
 *   2. Orphan cleanup: JE lines / JEs / batches whose CompanyID no longer resolves to an ACP.
 *   3. Prints residual counts as verification.
 *
 * Trigger toggles + deletes run on the CODEGEN pool (DISABLE TRIGGER needs ALTER permission).
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-clean-test-residue.ts
 * Exit: 0 ok · 2 error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { finishAndExit } from './harness-exit.js';

const SCHEMA = '__mj_BizAppsAccounting';
const TASK_SCHEMA = '__mj_BizAppsTasks';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, CODEGEN_DB_USERNAME: user, CODEGEN_DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB/CODEGEN settings in .env — run from the instance worktree root.');
  const pool = await new sql.ConnectionPool({
    server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  const exec = async (q: string) => {
    try { return (await pool.request().query(q)).rowsAffected?.[0] ?? 0; }
    catch (e) { console.log(`  warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); return -1; }
  };

  const co = await pool.request().query(
    `SELECT p.ID id, c.Name name FROM ${SCHEMA}.AccountingCompanyProfile p JOIN __mj.Company c ON c.ID = p.ID WHERE c.Name LIKE 'IT-ORD%'`);
  const ids = co.recordset.map((r: { id: string }) => `'${r.id}'`);
  console.log(`Leaked IT-ORD companies to sweep: ${ids.length}`);
  if (ids.length > 0) {
    const IN = `(${ids.join(',')})`;

    // Approval tasks raised against these companies' batches.
    const tr = await pool.request().query(
      `SELECT t.ID id FROM ${TASK_SCHEMA}.TaskLink l JOIN ${TASK_SCHEMA}.Task t ON t.ID=l.TaskID JOIN __mj.Entity e ON e.ID=l.EntityID
        WHERE e.Name='MJ_BizApps_Accounting: Journal Entry Batches' AND l.RecordID IN (SELECT CAST(ID AS nvarchar(50)) FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID IN ${IN})`)
      .catch(() => ({ recordset: [] as { id: string }[] }));
    const taskIds = tr.recordset.map((x: { id: string }) => `'${x.id}'`).join(',');
    if (taskIds) {
      for (const t of ['TaskDecision', 'TaskActivity', 'TaskAssignment', 'TaskLink']) await exec(`DELETE FROM ${TASK_SCHEMA}.${t} WHERE TaskID IN (${taskIds})`);
      await exec(`DELETE FROM ${TASK_SCHEMA}.Task WHERE ID IN (${taskIds})`);
    }

    const toggled = ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatch'];
    try {
      for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
      await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID IN ${IN}`);
      await exec(`DELETE l FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE j.CompanyID IN ${IN}`);
      await exec(`UPDATE ${SCHEMA}.JournalEntryBatch SET SummaryJournalEntryID=NULL WHERE CompanyID IN ${IN}`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID IN ${IN}`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE CompanyID IN ${IN}`);
    } finally {
      for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    }

    // Company-scoped reference/config rows (tolerant — some tables may hold nothing).
    await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID IN ${IN}`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchSequence WHERE CompanyID IN ${IN}`);
    await exec(`DELETE FROM ${SCHEMA}.TaxLiability WHERE CompanyID IN ${IN}`);
    await exec(`DELETE FROM ${SCHEMA}.CustomerTaxProfile WHERE CompanyID IN ${IN}`);
    await exec(`DELETE FROM ${SCHEMA}.CompanyTaxNexus WHERE CompanyID IN ${IN}`);
    await exec(`DELETE d FROM ${SCHEMA}.GLAccountLinkDimension d JOIN ${SCHEMA}.GLAccountLink k ON k.ID=d.GLAccountLinkID JOIN ${SCHEMA}.GLAccount g ON g.ID=k.GLAccountID WHERE g.CompanyID IN ${IN}`);
    await exec(`DELETE k FROM ${SCHEMA}.GLAccountLink k JOIN ${SCHEMA}.GLAccount g ON g.ID=k.GLAccountID WHERE g.CompanyID IN ${IN}`);
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID IN ${IN}`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID IN ${IN}`);
    await exec(`DELETE FROM __mj.Company WHERE ID IN ${IN}`);
  }

  // Orphans: accounting rows whose company profile no longer exists (any tag).
  console.log('Sweeping orphaned JEs/batches (company profile gone):');
  const toggled = ['JournalEntryLine', 'JournalEntry', 'JournalEntryBatch'];
  const orphanJE = `NOT EXISTS (SELECT 1 FROM ${SCHEMA}.AccountingCompanyProfile p WHERE p.ID = j.CompanyID)`;
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE ${orphanJE}`);
    await exec(`DELETE l FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry j ON j.ID=l.JournalEntryID WHERE ${orphanJE}`);
    await exec(`UPDATE b SET SummaryJournalEntryID=NULL FROM ${SCHEMA}.JournalEntryBatch b WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.AccountingCompanyProfile p WHERE p.ID = b.CompanyID)`);
    await exec(`DELETE j FROM ${SCHEMA}.JournalEntry j WHERE ${orphanJE}`);
    await exec(`DELETE b FROM ${SCHEMA}.JournalEntryBatch b WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.AccountingCompanyProfile p WHERE p.ID = b.CompanyID)`);
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }

  const v = await pool.request().query(`
    SELECT 'IT-ORD companies' k, COUNT(*) n FROM ${SCHEMA}.AccountingCompanyProfile p JOIN __mj.Company c ON c.ID=p.ID WHERE c.Name LIKE 'IT-ORD%'
    UNION ALL SELECT 'orphan JEs', COUNT(*) FROM ${SCHEMA}.JournalEntry j WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.AccountingCompanyProfile p WHERE p.ID=j.CompanyID)
    UNION ALL SELECT 'orphan batches', COUNT(*) FROM ${SCHEMA}.JournalEntryBatch b WHERE NOT EXISTS (SELECT 1 FROM ${SCHEMA}.AccountingCompanyProfile p WHERE p.ID=b.CompanyID)
    UNION ALL SELECT 'companies remaining', COUNT(*) FROM ${SCHEMA}.AccountingCompanyProfile`);
  console.log('Verification:');
  for (const r of v.recordset) console.log(`  ${r.k}: ${r.n}`);
  finishAndExit('residue sweep done', 0, pool);
}
main().catch((e) => { console.error('MAINT ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); });
