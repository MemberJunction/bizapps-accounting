/**
 * readmodels-fixture.ts — self-contained, leak-proof per-run seed for the tier-3 read-model harnesses
 * (T36). Replaces the tier-3 harnesses' dependency on the SHARED, persistent Association demo companies
 * (CO1..CO3, static `a55c0de1-*` UUIDs) with data this fixture CREATES with FRESH random UUIDs and TEARS
 * DOWN completely after the run — so no run-to-run artifacts and zero risk to the demo seed.
 *
 * It reproduces the EXACT read-model shape the harnesses assert (the same numbers as CO1 + CO2's
 * intercompany leg), but on two fresh companies:
 *   • MAIN company — AR open balances (Acme 300 / Globex 1000 / Initech settled=0), AR aging (Umbrella
 *     100/200/300/400 at 15/45/75/120d), deferred-revenue waterfall (defer 300 / release 120 → 180),
 *     sales-tax liability (accrued 1000 remitted 350 PartiallyPaid + accrued 500 remitted 0 Open), and
 *     FOUR posted batches (AR-open, aging, defer, release — each its own batch). NO intercompany.
 *   • PARTNER company — one posted IntercompanyFlow JE (Dr AR 250 / Cr Rev 250), sharing a fresh
 *     IntercompanyFlowID + tagging a counterparty org.
 *
 * It does NOT call `seedAssociationDemo` (that hardcodes the demo UUIDs). It replicates the needed SUBSET
 * of that recipe on fresh IDs, reusing the app's typed entities + the real BatchingEngine (buildBatch →
 * approveBatch → sendBatch with AutoApproveGate), exactly as the demo seed's `postPending` does — and
 * every buildBatch is SCOPED to a single fixture company (`companyIds`), so it can never sweep a stray
 * Pending JE belonging to anything else.
 *
 * SAFETY (a prior test corrupted shared demo data — this must NOT):
 *   • Every company/org/JE/tax/authority/jurisdiction row uses a FRESH `crypto.randomUUID()`. The fixture
 *     NEVER reads-for-mutation or deletes the static `a55c0de1-*` demo rows or CO1/CO2/CO3.
 *   • Teardown is STRICTLY scoped: accounting rows by `CompanyID IN (<the two fresh company ids>)`; the
 *     fresh orgs + tax authority/jurisdiction by their own fresh IDs (3 typed passes). Never a blanket delete.
 *
 * Run from the INSTANCE WORKTREE ROOT (so `.env` resolves), like the other harnesses:
 *   node_modules/.bin/tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/readmodels-fixture.ts setup
 *   node_modules/.bin/tsx .../readmodels-fixture.ts teardown <companyId> <partnerCompanyId> [orgId… taxAuthId taxJurId]
 *
 * `setup` prints `FIXTURE_JSON {...}` as its LAST stdout line. Exit: 0 ok · 2 error. NEVER `await
 * pool.close()` before exit (it can hang) — uses finishAndExit.
 */
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'node:path';
import { Metadata, RunView, UserInfo } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData, UserCache } from '@memberjunction/sqlserver-dataprovider';
import '@memberjunction/server-bootstrap-lite';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-core-entities-server';
import { buildBatch, approveBatch, sendBatch, AutoApproveGate } from '@mj-biz-apps/accounting-core-entities-server';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingTaxAuthorityEntity,
  mjBizAppsAccountingTaxJurisdictionEntity,
  mjBizAppsAccountingTaxLiabilityEntity,
} from '@mj-biz-apps/accounting-entities';
import type { mjBizAppsCommonOrganizationEntity } from '@mj-biz-apps/common-entities';
import { finishAndExit } from '../server/harness-exit.js';
import { assertInvariantTriggers } from '../server/trigger-preflight.js';

const SCHEMA = '__mj_BizAppsAccounting';
const COMMON_SCHEMA = '__mj_BizAppsCommon';

const ACP_ENTITY = 'MJ_BizApps_Accounting: Accounting Company Profiles';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const CURRENCY_ENTITY = 'MJ_BizApps_Accounting: Currencies';
const TAX_AUTH_ENTITY = 'MJ_BizApps_Accounting: Tax Authorities';
const TAX_JUR_ENTITY = 'MJ_BizApps_Accounting: Tax Jurisdictions';
const TAX_LIAB_ENTITY = 'MJ_BizApps_Accounting: Tax Liabilities';
const ORG_ENTITY = 'MJ_BizApps_Common: Organizations';

