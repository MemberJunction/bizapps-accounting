/** _maint-bc-pick-company.ts — READ-ONLY: which company is the cleanest host for the BC proof?
 *  Picks a company that has both 11201 + 40100 and NO non-terminal batches / no undrained JEs,
 *  so mapping its accounts to Business Central cannot arm any pre-existing demo data.
 */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const S = '__mj_BizAppsAccounting';
  const r = (await pool.request().query(`
    SELECT c.ID, c.Name,
      (SELECT COUNT(*) FROM ${S}.GLAccount a WHERE a.CompanyID=c.ID AND a.Code='11201') has11201,
      (SELECT COUNT(*) FROM ${S}.GLAccount a WHERE a.CompanyID=c.ID AND a.Code='40100') has40100,
      (SELECT COUNT(*) FROM ${S}.JournalEntryBatch b WHERE b.CompanyID=c.ID AND b.Status NOT IN ('Posted')) openBatches,
      (SELECT COUNT(*) FROM ${S}.JournalEntryBatch b WHERE b.CompanyID=c.ID) allBatches,
      (SELECT COUNT(*) FROM ${S}.JournalEntry je WHERE je.CompanyID=c.ID AND je.Status <> 'GLPosted') openJEs
    FROM __mj.Company c
    WHERE EXISTS (SELECT 1 FROM ${S}.GLAccount a WHERE a.CompanyID=c.ID)
    ORDER BY openBatches, openJEs, c.Name`)).recordset;
  console.log(JSON.stringify(r, null, 2));
  const clean = r.filter((x: any) => x.has11201 && x.has40100 && x.openBatches === 0 && x.openJEs === 0);
  console.log(`\nCLEAN candidates (both codes, no open batches, no open JEs): ${clean.length}`);
  for (const c of clean) console.log(`  ${c.Name}  ${c.ID}`);
  await pool.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
