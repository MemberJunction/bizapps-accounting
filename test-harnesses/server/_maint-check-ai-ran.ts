/** Did CodeGen's AI enrichment ACTUALLY run? A green codegen is not evidence — MJ logs AI
 *  failures and still prints success + exits 0. Ground truth is __mj.AIPromptRun. */
import sql from 'mssql'; import dotenv from 'dotenv'; import path from 'path';
async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST as string, port: Number(process.env.DB_PORT ?? 1433), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE, options: { encrypt: false, trustServerCertificate: true } }).connect();
  const r = (await p.request().query(`SELECT TOP 8 RunAt, Success, TokensUsed, LEFT(ISNULL(ErrorMessage,''),90) err FROM __mj.AIPromptRun ORDER BY RunAt DESC`)).recordset;
  console.log(`AIPromptRun rows (most recent ${r.length}):`);
  for (const x of r) console.log(`  ${x.RunAt?.toISOString?.().slice(0,19)}  success=${x.Success}  tokens=${x.TokensUsed}  ${x.err}`);
  const ok = r.filter((x: any) => x.Success && (x.TokensUsed ?? 0) > 0).length;
  console.log(ok > 0 ? `\n✔ AI enrichment RAN — ${ok} successful run(s) with real token spend` : `\n✗ NO successful AI run with token spend — enrichment did NOT actually execute`);
  await p.close();
}
main().catch(e => { console.error('FAILED:', e?.message ?? e); process.exit(1); });