// GL codes W1 seeds per company (SeedData.DEFAULT_CHART_OF_ACCOUNTS).
const GL_CASH = '11101';
const GL_AR = '11201';
const GL_REVENUE = '40100';
const GL_DEFERRED = '21301';

const TARGET_SYSTEM = 'BusinessCentral' as const;

/** Distinctive per-run tag so a human can spot fixture rows (all IDs are still fresh random UUIDs). */
const RUN_TAG = `RMFIX-${Date.now().toString(36).toUpperCase()}`;

interface Pools { pool: sql.ConnectionPool; teardownPool: sql.ConnectionPool; user: UserInfo }

interface CompanyContext { companyId: string; glByCode: Map<string, string> }
interface LineSpec { glCode: string; debit?: number; credit?: number; counterparty?: string }

async function connect(): Promise<Pools> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  const { DB_HOST: host, DB_DATABASE: database, DB_USERNAME: user, DB_PASSWORD: password } = process.env;
  if (!host || !database || !user || !password) throw new Error('Missing DB settings in .env — run from the instance worktree root.');
  const port = Number(process.env.DB_PORT ?? 1433);
  const opt = { encrypt: false, trustServerCertificate: true };
  const pool = await new sql.ConnectionPool({ server: host, port, user, password, database, options: opt }).connect();
  const { CODEGEN_DB_USERNAME: cgUser, CODEGEN_DB_PASSWORD: cgPassword } = process.env;
  if (!cgUser || !cgPassword) throw new Error('Missing CODEGEN_DB_USERNAME/PASSWORD in .env (needed for FK-aware teardown).');
  const teardownPool = await new sql.ConnectionPool({ server: host, port, user: cgUser, password: cgPassword, database, options: opt }).connect();
  await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
  await assertInvariantTriggers(pool);
  await UserCache.Instance.Refresh(pool);
  const ctxUser = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
  if (!ctxUser) throw new Error('No context user found.');
  return { pool, teardownPool, user: ctxUser };
}

// ─── setup helpers ────────────────────────────────────────────────────────────

async function resolveCurrency(user: UserInfo): Promise<string> {
  const rv = new RunView();
  const cur = await rv.RunView<{ Code: string }>(
    { EntityName: CURRENCY_ENTITY, Fields: ['Code'], OrderBy: 'Code ASC', MaxRows: 1, ResultType: 'simple', BypassCache: true }, user);
  const code = cur.Results?.[0]?.Code;
  if (!code) throw new Error(`no Currency rows found (success=${cur.Success}). bizapps-common currencies must be seeded first.`);
  return code;
}

/** Create a fresh AccountingCompanyProfile (fires W1 → COA) and map its GL accounts to BusinessCentral. */
async function makeCompany(user: UserInfo, pool: sql.ConnectionPool, name: string, code: string, currency: string): Promise<CompanyContext> {
  const md = new Metadata();
  const acp = await md.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(ACP_ENTITY, user);
  acp.NewRecord();
  acp.ID = randomUUID();
  acp.Name = name;
  acp.Description = `${RUN_TAG} readmodels tier-3 fixture`;
  acp.CompanyCode = code;
  acp.FunctionalCurrencyCode = currency;
  acp.EntityType = 'Subsidiary';
  const companyId = acp.ID;
  if (!(await acp.Save())) throw new Error(`ACP save failed (${name}): ${acp.LatestResult?.CompleteMessage ?? 'unknown'}`);

  // buildBatch hard-fails on an unmapped GL account — map each to BusinessCentral, ExternalAccountID=Code.
  await pool.request().query(`UPDATE ${SCHEMA}.GLAccount SET ExternalSystem='BusinessCentral', ExternalAccountID=Code WHERE CompanyID='${companyId}'`);

  const glByCode = await loadGLByCode(user, companyId);
  for (const c of [GL_CASH, GL_AR, GL_REVENUE, GL_DEFERRED]) {
    if (!glByCode.get(c)) throw new Error(`W1 did not seed GL ${c} for company ${companyId}`);
  }
  return { companyId, glByCode };
}

async function loadGLByCode(user: UserInfo, companyId: string): Promise<Map<string, string>> {
  const rv = new RunView();
  const res = await rv.RunView<{ ID: string; Code: string }>(
    { EntityName: GL_ENTITY, ExtraFilter: `CompanyID='${companyId}'`, Fields: ['ID', 'Code'], ResultType: 'simple', BypassCache: true }, user);
  return new Map((res.Results ?? []).map((r) => [r.Code, r.ID]));
}

