/**
 * _maint — purge harness-created TEST companies that leaked past a run's teardown.
 *
 * Why this exists: many harnesses create throwaway companies and delete them in teardown — but a run
 * that crashes BEFORE teardown (or, for the block harnesses, a crash inside `bootstrap()` after the
 * company was seeded but before `main()`'s teardown is reachable) leaks them. They then pollute the
 * accounting Companies screen, the company-scope chip, and the JE grid with test data that looks real.
 * (This is the operational face of the open T36 "deterministic test data" question.) Tagged prefixes:
 *   ORD2JE- / ORD2JEAPI-  — orders order→JE (server + api)     SJE-      — scheduled-je-runtime
 *   PWBATCH-              — accounting Playwright batching       ENGINE-   — engine-runtime
 *   BLOCK0-/1-/2-/4-/5-/6- — block*-runtime                      MCBATCH-  — batching-multicompany-runtime
 * NOTE: this script owns the Company / GLAccount / JE / batch footprint. The block/engine harnesses
 * also tag a few `cfo-*@mjdev.local` Users, `*-<tag>` Persons, and `DEPT-<tag>` Dimensions; those are
 * swept by each harness's own normal-path teardown and are NOT cleaned here (they don't surface as
 * "companies" in the UI). Extend this script if that orphan set ever needs mop-up too.
 *
 * SAFETY — this script refuses rather than guesses:
 *  1. It only ever touches companies whose NAME matches a harness tag (never a name-less match).
 *  2. It ABORTS if any batch mixes a test company with a real one — deleting then would gut a batch
 *     that real data depends on.
 *  3. It runs as db_owner (MJ_CodeGen) because the app login cannot DISABLE TRIGGER, and the JEs are
 *     GLPosted — i.e. protected by the immutability triggers (50003/50004/50006). Triggers are
 *     re-enabled in a `finally`, so a mid-run failure cannot leave the ledger's invariants off.
 *
 * ✅ The former KNOWN LIMITATION (bare `__mj.Company` rows surviving a re-run) was FIXED 2026-07-16 by
 * resolving batch ids from JournalEntryBatchLineItem.CompanyID as well as from the JEs — see the
 * comment at the batch-id lookup below.
 *
 * RUN ORDER: run the ORDERS purge first —
 * `bizapps-orders/test-harnesses/server/_maint-purge-orders-test-data.ts --yes`. Product rows carry
 * `OwningCompanyID -> __mj.Company`, so this script cannot drop a test company while a test product
 * still points at it. That script owns the orders footprint (products/types/orders/lines) via the MJ
 * entity layer; this one owns the Company/GLAccount/JE footprint, which needs db_owner + trigger
 * suspension and therefore cannot go through the entity layer.
 *
 * DESTRUCTIVE. Run deliberately:
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/server/_maint-purge-test-companies.ts --yes
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const SCHEMA = '__mj_BizAppsAccounting';
/**
 * Harness name tags. Anything NOT matching these is never touched (the script refuses rather than
 * guesses). Patterns are precise per-tag — never a loose 'BLOCK%' that could catch a real "Block Inc".
 */
const TEST_NAME_PATTERNS = [
  "'ORD2JE%'", "'ORD2JEAPI%'", "'PWBATCH%'", "'SJE-%'",
  "'BLOCK0-%'", "'BLOCK1-%'", "'BLOCK2-%'", "'BLOCK4-%'", "'BLOCK5-%'", "'BLOCK6-%'",
  "'ENGINE-%'", "'MCBATCH-%'",
];

