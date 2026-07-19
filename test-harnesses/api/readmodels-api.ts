/**
 * Tier-3 API harness — the bizapps-accounting read-model GraphQL boundary (RAW-fetch variant).
 *
 * This is the THINNEST, MOST PRODUCTION-LIKE tier: it speaks pure HTTP/GraphQL to a running MJAPI
 * (the exact transport the Explorer dashboards + any external client use), authenticating with an
 * `X-API-Key` user key. No DB pool, no triggers, no browser. It complements `readmodels-client.ts`
 * (which drives the app's REAL typed client) by exercising the raw wire contract directly.
 *
 * T36 (self-contained data): asserts against a PER-RUN fixture (`readmodels-fixture.ts setup`) with
 * FRESH random UUIDs — NOT the shared Association demo companies (CO1..CO3) — then tears it ALL down
 * (`readmodels-fixture.ts teardown`). No run-to-run artifacts; the demo seed is never touched.
 *
 * COVERAGE BAR: this tier validates the EXPECTED VALUES the API returns over the fixture data (which
 * reproduces CO1's exact shape + CO2's intercompany leg), so a green run means "MJAPI exposes correct
 * accounting numbers + auth + scoping" — i.e. shippable at the API layer. Date-relative values (AR
 * aging buckets) assert the DRIFT-PROOF invariant (buckets sum to the customer's TotalOpen).
 *
 * Run from the INSTANCE WORKTREE ROOT (so the instance `.env`/launcher resolve):
 *   node_modules/.bin/tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/readmodels-api.ts
 *
 * Exit codes:  0 = all passed · 1 = assertion failures · 2 = bootstrap/connection error.
 */
import { execSync } from 'node:child_process';

// ─── config ───────────────────────────────────────────────────────────────────
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

// ─── tiny assert harness ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
const sum = (xs: number[]): number => xs.reduce((s, x) => s + Number(x), 0);

function failBootstrap(reason: string): never {
  console.error(`\nBOOTSTRAP ERROR: ${reason}`);
  console.error(`Fix: ${LAUNCHER} run ${SLUG} api  (then wait for READY)`);
  process.exit(2);
}

// ─── fixture lifecycle (subprocess) ────────────────────────────────────────────
function fixtureSetup(): FixtureDescriptor {
  const out = execSync(`${TSX} ${FIXTURE} setup`, { encoding: 'utf8' });
  const line = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('FIXTURE_JSON ')).pop();
  if (!line) throw new Error(`fixture setup produced no FIXTURE_JSON descriptor. Output:\n${out.slice(-500)}`);
  return JSON.parse(line.slice('FIXTURE_JSON '.length)) as FixtureDescriptor;
}

function fixtureTeardown(d: FixtureDescriptor): void {
  const args = [d.companyId, d.partnerCompanyId, ...d.teardownExtraIds].join(' ');
  execSync(`${TSX} ${FIXTURE} teardown ${args}`, { encoding: 'utf8' });
}

// ─── MJAPI resolution (port from mjdev ps, key from mjdev key) — throws so teardown still runs ───
function resolveApiUrl(): string {
  let ps: { processes?: Array<{ label?: string; status?: string; port?: number }> };
  try {
    ps = JSON.parse(execSync(`${LAUNCHER} ps ${SLUG} --json`).toString());
  } catch (e) {
    throw new Error(`could not run 'mjdev ps ${SLUG} --json': ${e instanceof Error ? e.message : String(e)}`);
  }
  const api = (ps.processes ?? []).find((p) => p.label === 'MJAPI' && p.status === 'running');
  if (!api?.port) throw new Error(`MJAPI not running for '${SLUG}'.`);
  return `http://localhost:${api.port}`;
}

function resolveApiKey(): string {
  const fromEnv = process.env.MJ_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const out = execSync(`${LAUNCHER} key ${SLUG}`, { encoding: 'utf8' });
  const key = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('mj_sk_')).pop();
  if (!key) throw new Error(`launcher produced no mj_sk_ key (got: ${JSON.stringify(out).slice(0, 200)})`);
  return key;
}

