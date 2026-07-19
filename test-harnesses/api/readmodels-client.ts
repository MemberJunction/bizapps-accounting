/**
 * Tier-3 API harness — read models, driven through the app's REAL typed client.
 *
 * TEST-ARCHITECTURE v2 rule: tier 3 imports and calls the app's OWN client (`ReadModelsClient`) —
 * the exact query documents + response mapping the Explorer dashboards ship — NOT a hand-rolled
 * `fetch` with a re-typed copy of the query. A green run here means "the interface the UI genuinely
 * uses to reach the DB returns correct accounting numbers."
 *
 * T36 (self-contained data): this harness NO LONGER asserts against the shared, persistent Association
 * demo companies (CO1..CO3). It runs `readmodels-fixture.ts setup` to create a PER-RUN pair of companies
 * with FRESH random UUIDs (identical read-model shape to CO1 + CO2's intercompany leg), asserts against
 * THOSE, then runs `readmodels-fixture.ts teardown` to remove every row it created — so there are no
 * run-to-run artifacts and the demo seed is never touched.
 *
 * Data source: real MJAPI over GraphQL (port from `mjdev ps`, `mj_sk_*` key from `mjdev key`).
 * Run from the INSTANCE WORKTREE ROOT:
 *   node_modules/.bin/tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/readmodels-client.ts
 * Exit: 0 all passed · 1 assertion failures · 2 bootstrap error.
 */
import { execSync } from 'node:child_process';
import {
  setupGraphQLClient,
  GraphQLProviderConfigData,
  GraphQLDataProvider,
} from '@memberjunction/graphql-dataprovider';
import { ReadModelsClient } from '../../packages/Angular/src/lib/custom/shared/read-models.client.js';

const LAUNCHER = process.env.MJDEV_BIN ?? '/Users/marcelotorres/MJDev/bin/mjdev';
const SLUG = process.env.MJDEV_SLUG ?? 'accounting-engine-dev';
const FIXTURE = 'packages/dev-apps/bizapps-accounting/test-harnesses/api/readmodels-fixture.ts';
const TSX = 'node_modules/.bin/tsx';

/** The machine-readable descriptor emitted by `readmodels-fixture.ts setup`. */
interface FixtureDescriptor {
  companyId: string;
  partnerCompanyId: string;
  runTag: string;
  teardownExtraIds: string[];
}

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
const sum = (xs: number[]): number => xs.reduce((s, x) => s + Number(x), 0);
const byName = <T extends { CustomerName: string | null }>(rows: T[], frag: string): T | undefined =>
  rows.find((r) => (r.CustomerName ?? '').includes(frag));

function failBootstrap(reason: string): never {
  console.error(`\nBOOTSTRAP ERROR: ${reason}`);
  console.error(`Fix: ${LAUNCHER} run ${SLUG} api  (then wait for READY)`);
  process.exit(2);
}

/** Run the fixture `setup` in a subprocess and parse its FIXTURE_JSON descriptor (last stdout line). */
function fixtureSetup(): FixtureDescriptor {
  const out = execSync(`${TSX} ${FIXTURE} setup`, { encoding: 'utf8' });
  const line = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('FIXTURE_JSON ')).pop();
  if (!line) throw new Error(`fixture setup produced no FIXTURE_JSON descriptor. Output:\n${out.slice(-500)}`);
  return JSON.parse(line.slice('FIXTURE_JSON '.length)) as FixtureDescriptor;
}

/** Run the fixture `teardown` in a subprocess — company-scoped + explicit fresh IDs. */
function fixtureTeardown(d: FixtureDescriptor): void {
  const args = [d.companyId, d.partnerCompanyId, ...d.teardownExtraIds].join(' ');
  execSync(`${TSX} ${FIXTURE} teardown ${args}`, { encoding: 'utf8' });
}

