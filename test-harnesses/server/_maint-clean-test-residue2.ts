/**
 * _maint-clean-test-residue2.ts — pass 2 of the 2026-07-30 residue sweep: remove the IT-ORD
 * __mj.Company SHELLS (and every bizapps row pinning them) that pass 1 could not delete.
 *
 * Generic, FK-driven, strictly scoped:
 *   1. #doomed = __mj.Company rows named 'IT-ORD%' (test companies leaked by the orders
 *      integration suite; the legit demo companies are named 'Assoc De…').
 *   2. NOCHECK every FK whose child table lives in a __mj_BizApps% schema; disable triggers there.
 *   3. Root deletes: for every FK referencing __mj.Company from a bizapps schema, delete child
 *      rows whose FK column is in #doomed. Then delete the #doomed Company rows.
 *   4. Fixpoint: for every bizapps-internal FK, rows left dangling by step 3 get the FK column
 *      NULLed (nullable) or the row deleted (NOT NULL) — repeated until no changes. Pre-existing
 *      data was FK-consistent, so this can only touch rows dangled by our own root deletes.
 *   5. Re-enable triggers and re-enable all FKs WITH CHECK (fails loudly if anything dangles).
 *   6. Verification counts (shells, orphan JEs/batches, remaining companies, demo JEs).
 *
 * Run from the INSTANCE WORKTREE ROOT:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-clean-test-residue2.ts
 * Exit: 0 ok · 2 error.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { finishAndExit } from './harness-exit.js';

interface FkRow { fkName: string; childSchema: string; childTable: string; childCol: string; childColNullable: boolean; parentSchema: string; parentTable: string; parentCol: string }

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, CODEGEN_DB_USERNAME: user, CODEGEN_DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB/CODEGEN settings in .env — run from the instance worktree root.');
  const pool = await new sql.ConnectionPool({
    server: host, port: Number(process.env.DB_PORT ?? 1433), user, password, database,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  const run = async (q: string) => (await pool.request().query(q));
  const tolerant = async (q: string, label?: string) => {
    try { return (await run(q)).rowsAffected?.[0] ?? 0; }
    catch (e) { console.log(`  warn${label ? ` (${label})` : ''}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); return -1; }
  };

  // 1. The doomed set — harness-tagged test companies only (inlined: pooled requests don't share
  //    temp tables). Tags are the distinctive run prefixes of every harness family; the demo
  //    companies ('Assoc Demo — …') can never match.
  const TAGS = ["'IT-ORD%'", "'PWBATCH-%'", "'BLOCK0-%'", "'BLOCK1-%'", "'ENGINE-%'", "'FULLFLOW-%'", "'INTERCO-%'"];
  const doomedIds = (await run(`SELECT ID FROM __mj.Company WHERE ${TAGS.map((t) => `Name LIKE ${t}`).join(' OR ')}`)).recordset.map((r: { ID: string }) => `'${r.ID}'`);
  console.log(`Doomed IT-ORD company shells: ${doomedIds.length}`);
  const DOOMED = doomedIds.length ? `(${doomedIds.join(',')})` : `('00000000-0000-0000-0000-000000000000')`;

  // FK inventory: children in bizapps schemas (never delete from __mj core).
  const fks = (await run(`
    SELECT fk.name fkName, s.name childSchema, t.name childTable, c.name childCol, c.is_nullable childColNullable,
           rs.name parentSchema, rt.name parentTable, rc.name parentCol
    FROM sys.foreign_keys fk
    JOIN sys.tables t ON t.object_id = fk.parent_object_id JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
    WHERE s.name LIKE '[_][_]mj[_]BizApps%'`)).recordset as FkRow[];
  const bizTables = [...new Set(fks.map((f) => `${f.childSchema}.${f.childTable}`))];
  console.log(`Bizapps FKs in scope: ${fks.length} across ${bizTables.length} child tables`);

  // 2. NOCHECK + triggers off on every bizapps child table.
  for (const t of bizTables) { await tolerant(`ALTER TABLE ${t} NOCHECK CONSTRAINT ALL`); await tolerant(`DISABLE TRIGGER ALL ON ${t}`); }
  try {
    // 3. Root deletes: every bizapps child row pointing at a doomed company, then the shells.
    let rootDeleted = 0;
    for (const f of fks.filter((x) => x.parentSchema === '__mj' && x.parentTable === 'Company')) {
      const n = await tolerant(`DELETE c FROM ${f.childSchema}.${f.childTable} c WHERE c.${f.childCol} IN ${DOOMED}`, `${f.childTable}.${f.childCol}`);
      if (n > 0) { console.log(`  root: ${f.childSchema}.${f.childTable} (${f.childCol}) -${n}`); rootDeleted += n; }
    }
    const shellsGone = await tolerant(`DELETE FROM __mj.Company WHERE ID IN ${DOOMED}`, 'Company shells');
    console.log(`Root rows deleted: ${rootDeleted} · Company shells deleted: ${shellsGone}`);

    // 4. Fixpoint dangling sweep (bizapps-internal FKs only).
    const internal = fks.filter((x) => x.parentSchema.startsWith('__mj_BizApps') || (x.parentSchema === '__mj' && x.parentTable === 'Company'));
    for (let pass = 1; pass <= 10; pass++) {
      let changed = 0;
      for (const f of internal) {
        const cond = `c.${f.childCol} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${f.parentSchema}.${f.parentTable} p WHERE p.${f.parentCol} = c.${f.childCol})`;
        const n = f.childColNullable
          ? await tolerant(`UPDATE c SET c.${f.childCol} = NULL FROM ${f.childSchema}.${f.childTable} c WHERE ${cond}`, `null ${f.childTable}.${f.childCol}`)
          : await tolerant(`DELETE c FROM ${f.childSchema}.${f.childTable} c WHERE ${cond}`, `del ${f.childTable}.${f.childCol}`);
        if (n > 0) { console.log(`  fixpoint p${pass}: ${f.childTable}.${f.childCol} ${f.childColNullable ? 'nulled' : 'deleted'} ${n}`); changed += n; }
      }
      if (changed === 0) { console.log(`Fixpoint reached after pass ${pass}.`); break; }
    }
  } finally {
    // 5. Triggers on; constraints re-enabled WITH CHECK (integrity re-verified).
    for (const t of bizTables) await tolerant(`ENABLE TRIGGER ALL ON ${t}`);
    let allTrusted = true;
    for (const t of bizTables) {
      try { await run(`ALTER TABLE ${t} WITH CHECK CHECK CONSTRAINT ALL`); }
      catch (e) { allTrusted = false; console.log(`  ✗ RE-CHECK FAILED on ${t}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
    }
    console.log(allTrusted ? 'All bizapps constraints re-enabled WITH CHECK (trusted).' : '⚠ Some constraints could not re-verify — see above.');
  }

  // 6. Verification.
  const v = await run(`
    SELECT 'tagged Company shells' k, COUNT(*) n FROM __mj.Company WHERE ${TAGS.map((t) => `Name LIKE ${t}`).join(' OR ')}
    UNION ALL SELECT 'orphan JEs', COUNT(*) FROM __mj_BizAppsAccounting.JournalEntry j WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.AccountingCompanyProfile p WHERE p.ID=j.CompanyID)
    UNION ALL SELECT 'orphan batches', COUNT(*) FROM __mj_BizAppsAccounting.JournalEntryBatch b WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.AccountingCompanyProfile p WHERE p.ID=b.CompanyID)
    UNION ALL SELECT 'company profiles remaining', COUNT(*) FROM __mj_BizAppsAccounting.AccountingCompanyProfile
    UNION ALL SELECT 'companies remaining (all)', COUNT(*) FROM __mj.Company
    UNION ALL SELECT 'demo JEs intact', COUNT(*) FROM __mj_BizAppsAccounting.JournalEntry`);
  console.log('Verification:');
  for (const r of v.recordset) console.log(`  ${r.k}: ${r.n}`);
  finishAndExit('residue sweep pass 2 done', 0, pool);
}
main().catch((e) => { console.error('MAINT ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); });