(async () => {
  const confirmed = process.argv.includes('--yes');
  const { CODEGEN_DB_USERNAME: cgUser, CODEGEN_DB_PASSWORD: cgPassword } = process.env;
  if (!cgUser || !cgPassword) throw new Error('Missing CODEGEN_DB_USERNAME/PASSWORD in .env (db_owner is required: the app login cannot DISABLE TRIGGER, and the JEs are GLPosted/immutable).');

  const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST!, port: Number(process.env.DB_PORT ?? 1433),
    user: cgUser, password: cgPassword, database: process.env.DB_DATABASE!,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();

  const nameFilter = TEST_NAME_PATTERNS.map((p) => `Name LIKE ${p}`).join(' OR ');
  const co = await pool.request().query(`SELECT ID, Name FROM __mj.Company WHERE ${nameFilter}`);
  if (co.recordset.length === 0) {
    console.log('No harness-tagged test companies found — nothing to purge.');
    await pool.close();
    return;
  }
  const ids = co.recordset.map((c) => `'${c.ID}'`).join(',');
  console.log(`Found ${co.recordset.length} harness-tagged test companies:`);
  for (const c of co.recordset) console.log(`  ${c.Name}`);

  // SAFETY GATE — a batch spanning test AND real companies must not be touched.
  const mixed = await pool.request().query(`SELECT COUNT(*) n FROM (
      SELECT je.BatchID FROM ${SCHEMA}.JournalEntry je WHERE je.BatchID IS NOT NULL GROUP BY je.BatchID
      HAVING SUM(CASE WHEN je.CompanyID IN (${ids}) THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN je.CompanyID NOT IN (${ids}) THEN 1 ELSE 0 END) > 0) x`);
  if (Number(mixed.recordset[0].n) > 0) {
    console.error(`\nABORT: ${mixed.recordset[0].n} batch(es) mix test and real companies. Purging would gut a batch real data depends on. Resolve by hand.`);
    await pool.close();
    process.exit(1);
  }
  console.log('\nSafety gate passed: no batch mixes test + real companies.');

  if (!confirmed) {
    console.log('\nDRY RUN — pass --yes to actually delete.');
    await pool.close();
    return;
  }

  const exec = async (q: string) => {
    try { await pool.request().query(q); } catch (e) { console.log(`  warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }
  };
  const TRIGGERED = ['JournalEntry', 'JournalEntryLine', 'JournalEntryBatch', 'JournalEntryBatchLineItem'];
  try {
    // The JEs are GLPosted — the immutability triggers exist precisely to refuse this. Disabling
    // them is legitimate ONLY for removing test fixtures as db_owner, and only for this window.
    for (const t of TRIGGERED) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);

    // Resolve batch ids from BOTH the JEs and the batch line items. Keying off the JEs alone was the
    // old KNOWN LIMITATION: once a prior run removed a company's JEs, a re-run found no batch ids, so
    // it never cleaned the JournalEntryBatchLineItem rows still pointing at that company's GL
    // accounts — which then blocked GLAccount -> Company and left bare Company rows behind forever.
    // JournalEntryBatchLineItem.CompanyID survives the JEs, so it is the reliable key.
    const batchIds = (await pool.request().query(`
      SELECT DISTINCT BatchID id FROM ${SCHEMA}.JournalEntry WHERE CompanyID IN (${ids}) AND BatchID IS NOT NULL
      UNION
      SELECT DISTINCT BatchID id FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID IN (${ids}) AND BatchID IS NOT NULL`
    )).recordset.map((r) => `'${r.id}'`).join(',');

    // FK order: deepest child first.
    await exec(`DELETE d FROM ${SCHEMA}.JournalEntryLineDimension d JOIN ${SCHEMA}.JournalEntryLine l ON l.ID=d.JournalEntryLineID JOIN ${SCHEMA}.JournalEntry je ON je.ID=l.JournalEntryID WHERE je.CompanyID IN (${ids})`);
    await exec(`DELETE l FROM ${SCHEMA}.JournalEntryLine l JOIN ${SCHEMA}.JournalEntry je ON je.ID=l.JournalEntryID WHERE je.CompanyID IN (${ids})`);
    await exec(`DELETE li FROM ${SCHEMA}.ScheduledJournalEntryLineItem li JOIN ${SCHEMA}.ScheduledJournalEntry sje ON sje.ID=li.ScheduledJournalEntryID WHERE sje.CompanyID IN (${ids})`);
    await exec(`DELETE FROM ${SCHEMA}.ScheduledJournalEntry WHERE CompanyID IN (${ids})`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE CompanyID IN (${ids})`);
    if (batchIds) {
      await exec(`DELETE bd FROM ${SCHEMA}.JournalEntryBatchLineDimension bd JOIN ${SCHEMA}.JournalEntryBatchLineItem li ON li.ID=bd.JournalEntryBatchLineItemID WHERE li.BatchID IN (${batchIds})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE BatchID IN (${batchIds})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID IN (${batchIds})`);
    }
    await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID IN (${ids})`);
    await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID IN (${ids})`);
    await exec(`DELETE lnk FROM ${SCHEMA}.GLAccountLink lnk JOIN ${SCHEMA}.GLAccount gl ON gl.ID=lnk.GLAccountID WHERE gl.CompanyID IN (${ids})`);
    await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID IN (${ids})`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID IN (${ids})`);
    await exec(`DELETE FROM __mj.Company WHERE ID IN (${ids})`);
  } finally {
    // Non-negotiable: the ledger's invariants must not stay off because this script failed.
    for (const t of TRIGGERED) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }

  const left = await pool.request().query(`SELECT COUNT(*) n FROM __mj.Company WHERE ${nameFilter}`);
  console.log(`\nPurged. Harness-tagged companies remaining: ${left.recordset[0].n}`);
  await pool.close();
})().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message : String(e)); process.exit(1); });