async function makeOrg(user: UserInfo, name: string): Promise<string> {
  const md = new Metadata();
  const org = await md.GetEntityObject<mjBizAppsCommonOrganizationEntity>(ORG_ENTITY, user);
  org.NewRecord();
  org.ID = randomUUID();
  org.Name = name;
  org.Status = 'Active';
  if (!(await org.Save())) throw new Error(`org save failed (${name}): ${org.LatestResult?.CompleteMessage ?? 'unknown'}`);
  return org.ID;
}

/** One balanced Pending JE with fresh id + lines. */
async function makeJE(
  user: UserInfo, ctx: CompanyContext, entryType: mjBizAppsAccountingJournalEntryEntity['EntryType'],
  lines: LineSpec[], opts: { effectiveDate?: Date; intercompanyFlowId?: string } = {},
): Promise<string> {
  const md = new Metadata();
  const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY, user);
  je.NewRecord();
  je.ID = randomUUID();
  je.CompanyID = ctx.companyId;
  je.EffectiveDate = opts.effectiveDate ?? new Date();
  je.EntryType = entryType;
  je.Status = 'Pending';
  je.Description = `${RUN_TAG} fixture JE`;
  if (opts.intercompanyFlowId) je.IntercompanyFlowID = opts.intercompanyFlowId;
  if (!(await je.Save())) throw new Error(`JE save failed: ${je.LatestResult?.CompleteMessage}`);
  let lineNo = 0;
  for (const spec of lines) {
    lineNo += 1;
    const glId = ctx.glByCode.get(spec.glCode);
    if (!glId) throw new Error(`makeJE: GL code ${spec.glCode} not found for company ${ctx.companyId}`);
    const l = await md.GetEntityObject<mjBizAppsAccountingJournalEntryLineEntity>(JEL_ENTITY, user);
    l.NewRecord();
    l.JournalEntryID = je.ID;
    l.LineNumber = lineNo;
    l.GLAccountID = glId;
    l.DebitAmount = spec.debit ?? null;
    l.CreditAmount = spec.credit ?? null;
    if (spec.counterparty) l.CounterpartyOrganizationID = spec.counterparty;
    if (!(await l.Save())) throw new Error(`JE line ${lineNo} save failed: ${l.LatestResult?.CompleteMessage}`);
  }
  return je.ID;
}

/**
 * Build + approve + dispatch a batch → the pending JEs become GLPosted. SCOPED to the given company so
 * the global buildBatch sweep can never pick up an unrelated stray Pending JE (leak-proofing).
 */
async function postPending(user: UserInfo, companyId: string): Promise<void> {
  const built = await buildBatch(TARGET_SYSTEM, user.ID, user, AutoApproveGate, { companyIds: [companyId] });
  if (built === null) throw new Error(`postPending: buildBatch returned null for company ${companyId} (no pending JEs or all netted to zero).`);
  await approveBatch(built.batchId, user.ID, user);
  const batch = await sendBatch(built.batchId, user, { gate: AutoApproveGate });
  if (batch.Status !== 'Posted') throw new Error(`postPending: batch should be Posted, got ${batch.Status}`);
}

async function makeTaxAuthority(user: UserInfo): Promise<string> {
  const md = new Metadata();
  const auth = await md.GetEntityObject<mjBizAppsAccountingTaxAuthorityEntity>(TAX_AUTH_ENTITY, user);
  auth.NewRecord();
  auth.ID = randomUUID();
  auth.Code = `${RUN_TAG}-CDTFA`.slice(0, 50);
  auth.Name = `${RUN_TAG} — CA Dept of Tax & Fee Admin`;
  auth.CountryCode = 'US';
  auth.IsActive = true;
  if (!(await auth.Save())) throw new Error(`tax authority save failed: ${auth.LatestResult?.CompleteMessage}`);
  return auth.ID;
}

async function makeTaxJurisdiction(user: UserInfo, authId: string): Promise<string> {
  const md = new Metadata();
  const jur = await md.GetEntityObject<mjBizAppsAccountingTaxJurisdictionEntity>(TAX_JUR_ENTITY, user);
  jur.NewRecord();
  jur.ID = randomUUID();
  jur.TaxAuthorityID = authId;
  jur.Code = `${RUN_TAG}-CA`.slice(0, 50);
  jur.Name = `${RUN_TAG} — California`;
  jur.CountryCode = 'US';
  jur.RegionCode = 'CA';
  jur.IsActive = true;
  if (!(await jur.Save())) throw new Error(`tax jurisdiction save failed: ${jur.LatestResult?.CompleteMessage}`);
  return jur.ID;
}

