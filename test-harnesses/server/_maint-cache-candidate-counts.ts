/** _maint-cache-candidate-counts.ts — READ-ONLY: row counts for engine-cache candidate entities, so
 *  caching decisions are size-informed ("don't cache too much data"). Run from the instance worktree root:
 *    npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-cache-candidate-counts.ts */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';

const QUERY = `
SELECT 'GLAccount' e, COUNT(*) n FROM __mj_BizAppsAccounting.GLAccount
UNION ALL SELECT 'ChartOfAccountsMapping', COUNT(*) FROM __mj_BizAppsAccounting.ChartOfAccountsMapping
UNION ALL SELECT 'TaxAuthority', COUNT(*) FROM __mj_BizAppsAccounting.TaxAuthority
UNION ALL SELECT 'TaxJurisdiction', COUNT(*) FROM __mj_BizAppsAccounting.TaxJurisdiction
UNION ALL SELECT 'TaxRate', COUNT(*) FROM __mj_BizAppsAccounting.TaxRate
UNION ALL SELECT 'CurrencySpotRate', COUNT(*) FROM __mj_BizAppsAccounting.CurrencySpotRate
UNION ALL SELECT 'AccountingCompanyProfile', COUNT(*) FROM __mj_BizAppsAccounting.AccountingCompanyProfile
ORDER BY n DESC;`;

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 1433),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  const r = await pool.request().query(QUERY);
  console.log('\nrows   entity');
  for (const row of r.recordset) console.log(String(row.n).padStart(6), row.e);
  await pool.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
