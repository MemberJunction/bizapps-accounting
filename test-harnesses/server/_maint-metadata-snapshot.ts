/**
 * MAINT (not a test) — snapshot / diff the app's __mj metadata.
 *
 * The AI-enrichment rebuild (drop-schema -> migrate -> codegen --ai) re-creates every Entity and
 * EntityField row from scratch, which re-mints their IDs. So the ONLY way to answer "did we lose
 * anything we had deliberately set?" is to compare SEMANTICALLY — keyed on entity+field NAME, never
 * on ID, and ignoring ordering entirely.
 *
 * Run from the instance worktree root (reads .env from cwd, like the other harnesses):
 *   npx tsx .../_maint-metadata-snapshot.ts snapshot <out.json>
 *   npx tsx .../_maint-metadata-snapshot.ts diff <before.json> <after.json>
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const SCHEMA = '__mj_BizAppsAccounting';

/** The fields a human may have deliberately set, and that AI enrichment can overwrite. */
interface FieldSnap {
  Entity: string; Field: string;
  Description: string; Category: string;
  IsNameField: boolean; DefaultInView: boolean; IncludeInUserSearchAPI: boolean;
  Sequence: number;
}
interface EntitySnap { Entity: string; Description: string; BaseView: string; }
interface RelSnap { Entity: string; RelatedEntity: string; DisplayInForm: boolean; DisplayName: string; }
interface Snapshot { entities: EntitySnap[]; fields: FieldSnap[]; relationships: RelSnap[] }

async function connect(): Promise<sql.ConnectionPool> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  return new sql.ConnectionPool({
    server: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 1433),
    user: process.env['DB_USERNAME'],
    password: process.env['DB_PASSWORD'],
    database: process.env['DB_DATABASE'],
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

async function snapshot(out: string): Promise<void> {
  const p = await connect();
  const q = async <T>(s: string): Promise<T[]> => (await p.request().query(s)).recordset as T[];
  const snap: Snapshot = {
    entities: await q<EntitySnap>(`
      SELECT e.Name AS Entity, ISNULL(e.Description,'') AS Description, ISNULL(e.BaseView,'') AS BaseView
      FROM __mj.Entity e WHERE e.SchemaName='${SCHEMA}' ORDER BY e.Name`),
    fields: await q<FieldSnap>(`
      SELECT e.Name AS Entity, f.Name AS Field, ISNULL(f.Description,'') AS Description,
             ISNULL(f.Category,'') AS Category, f.IsNameField, f.DefaultInView,
             f.IncludeInUserSearchAPI, f.Sequence
      FROM __mj.Entity e JOIN __mj.EntityField f ON f.EntityID=e.ID
      WHERE e.SchemaName='${SCHEMA}' ORDER BY e.Name, f.Name`),
    relationships: await q<RelSnap>(`
      SELECT e.Name AS Entity, re.Name AS RelatedEntity, r.DisplayInForm, ISNULL(r.DisplayName,'') AS DisplayName
      FROM __mj.EntityRelationship r
      JOIN __mj.Entity e ON e.ID=r.EntityID JOIN __mj.Entity re ON re.ID=r.RelatedEntityID
      WHERE e.SchemaName='${SCHEMA}' ORDER BY e.Name, re.Name`),
  };
  fs.writeFileSync(out, JSON.stringify(snap, null, 1));
  console.log(`snapshot -> ${out}\n  entities=${snap.entities.length} fields=${snap.fields.length} relationships=${snap.relationships.length}`);
  await p.close();
}

function diff(beforePath: string, afterPath: string): void {
  const a: Snapshot = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
  const b: Snapshot = JSON.parse(fs.readFileSync(afterPath, 'utf8'));
  const fk = (f: FieldSnap) => `${f.Entity}::${f.Field}`;
  const before = new Map(a.fields.map((f) => [fk(f), f]));
  const after = new Map(b.fields.map((f) => [fk(f), f]));

  const lost: string[] = [], gained: string[] = [], changed: string[] = [];
  for (const [k, f] of before) {
    const g = after.get(k);
    if (!g) { lost.push(`  FIELD GONE: ${k}`); continue; }
    // A value we HAD and no longer have is the only true regression.
    if (f.Description && !g.Description) lost.push(`  DESC LOST: ${k}\n      was: ${f.Description.slice(0, 110)}`);
    else if (f.Description && g.Description && f.Description !== g.Description)
      changed.push(`  DESC CHANGED: ${k}\n      was: ${f.Description.slice(0, 110)}\n      now: ${g.Description.slice(0, 110)}`);
    else if (!f.Description && g.Description) gained.push(`  DESC ADDED: ${k}: ${g.Description.slice(0, 100)}`);
    for (const flag of ['IsNameField', 'DefaultInView', 'IncludeInUserSearchAPI'] as const) {
      if (f[flag] && !g[flag]) lost.push(`  ${flag} TURNED OFF: ${k}`);
      else if (!f[flag] && g[flag]) gained.push(`  ${flag} turned on: ${k}`);
    }
    if (f.Category && g.Category && f.Category !== g.Category) changed.push(`  CATEGORY: ${k}: '${f.Category}' -> '${g.Category}'`);
  }
  for (const k of after.keys()) if (!before.has(k)) gained.push(`  NEW FIELD: ${k}`);

  const eBefore = new Map(a.entities.map((e) => [e.Entity, e]));
  for (const e of b.entities) {
    const o = eBefore.get(e.Entity);
    if (o && o.Description && o.Description !== e.Description)
      (e.Description ? changed : lost).push(`  ENTITY DESC ${e.Description ? 'CHANGED' : 'LOST'}: ${e.Entity}\n      was: ${o.Description.slice(0, 110)}\n      now: ${e.Description.slice(0, 110)}`);
  }
  for (const e of eBefore.keys()) if (!b.entities.some((x) => x.Entity === e)) lost.push(`  ENTITY GONE: ${e}`);

  const rk = (r: RelSnap) => `${r.Entity} -> ${r.RelatedEntity}`;
  const rBefore = new Map(a.relationships.map((r) => [rk(r), r]));
  for (const r of b.relationships) {
    const o = rBefore.get(rk(r));
    if (o && o.DisplayInForm !== r.DisplayInForm)
      (o.DisplayInForm ? lost : gained).push(`  REL DisplayInForm ${o.DisplayInForm ? 'OFF' : 'on'}: ${rk(r)}`);
  }

  const section = (title: string, rows: string[]) => {
    console.log(`\n${title} (${rows.length})`);
    rows.slice(0, 60).forEach((r) => console.log(r));
    if (rows.length > 60) console.log(`  … and ${rows.length - 60} more`);
  };
  console.log(`SEMANTIC METADATA DIFF — keyed on name, order-independent`);
  section('🔴 REGRESSIONS (had a value, now gone/off) — REVIEW EVERY ONE', lost);
  section('🟡 CHANGED (both had values, AI rewrote)', changed);
  section('🟢 GAINED (was empty, AI filled)', gained);
  console.log(`\nSUMMARY: ${lost.length} regressions · ${changed.length} rewrites · ${gained.length} additions`);
}

async function main(): Promise<void> {
  const [mode, x, y] = process.argv.slice(2);
  if (mode === 'snapshot') { await snapshot(x); process.exit(0); }
  if (mode === 'diff') { diff(x, y); process.exit(0); }
  console.error('usage: snapshot <out.json> | diff <before.json> <after.json>');
  process.exit(2);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(2); });