async function bootstrap(): Promise<GraphQLDataProvider> {
  // Throws (not process.exit) so the caller's `finally` still tears the fixture down on a boot failure.
  let ps: { processes?: Array<{ label?: string; status?: string; port?: number }> };
  try {
    ps = JSON.parse(execSync(`${LAUNCHER} ps ${SLUG} --json`).toString());
  } catch (e) {
    throw new Error(`could not run 'mjdev ps ${SLUG} --json': ${e instanceof Error ? e.message : String(e)}`);
  }
  const api = (ps.processes ?? []).find((p) => p.label === 'MJAPI' && p.status === 'running');
  if (!api?.port) throw new Error(`MJAPI not running for '${SLUG}'.`);
  const url = `http://localhost:${api.port}`;
  const key = execSync(`${LAUNCHER} key ${SLUG}`).toString().trim();
  const config = new GraphQLProviderConfigData('', url, '', async () => '', '__mj', undefined, undefined, undefined, key);
  const provider = await setupGraphQLClient(config);
  console.log(`Tier-3 (real client): MJAPI ${url}, key ${key.slice(0, 10)}…`);
  return provider;
}

async function run(client: ReadModelsClient, fx: FixtureDescriptor): Promise<void> {
  const CO = fx.companyId;          // fixture MAIN company (AR / DefRev / Tax) — identical shape to CO1
  const PARTNER = fx.partnerCompanyId; // fixture PARTNER company (owns the intercompany leg)
  console.log(`\nFixture ${fx.runTag}: main=${CO} partner=${PARTNER}`);

  // 1. Trial Balance — foots (Dr = Cr = 3920), nets to 0, AR(11201) net 2300.
  console.log('\nReadModelsClient.TrialBalance(main) — foots:');
  const tb = await client.TrialBalance(CO);
  check('4 GL accounts', tb.length === 4, `got ${tb.length}`);
  check('sum(Debits) === sum(Credits) === 3920', sum(tb.map(r => r.TotalDebits)) === 3920 && sum(tb.map(r => r.TotalCredits)) === 3920, `Dr ${sum(tb.map(r => r.TotalDebits))} / Cr ${sum(tb.map(r => r.TotalCredits))}`);
  check('sum(NetBalance) === 0 (balanced)', sum(tb.map(r => r.NetBalance)) === 0, `got ${sum(tb.map(r => r.NetBalance))}`);
  check('AR (11201) net === 2300', tb.find(r => r.GLAccountCode === '11201')?.NetBalance === 2300, `got ${tb.find(r => r.GLAccountCode === '11201')?.NetBalance}`);

  // 2. AR Open by Customer — Globex 1000, Umbrella 1000, Acme 300, Initech settled/excluded. Total 2300.
  console.log('\nReadModelsClient.AROpenByCustomer(main):');
  const ar = await client.AROpenByCustomer(CO);
  check('3 customers with open balance (settled excluded)', ar.length === 3, `got ${ar.length}`);
  check('sum(OpenBalance) === 2300', sum(ar.map(r => r.OpenBalance)) === 2300, `got ${sum(ar.map(r => r.OpenBalance))}`);
  check('Globex open === 1000', byName(ar, 'Globex')?.OpenBalance === 1000, `got ${byName(ar, 'Globex')?.OpenBalance}`);
  check('Umbrella open === 1000', byName(ar, 'Umbrella')?.OpenBalance === 1000, `got ${byName(ar, 'Umbrella')?.OpenBalance}`);
  check('Acme (partial) open === 300', byName(ar, 'Acme')?.OpenBalance === 300, `got ${byName(ar, 'Acme')?.OpenBalance}`);
  check('Initech (settled) absent', !byName(ar, 'Initech'), 'Initech should be excluded');

  // 3. AR Aging — DRIFT-PROOF: per-customer buckets sum to TotalOpen; totals match AR-open.
  console.log('\nReadModelsClient.ARAging(main) — drift-proof invariants:');
  const ag = await client.ARAging(CO);
  check('3 customers', ag.length === 3, `got ${ag.length}`);
  check('every customer: buckets sum to TotalOpen', ag.every(r => r.Current_0_30 + r.Days_31_60 + r.Days_61_90 + r.Days_Over_90 === r.TotalOpen), JSON.stringify(ag));
  check('sum(TotalOpen) === 2300 (matches AR-open)', sum(ag.map(r => r.TotalOpen)) === 2300, `got ${sum(ag.map(r => r.TotalOpen))}`);
  check('Umbrella TotalOpen === 1000', byName(ag, 'Umbrella')?.TotalOpen === 1000, `got ${byName(ag, 'Umbrella')?.TotalOpen}`);

  // 4. Deferred Revenue rollforward — defer 300, release 120 → a period closes at 180.
  console.log('\nReadModelsClient.DefRevRollforward(main) — waterfall:');
  const dr = await client.DefRevRollforward(CO);
  check('>= 2 rollforward periods', dr.length >= 2, `got ${dr.length}`);
  check('sum(Additions) === 300', sum(dr.map(r => r.Additions)) === 300, `got ${sum(dr.map(r => r.Additions))}`);
  check('sum(Releases) === 120', sum(dr.map(r => r.Releases)) === 120, `got ${sum(dr.map(r => r.Releases))}`);
  check('a period closes at 180 (300 − 120)', dr.some(r => r.ClosingBalance === 180), `closings ${dr.map(r => r.ClosingBalance).join(',')}`);

  // 5. Sales Tax Liability — accrued 1500 / remitted 350 / outstanding 1150; PartiallyPaid row 1000/650.
  console.log('\nReadModelsClient.SalesTaxLiability(main):');
  const tx = await client.SalesTaxLiability(CO);
  check('2 liability rows', tx.length === 2, `got ${tx.length}`);
  check('sum(Accrued) === 1500', sum(tx.map(r => r.AccruedAmount)) === 1500, `got ${sum(tx.map(r => r.AccruedAmount))}`);
  check('sum(Remitted) === 350', sum(tx.map(r => r.RemittedAmount)) === 350, `got ${sum(tx.map(r => r.RemittedAmount))}`);
  check('sum(Outstanding) === 1150', sum(tx.map(r => r.OutstandingLiability)) === 1150, `got ${sum(tx.map(r => r.OutstandingLiability))}`);
  const partial = tx.find(r => r.Status === 'PartiallyPaid');
  check('PartiallyPaid row = accrued 1000 / outstanding 650', partial?.AccruedAmount === 1000 && partial?.OutstandingLiability === 650, JSON.stringify(partial));

  // 6. Batch Dispatch Status — 4 batches contain the main company's lines, all Posted, CompanyCount >= 1.
  console.log('\nReadModelsClient.BatchDispatchStatus(main):');
  const bd = await client.BatchDispatchStatus(CO);
  check('4 batches contain main-company lines', bd.length === 4, `got ${bd.length}`);
  check("every batch Status === 'Posted'", bd.every(r => r.Status === 'Posted'), `statuses ${bd.map(r => r.Status).join(',')}`);
  check('every batch CompanyCount >= 1 (CH-4 shape)', bd.every(r => Number(r.CompanyCount) >= 1), JSON.stringify(bd.map(r => r.CompanyCount)));

  // 7. Intercompany Flow — BY-COMPANY SCOPING: main owns none, partner owns the seeded leg.
  console.log('\nReadModelsClient.IntercompanyFlow — scoping:');
  const ic1 = await client.IntercompanyFlow(CO);
  check('main has 0 intercompany rows (scoping correct)', ic1.length === 0, `got ${ic1.length}`);
  const ic2 = await client.IntercompanyFlow(PARTNER);
  check('partner has the intercompany leg (>= 1 row)', ic2.length >= 1, `got ${ic2.length}`);
  check('partner rows are EntryType IntercompanyFlow', ic2.length > 0 && ic2.every(r => r.EntryType === 'IntercompanyFlow'), `types ${ic2.map(r => r.EntryType).join(',')}`);
}

async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: read models via the REAL ReadModelsClient (self-contained fixture) ===');
  console.log('Seeding per-run fixture (fresh UUIDs)…');
  const fx = fixtureSetup();
  try {
    const provider = await bootstrap();
    const client = new ReadModelsClient(provider);
    await run(client, fx);
  } finally {
    try { fixtureTeardown(fx); console.log('\nFixture torn down (all per-run rows removed).'); }
    catch (e) { console.error(`\nWARN: fixture teardown failed — manual cleanup may be needed for company ${fx.companyId}/${fx.partnerCompanyId}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const total = passed + failed;
  console.log(`\nReadModelsClient tier-3: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
