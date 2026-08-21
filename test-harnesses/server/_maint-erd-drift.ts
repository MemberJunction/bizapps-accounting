/**
 * MAINT (not a test) — ERD drift check. Compares the tables/columns documented in
 * docs/bizapps-accounting-erd.md's mermaid erDiagram blocks against the LIVE schema.
 * Run from the instance worktree root (reads .env from cwd, like the other harnesses).
 *
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-erd-drift.ts
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const SCHEMA = '__mj_BizAppsAccounting';
const ERD = path.resolve(process.cwd(), 'packages/dev-apps/bizapps-accounting/docs/bizapps-accounting-erd.md');

/** Every `TableName { ... type Column ... }` body inside a ```mermaid erDiagram``` block. */
function parseErd(md: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const blocks = md.split('```').filter((b) => b.trimStart().startsWith('mermaid'));
  for (const b of blocks) {
    if (!/erDiagram/.test(b)) continue;
    // Entity blocks: NAME { ...lines... }
    const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\{([^}]*)\}/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(b))) {
      const table = m[1];
      const cols = out.get(table) ?? new Set<string>();
      for (const raw of m[2].split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('%%')) continue;
        // "uniqueidentifier ID PK" | "nvarchar(50) Code" | "decimal Amount \"note\""
        const parts = line.replace(/"[^"]*"/g, '').trim().split(/\s+/);
        if (parts.length >= 2) cols.add(parts[1]);
      }
      out.set(table, cols);
    }
  }
  return out;
}

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const pool = await new sql.ConnectionPool({
    server: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 1433),
    user: process.env['DB_USERNAME'],
    password: process.env['DB_PASSWORD'],
    database: process.env['DB_DATABASE'],
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();

  const r = await pool.request().query(`
    SELECT t.name AS TableName, c.name AS ColumnName
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.columns c ON c.object_id = t.object_id
    WHERE s.name = '${SCHEMA}'
    ORDER BY t.name, c.column_id`);

  const live = new Map<string, Set<string>>();
  for (const row of r.recordset as Array<{ TableName: string; ColumnName: string }>) {
    if (!live.has(row.TableName)) live.set(row.TableName, new Set());
    live.get(row.TableName)!.add(row.ColumnName);
  }

  const erd = parseErd(fs.readFileSync(ERD, 'utf8'));
  // CodeGen owns these; the ERD documents them once in prose, not per table.
  const SYSTEM_COLS = new Set(['__mj_CreatedAt', '__mj_UpdatedAt', '__mj_DeletedAt']);

  const missingTables: string[] = [];
  const extraTables: string[] = [];
  const colDrift: string[] = [];

  for (const [t, liveCols] of live) {
    const erdCols = erd.get(t);
    if (!erdCols) { missingTables.push(t); continue; }
    const notInErd = [...liveCols].filter((c) => !erdCols.has(c) && !SYSTEM_COLS.has(c));
    const notInDb = [...erdCols].filter((c) => !liveCols.has(c));
    if (notInErd.length || notInDb.length) {
      colDrift.push(`  ${t}\n${notInErd.length ? `    in DB, NOT in ERD: ${notInErd.join(', ')}\n` : ''}${notInDb.length ? `    in ERD, NOT in DB: ${notInDb.join(', ')}\n` : ''}`);
    }
  }
  for (const t of erd.keys()) if (!live.has(t)) extraTables.push(t);

  console.log(`Live tables: ${live.size} · ERD entity blocks: ${erd.size}\n`);
  if (missingTables.length) console.log(`TABLES IN DB, NOT IN ERD (${missingTables.length}):\n  ${missingTables.join('\n  ')}\n`);
  if (extraTables.length) console.log(`ENTITY BLOCKS IN ERD, NOT A LIVE TABLE (${extraTables.length}) — external/__mj refs are expected here:\n  ${extraTables.join('\n  ')}\n`);
  if (colDrift.length) console.log(`COLUMN DRIFT (${colDrift.length} tables):\n${colDrift.join('')}`);
  if (!missingTables.length && !colDrift.length) console.log('No table/column drift.');

  await pool.close();
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(2); });
