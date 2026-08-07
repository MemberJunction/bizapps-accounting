/**
 * MAINT — delete orphaned `__mj.Company` IS-A parent rows after a drop-schema.
 *
 * `AccountingCompanyProfile` is an IS-A Disjoint child of `__mj.Company` and shares its UUID.
 * `drop-schema` drops the APP schema (taking the child rows) but `__mj.Company` lives in MJ core,
 * so the parents survive. The demo seeder then tries to INSERT a Company at a fixed demo UUID and
 * hits `Violation of PRIMARY KEY constraint 'PK_Company_ID'`.
 *
 * This deletes only Company rows that have NO surviving profile child — i.e. genuine orphans of the
 * drop. Any Company that still has a profile, or that was created outside this app, is left alone.
 *
 *   npx tsx .../_maint-clean-orphan-company-parents.ts        # report only
 *   npx tsx .../_maint-clean-orphan-company-parents.ts --yes  # delete
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';

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

  // Demo/company parents this app owns are identifiable by the profile table being gone or empty.
  const profileExists = (await q(`SELECT OBJECT_ID('${SCHEMA}.AccountingCompanyProfile') AS id`))[0].id !== null;
  const orphanFilter = profileExists
    ? `ID NOT IN (SELECT ID FROM ${SCHEMA}.AccountingCompanyProfile)`
    : `1=1`;
  // Restrict to the deterministic demo UUID block so we never touch a real company.
  const demoBlock = `CAST(ID AS NVARCHAR(50)) LIKE 'A55C0DE1-%'`;

  const rows = await q(`SELECT ID, Name FROM __mj.Company WHERE ${demoBlock} AND ${orphanFilter}`);
  console.log(`orphaned demo Company parents: ${rows.length}`);
  rows.forEach((r: { ID: string; Name: string }) => console.log(`   ${r.ID}  ${r.Name}`));
  if (!rows.length) { await p.close(); process.exit(0); }
  if (!apply) { console.log('(dry run — pass --yes to delete)'); await p.close(); process.exit(0); }

  await p.request().query(`DELETE FROM __mj.Company WHERE ${demoBlock} AND ${orphanFilter}`);
  const left = await q(`SELECT COUNT(*) AS n FROM __mj.Company WHERE ${demoBlock} AND ${orphanFilter}`);
  console.log(`deleted; remaining: ${left[0].n}`);
  await p.close();
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(2); });
