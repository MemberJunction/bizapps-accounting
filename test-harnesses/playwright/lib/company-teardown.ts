/**
 * company-teardown.ts <companyCode> — remove a company created by the tier-5 company-creation
 * spec: its W1-seeded COA, the AccountingCompanyProfile, and the __mj.Company parent (IS-A pair).
 * Company-rooted raw SQL, same pattern as batching-fixture teardown. The spec's company has no
 * JEs/links by construction. Safe to re-run (idempotent deletes).
 *
 * Usage (cwd = instance worktree root): npx tsx …/lib/company-teardown.ts PWCO-XXXX
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';

const SCHEMA = '__mj_BizAppsAccounting';

async function main(): Promise<void> {
  const code = process.argv[2];
  if (!code || !/^PWCO-/.test(code)) throw new Error('company-teardown requires a PWCO-* company code (spec-created only)');
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env — run from the instance worktree root.');
  const pool = await new sql.ConnectionPool({
    server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  try {
    const r = await pool.request().query(`SELECT ID FROM ${SCHEMA}.AccountingCompanyProfile WHERE CompanyCode='${code}'`);
    if (r.recordset.length === 0) { console.log(`TEARDOWN_OK no company with code ${code}`); return; }
    const id = r.recordset[0].ID as string;
    const guard = await pool.request().query(`SELECT COUNT(*) c FROM ${SCHEMA}.JournalEntry WHERE CompanyID='${id}'`);
    if (guard.recordset[0].c > 0) throw new Error(`refusing: company ${code} has journal entries`);
    await pool.request().query(`DELETE l FROM ${SCHEMA}.GLAccountLink l JOIN ${SCHEMA}.GLAccount g ON l.GLAccountID=g.ID WHERE g.CompanyID='${id}'`);
    await pool.request().query(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID='${id}'`);
    await pool.request().query(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID='${id}'`);
    await pool.request().query(`DELETE FROM __mj.Company WHERE ID='${id}'`);
    console.log(`TEARDOWN_OK removed company ${code} (${id})`);
  } finally {
    void pool.close().catch(() => undefined);
    setTimeout(() => process.exit(0), 500).unref();
  }
}
main().catch((e) => { console.error('TEARDOWN ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1); });
