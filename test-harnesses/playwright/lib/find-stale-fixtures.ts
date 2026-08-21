/**
 * List leftover PWBATCH-* fixture companies (an externally-killed run skips afterAll teardown).
 * Prints one `<ID> <Name>` per line — feed each ID to `batching-fixture.ts teardown <ID>`.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';

async function main(): Promise<void> {
  // Same convention as batching-fixture.ts: run from the WORKTREE ROOT; .env resolves off cwd.
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({
    server: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 1433),
    user: process.env['DB_USERNAME'],
    password: process.env['DB_PASSWORD'],
    database: process.env['DB_DATABASE'],
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  const r = await pool.request().query(`SELECT ID, Name FROM __mj.Company WHERE Name LIKE 'PWBATCH-%'`);
  for (const row of r.recordset) console.log(`${row.ID} ${row.Name}`);
  await pool.close();
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(2); });