async function preflight(graphqlUrl: string, apiUrl: string): Promise<void> {
  let status: number;
  try {
    status = (await fetch(graphqlUrl, { method: 'GET' })).status;
  } catch (e) {
    throw new Error(`MJAPI is not reachable at ${apiUrl} (${e instanceof Error ? e.message : String(e)})`);
  }
  if (status >= 200 && status < 500) { console.log(`Preflight: MJAPI serving at ${apiUrl} (HTTP ${status}).`); return; }
  throw new Error(`MJAPI at ${apiUrl} returned HTTP ${status} (expected it to be serving).`);
}

// ─── gql helper: POST a query, throw on non-200 or on GraphQL errors ────────────
async function gql<T>(graphqlUrl: string, apiKey: string, query: string): Promise<T> {
  const res = await fetch(graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query }),
  });
  if (res.status !== 200) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${graphqlUrl}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors && json.errors.length > 0) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 500)}`);
  if (json.data === undefined || json.data === null) throw new Error(`GraphQL response missing data key: ${JSON.stringify(json).slice(0, 300)}`);
  return (json as { data: T }).data;
}

/** Fetch one read-model field for a company; returns rows (throws are caught by callers' check()). */
async function fetchRows<T>(graphqlUrl: string, apiKey: string, field: string, companyID: string, selection: string): Promise<T[]> {
  const data = await gql<Record<string, T[]>>(graphqlUrl, apiKey, `query { ${field}(companyID: "${companyID}") { ${selection} } }`);
  const rows = data[field];
  if (!Array.isArray(rows)) throw new Error(`data.${field} is not an array`);
  return rows;
}

// ─── row types ────────────────────────────────────────────────────────────────
interface TrialBalanceRow { GLAccountCode: string; AccountType: string; TotalDebits: number; TotalCredits: number; NetBalance: number; }
interface AROpenRow { CustomerName: string | null; OpenBalance: number; }
interface AgingRow { CustomerName: string | null; Current_0_30: number; Days_31_60: number; Days_61_90: number; Days_Over_90: number; TotalOpen: number; }
interface DefRevRow { Additions: number; Releases: number; ClosingBalance: number; }
interface TaxRow { AccruedAmount: number; RemittedAmount: number; OutstandingLiability: number; Status: string; }
interface BatchRow { Status: string; CompanyCount: number; }
interface ICRow { EntryType: string; GLAccountCode: string; }

// helper: find a customer's value by name fragment (null-safe).
const byName = <T extends { CustomerName: string | null }>(rows: T[], frag: string): T | undefined =>
  rows.find((r) => (r.CustomerName ?? '').includes(frag));

// ─── the seven read-model queries, asserted on REAL expected values ─────────────
async function run(graphqlUrl: string, apiKey: string, fx: FixtureDescriptor): Promise<void> {
  const CO = fx.companyId;             // fixture MAIN company — identical read-model shape to CO1
  const PARTNER = fx.partnerCompanyId; // fixture PARTNER company — owns the intercompany leg
  console.log(`\nFixture ${fx.runTag}: main=${CO} partner=${PARTNER}`);

  // 1. Trial Balance — must FOOT (debits = credits) and net to zero.
  console.log('\nAccountingTrialBalance(main) — foots:');
  try {
    const rows = await fetchRows<TrialBalanceRow>(graphqlUrl, apiKey, 'AccountingTrialBalance', CO, 'GLAccountCode AccountType TotalDebits TotalCredits NetBalance');
    check('4 GL accounts', rows.length === 4, `got ${rows.length}`);
    check('sum(Debits) === sum(Credits) === 3920', sum(rows.map(r => r.TotalDebits)) === 3920 && sum(rows.map(r => r.TotalCredits)) === 3920, `Dr ${sum(rows.map(r => r.TotalDebits))} / Cr ${sum(rows.map(r => r.TotalCredits))}`);
    check('sum(NetBalance) === 0 (balanced)', sum(rows.map(r => r.NetBalance)) === 0, `got ${sum(rows.map(r => r.NetBalance))}`);
    check('AR (11201) net === 2300', (rows.find(r => r.GLAccountCode === '11201')?.NetBalance) === 2300, `got ${rows.find(r => r.GLAccountCode === '11201')?.NetBalance}`);
  } catch (e) { check('AccountingTrialBalance executes', false, e instanceof Error ? e.message : String(e)); }

  // 2. AR Open by Customer — Globex 1000, Umbrella 1000, Acme 300 (Initech settled → excluded). Total 2300.
  console.log('\nAccountingAROpenByCustomer(main) — real open balances:');
  try {
    const rows = await fetchRows<AROpenRow>(graphqlUrl, apiKey, 'AccountingAROpenByCustomer', CO, 'CustomerName OpenBalance');
    check('3 customers with open balance (settled excluded)', rows.length === 3, `got ${rows.length}`);
    check('sum(OpenBalance) === 2300', sum(rows.map(r => r.OpenBalance)) === 2300, `got ${sum(rows.map(r => r.OpenBalance))}`);
    check('Globex open === 1000', byName(rows, 'Globex')?.OpenBalance === 1000, `got ${byName(rows, 'Globex')?.OpenBalance}`);
    check('Umbrella open === 1000', byName(rows, 'Umbrella')?.OpenBalance === 1000, `got ${byName(rows, 'Umbrella')?.OpenBalance}`);
    check('Acme (partial) open === 300', byName(rows, 'Acme')?.OpenBalance === 300, `got ${byName(rows, 'Acme')?.OpenBalance}`);
    check('Initech (settled) absent', !byName(rows, 'Initech'), 'Initech should be excluded by HAVING <> 0');
  } catch (e) { check('AccountingAROpenByCustomer executes', false, e instanceof Error ? e.message : String(e)); }

  // 3. AR Aging — assert DRIFT-PROOF invariants: per-customer buckets sum to TotalOpen; totals match AR-open.
  console.log('\nAccountingARAging(main) — drift-proof invariants:');
  try {
    const rows = await fetchRows<AgingRow>(graphqlUrl, apiKey, 'AccountingARAging', CO, 'CustomerName Current_0_30 Days_31_60 Days_61_90 Days_Over_90 TotalOpen');
    check('3 customers', rows.length === 3, `got ${rows.length}`);
    const bucketsSumToTotal = rows.every(r => r.Current_0_30 + r.Days_31_60 + r.Days_61_90 + r.Days_Over_90 === r.TotalOpen);
    check('every customer: buckets sum to TotalOpen', bucketsSumToTotal, JSON.stringify(rows));
    check('sum(TotalOpen) === 2300 (matches AR-open)', sum(rows.map(r => r.TotalOpen)) === 2300, `got ${sum(rows.map(r => r.TotalOpen))}`);
    check('Umbrella TotalOpen === 1000', byName(rows, 'Umbrella')?.TotalOpen === 1000, `got ${byName(rows, 'Umbrella')?.TotalOpen}`);
  } catch (e) { check('AccountingARAging executes', false, e instanceof Error ? e.message : String(e)); }

  // 4. Deferred Revenue rollforward — defer 300, release 120 → net 180.
  console.log('\nAccountingDefRevRollforward(main) — waterfall:');
  try {
    const rows = await fetchRows<DefRevRow>(graphqlUrl, apiKey, 'AccountingDefRevRollforward', CO, 'Additions Releases ClosingBalance');
    check('>= 2 rollforward periods', rows.length >= 2, `got ${rows.length}`);
    check('sum(Additions) === 300', sum(rows.map(r => r.Additions)) === 300, `got ${sum(rows.map(r => r.Additions))}`);
    check('sum(Releases) === 120', sum(rows.map(r => r.Releases)) === 120, `got ${sum(rows.map(r => r.Releases))}`);
    check('a period closes at 180 (300 deferred − 120 released)', rows.some(r => r.ClosingBalance === 180), `closings ${rows.map(r => r.ClosingBalance).join(',')}`);
  } catch (e) { check('AccountingDefRevRollforward executes', false, e instanceof Error ? e.message : String(e)); }

  // 5. Sales Tax Liability — PartiallyPaid (1000/350/650) + Open (500/0/500). Totals 1500/350/1150.
  console.log('\nAccountingSalesTaxLiability(main) — accrued/remitted/outstanding:');
  try {
    const rows = await fetchRows<TaxRow>(graphqlUrl, apiKey, 'AccountingSalesTaxLiability', CO, 'AccruedAmount RemittedAmount OutstandingLiability Status');
    check('2 liability rows', rows.length === 2, `got ${rows.length}`);
    check('sum(Accrued) === 1500', sum(rows.map(r => r.AccruedAmount)) === 1500, `got ${sum(rows.map(r => r.AccruedAmount))}`);
    check('sum(Remitted) === 350', sum(rows.map(r => r.RemittedAmount)) === 350, `got ${sum(rows.map(r => r.RemittedAmount))}`);
    check('sum(Outstanding) === 1150', sum(rows.map(r => r.OutstandingLiability)) === 1150, `got ${sum(rows.map(r => r.OutstandingLiability))}`);
    const partial = rows.find(r => r.Status === 'PartiallyPaid');
    check('PartiallyPaid row = accrued 1000 / outstanding 650', partial?.AccruedAmount === 1000 && partial?.OutstandingLiability === 650, JSON.stringify(partial));
  } catch (e) { check('AccountingSalesTaxLiability executes', false, e instanceof Error ? e.message : String(e)); }

  // 6. Batch Dispatch Status — the fixture posts 4 batches containing main-company lines, all Posted.
  console.log('\nAccountingBatchDispatchStatus(main) — all dispatched:');
  try {
    const rows = await fetchRows<BatchRow>(graphqlUrl, apiKey, 'AccountingBatchDispatchStatus', CO, 'Status CompanyCount');
    check('4 batches contain main-company lines', rows.length === 4, `got ${rows.length}`);
    check("every batch Status === 'Posted'", rows.every(r => r.Status === 'Posted'), `statuses ${rows.map(r => r.Status).join(',')}`);
    check('every batch reports a CompanyCount >= 1 (CH-4 shape)', rows.every(r => Number(r.CompanyCount) >= 1), JSON.stringify(rows));
  } catch (e) { check('AccountingBatchDispatchStatus executes', false, e instanceof Error ? e.message : String(e)); }

  // 7. Intercompany Flow — proves BY-COMPANY SCOPING: main owns none (0), partner owns the seeded leg.
  console.log('\nAccountingIntercompanyFlow — scoping (main empty, partner has the leg):');
  try {
    const co1 = await fetchRows<ICRow>(graphqlUrl, apiKey, 'AccountingIntercompanyFlow', CO, 'EntryType GLAccountCode');
    check('main has 0 intercompany rows (scoping correct)', co1.length === 0, `got ${co1.length}`);
    const co2 = await fetchRows<ICRow>(graphqlUrl, apiKey, 'AccountingIntercompanyFlow', PARTNER, 'EntryType GLAccountCode');
    check('partner has the intercompany leg (>= 1 row)', co2.length >= 1, `got ${co2.length}`);
    check('partner rows are EntryType IntercompanyFlow', co2.length > 0 && co2.every(r => r.EntryType === 'IntercompanyFlow'), `types ${co2.map(r => r.EntryType).join(',')}`);
  } catch (e) { check('AccountingIntercompanyFlow executes', false, e instanceof Error ? e.message : String(e)); }
}

// ─── main ───────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: bizapps-accounting read models (raw fetch, self-contained fixture) ===');
  console.log('Seeding per-run fixture (fresh UUIDs)…');
  const fx = fixtureSetup();
  try {
    const apiUrl = resolveApiUrl();
    const graphqlUrl = `${apiUrl}/`;
    await preflight(graphqlUrl, apiUrl);
    const apiKey = resolveApiKey();
    console.log(`Auth: X-API-Key ${apiKey.slice(0, 10)}… (resolved)`);
    await run(graphqlUrl, apiKey, fx);
  } finally {
    try { fixtureTeardown(fx); console.log('\nFixture torn down (all per-run rows removed).'); }
    catch (e) { console.error(`\nWARN: fixture teardown failed — manual cleanup may be needed for company ${fx.companyId}/${fx.partnerCompanyId}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const total = passed + failed;
  console.log(`\nAPI harness: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