async function makeTaxLiability(
  user: UserInfo, companyId: string, authId: string, jurId: string, accrued: number, remitted: number,
  status: 'Filed' | 'Open' | 'Paid' | 'PartiallyPaid',
): Promise<string> {
  const md = new Metadata();
  const liab = await md.GetEntityObject<mjBizAppsAccountingTaxLiabilityEntity>(TAX_LIAB_ENTITY, user);
  liab.NewRecord();
  liab.ID = randomUUID();
  liab.CompanyID = companyId;
  liab.TaxAuthorityID = authId;
  liab.TaxJurisdictionID = jurId;
  liab.AccruedAmount = accrued;
  liab.RemittedAmount = remitted;
  liab.Status = status;
  if (!(await liab.Save())) throw new Error(`tax liability save failed: ${liab.LatestResult?.CompleteMessage}`);
  return liab.ID;
}

function daysAgoUtc(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// ─── setup ──────────────────────────────────────────────────────────────────

async function setup(p: Pools): Promise<void> {
  const { pool, user } = p;
  const currency = await resolveCurrency(user);

  const main = await makeCompany(user, pool, `${RUN_TAG} Main Co`, `${RUN_TAG}M`.slice(0, 20), currency);
  const partner = await makeCompany(user, pool, `${RUN_TAG} Partner Co`, `${RUN_TAG}P`.slice(0, 20), currency);

  // Customer orgs — names carry the fragments the tier-3 assertions match (company scoping keeps them
  // from colliding with the demo orgs of the same fragment).
  const acme = await makeOrg(user, `${RUN_TAG} Acme Partial`);
  const globex = await makeOrg(user, `${RUN_TAG} Globex Open`);
  const initech = await makeOrg(user, `${RUN_TAG} Initech Settled`);
  const umbrella = await makeOrg(user, `${RUN_TAG} Umbrella Aging`);

  // MAIN — AR open balances (batch 1). Acme 500 charge − 200 pay = 300 open; Globex 1000 open;
  // Initech 400 charge + 400 pay = net 0 (excluded from vw_AROpenByCustomer by HAVING <> 0).
  await makeJE(user, main, 'OrderBooking', [{ glCode: GL_AR, debit: 500, counterparty: acme }, { glCode: GL_REVENUE, credit: 500 }]);
  await makeJE(user, main, 'PaymentReceipt', [{ glCode: GL_CASH, debit: 200 }, { glCode: GL_AR, credit: 200, counterparty: acme }]);
  await makeJE(user, main, 'OrderBooking', [{ glCode: GL_AR, debit: 1000, counterparty: globex }, { glCode: GL_REVENUE, credit: 1000 }]);
  await makeJE(user, main, 'OrderBooking', [{ glCode: GL_AR, debit: 400, counterparty: initech }, { glCode: GL_REVENUE, credit: 400 }]);
  await makeJE(user, main, 'PaymentReceipt', [{ glCode: GL_CASH, debit: 400 }, { glCode: GL_AR, credit: 400, counterparty: initech }]);
  await postPending(user, main.companyId);

  // MAIN — AR aging (batch 2): Umbrella 4 charges at 15/45/75/120 days ago → TotalOpen 1000.
  await makeJE(user, main, 'OrderBooking', [{ glCode: GL_AR, debit: 100, counterparty: umbrella }, { glCode: GL_REVENUE, credit: 100 }], { effectiveDate: daysAgoUtc(15) });
  await makeJE(user, main, 'OrderBooking', [{ glCode: GL_AR, debit: 200, counterparty: umbrella }, { glCode: GL_REVENUE, credit: 200 }], { effectiveDate: daysAgoUtc(45) });
  await makeJE(user, main, 'OrderBooking', [{ glCode: GL_AR, debit: 300, counterparty: umbrella }, { glCode: GL_REVENUE, credit: 300 }], { effectiveDate: daysAgoUtc(75) });
  await makeJE(user, main, 'OrderBooking', [{ glCode: GL_AR, debit: 400, counterparty: umbrella }, { glCode: GL_REVENUE, credit: 400 }], { effectiveDate: daysAgoUtc(120) });
  await postPending(user, main.companyId);

  // MAIN — deferred-revenue waterfall. Defer (batch 3) and release (batch 4) post SEPARATELY so the main
  // company shows 4 batches (the BatchDispatchStatus assertion) and the two land in different months.
  await makeJE(user, main, 'RevenueRecognition', [{ glCode: GL_CASH, debit: 300 }, { glCode: GL_DEFERRED, credit: 300 }], { effectiveDate: daysAgoUtc(60) });
  await postPending(user, main.companyId);
  await makeJE(user, main, 'RevenueRecognition', [{ glCode: GL_DEFERRED, debit: 120 }, { glCode: GL_REVENUE, credit: 120 }], { effectiveDate: daysAgoUtc(30) });
  await postPending(user, main.companyId);

  // MAIN — sales tax (no JE; direct rows): accrued 1000/remitted 350 PartiallyPaid + accrued 500/remitted 0 Open.
  const taxAuthId = await makeTaxAuthority(user);
  const taxJurId = await makeTaxJurisdiction(user, taxAuthId);
  const taxLiabPartial = await makeTaxLiability(user, main.companyId, taxAuthId, taxJurId, 1000, 350, 'PartiallyPaid');
  const taxLiabOpen = await makeTaxLiability(user, main.companyId, taxAuthId, taxJurId, 500, 0, 'Open');

  // PARTNER — one IntercompanyFlow JE (Dr AR 250 / Cr Rev 250). MAIN has none (scoping assertion).
  const icFlow = randomUUID();
  await makeJE(user, partner, 'IntercompanyFlow', [{ glCode: GL_AR, debit: 250, counterparty: globex }, { glCode: GL_REVENUE, credit: 250 }], { intercompanyFlowId: icFlow });
  await postPending(user, partner.companyId);

  const descriptor = {
    companyId: main.companyId,
    partnerCompanyId: partner.companyId,
    runTag: RUN_TAG,
    customerNames: { acme: `${RUN_TAG} Acme Partial`, globex: `${RUN_TAG} Globex Open`, initech: `${RUN_TAG} Initech Settled`, umbrella: `${RUN_TAG} Umbrella Aging` },
    orgIds: [acme, globex, initech, umbrella],
    taxAuthorityId: taxAuthId,
    taxJurisdictionId: taxJurId,
    taxLiabilityIds: [taxLiabPartial, taxLiabOpen],
    intercompanyFlowId: icFlow,
    // The exact numbers the tier-3 harnesses assert against the MAIN company (identical shape to CO1):
    expected: {
      trialBalance: { accountCount: 4, sumDebits: 3920, sumCredits: 3920, arNet: 2300, sumNetBalance: 0 },
      arOpen: { customerCount: 3, sumOpen: 2300, acme: 300, globex: 1000, umbrella: 1000 },
      arAging: { customerCount: 3, sumTotalOpen: 2300, umbrella: 1000 },
      defRev: { additions: 300, releases: 120, closing: 180 },
      salesTax: { rowCount: 2, sumAccrued: 1500, sumRemitted: 350, sumOutstanding: 1150, partiallyPaidAccrued: 1000, partiallyPaidOutstanding: 650 },
      batchDispatch: { batchCount: 4, allPosted: true },
      intercompany: { mainRows: 0, partnerRowsMin: 1, entryType: 'IntercompanyFlow' },
    },
    // Trailing teardown args (companies scope the accounting deletes; these extra fresh IDs are deleted by ID):
    teardownExtraIds: [acme, globex, initech, umbrella, taxAuthId, taxJurId],
  };
  console.log(`FIXTURE_JSON ${JSON.stringify(descriptor)}`);
}

// ─── teardown (FK-aware, company-scoped) ─────────────────────────────────────

/**
 * Delete EVERYTHING the fixture created and NOTHING else. Accounting rows are scoped by
 * `CompanyID IN (mainCompanyId, partnerCompanyId)`; the fresh orgs + tax authority/jurisdiction are
 * deleted by their own fresh IDs (three typed passes). No blanket deletes; the demo `a55c0de1-*` rows
 * are never referenced.
 */
async function teardown(p: Pools, companyId: string, partnerCompanyId: string, extraIds: string[]): Promise<void> {
  const companyIds = [companyId, partnerCompanyId].filter(Boolean);
  const inList = companyIds.map((c) => `'${c}'`).join(',');
  const exec = async (q: string) => { try { await p.teardownPool.request().query(q); } catch (e) { console.log(`  teardown warn: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); } };

  // Capture this fixture's JE ids + batch ids BEFORE deleting anything (JEs carry CompanyID — MOD-12).
  let jeIdList = '';
  let batchIdList = '';
  try {
    const je = await p.teardownPool.request().query(`SELECT ID, BatchID FROM ${SCHEMA}.JournalEntry WHERE CompanyID IN (${inList})`);
    jeIdList = je.recordset.map((x: { ID: string }) => `'${x.ID}'`).join(',');
    const batchIds = [...new Set(je.recordset.map((x: { BatchID: string | null }) => x.BatchID).filter((b: string | null): b is string => !!b))];
    batchIdList = batchIds.map((b) => `'${b}'`).join(',');
  } catch (e) { console.log(`  teardown warn (je/batch scan): ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`); }

  // Locked accounting rows need triggers disabled. Always re-enable in finally.
  const toggled = ['JournalEntryBatchLineDimension', 'JournalEntryBatchLineItem', 'JournalEntryLine', 'JournalEntry', 'JournalEntryBatch'];
  try {
    for (const t of toggled) await exec(`DISABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineDimension WHERE JournalEntryBatchLineItemID IN (SELECT ID FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID IN (${inList}))`);
    if (jeIdList) {
      await exec(`DELETE FROM ${SCHEMA}.JournalEntryLine WHERE JournalEntryID IN (${jeIdList})`);
      await exec(`DELETE FROM ${SCHEMA}.JournalEntry WHERE ID IN (${jeIdList})`);
    }
    await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatchLineItem WHERE CompanyID IN (${inList})`);
    // Fixture batches are single-company (buildBatch was companyIds-scoped) — drop by their captured ids.
    if (batchIdList) await exec(`DELETE FROM ${SCHEMA}.JournalEntryBatch WHERE ID IN (${batchIdList})`);
  } finally {
    for (const t of toggled) await exec(`ENABLE TRIGGER ALL ON ${SCHEMA}.${t}`);
  }

  // Tax liabilities are company-scoped; jurisdiction/authority are dropped by fresh ID below.
  await exec(`DELETE FROM ${SCHEMA}.TaxLiability WHERE CompanyID IN (${inList})`);
  await exec(`DELETE FROM ${SCHEMA}.ChartOfAccountsMapping WHERE CompanyID IN (${inList})`);
  await exec(`DELETE FROM ${SCHEMA}.AccountingCompanyProfile WHERE ID IN (${inList})`);
  await exec(`DELETE FROM ${SCHEMA}.GLAccount WHERE CompanyID IN (${inList})`);
  // Per-company JE-numbering rows (FK_JournalEntrySequence_Company) — must go before the Company delete.
  await exec(`DELETE FROM ${SCHEMA}.JournalEntrySequence WHERE CompanyID IN (${inList})`);
  await exec(`DELETE FROM __mj.Company WHERE ID IN (${inList})`);

  // Fresh orgs + tax authority/jurisdiction: three typed passes over the explicit fresh IDs. Deleting a
  // non-matching id from a table is a harmless 0-row no-op, so the order (orgs → jurisdictions → authorities,
  // respecting the jurisdiction→authority FK) is all that matters, not which id is which.
  const idList = extraIds.filter((x) => /^[0-9a-fA-F-]{36}$/.test(x));
  if (idList.length) {
    const list = idList.map((x) => `'${x}'`).join(',');
    await exec(`DELETE FROM ${COMMON_SCHEMA}.Organization WHERE ID IN (${list})`);
    await exec(`DELETE FROM ${SCHEMA}.TaxJurisdiction WHERE ID IN (${list})`);
    await exec(`DELETE FROM ${SCHEMA}.TaxAuthority WHERE ID IN (${list})`);
  }
  console.log(`  teardown complete for companies ${companyIds.join(', ')} (+${idList.length} explicit ids)`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [, , cmd, arg1, arg2, ...rest] = process.argv;
  let pools: Pools;
  try { pools = await connect(); } catch (e) { console.error('FIXTURE BOOTSTRAP ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e)); process.exit(2); }
  try {
    if (cmd === 'setup') await setup(pools);
    else if (cmd === 'teardown') {
      if (!arg1 || !arg2) throw new Error('teardown requires <companyId> <partnerCompanyId> [extraIds…]');
      await teardown(pools, arg1, arg2, rest);
    } else throw new Error(`unknown command '${cmd}'. Use: setup | teardown <companyId> <partnerCompanyId> [extraIds…]`);
  } catch (e) {
    console.error('FIXTURE ERROR:', e instanceof Error ? (e.stack ?? e.message) : String(e));
    finishAndExit('fixture failed', 2, pools.pool, pools.teardownPool);
    return;
  }
  finishAndExit('fixture ok', 0, pools.pool, pools.teardownPool);
}

void main();
