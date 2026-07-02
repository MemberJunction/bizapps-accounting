/**
 * Tier-3 API harness — the bizapps-accounting read-model GraphQL boundary.
 *
 * This is the THINNEST, MOST PRODUCTION-LIKE tier: it speaks pure HTTP/GraphQL to a running MJAPI
 * (the exact transport the Explorer dashboards + any external client use), authenticating with an
 * `X-API-Key` user key. No DB pool, no triggers, no browser.
 *
 * COVERAGE BAR (per the tiered-full-coverage approach): this tier does NOT merely prove the queries
 * are alive — it validates the EXPECTED VALUES the API returns over the deterministic Association
 * demo seed (test-harnesses/server/seed-demo.ts → AssociationDemoSeedData.ts), so a green run means
 * "MJAPI exposes correct accounting numbers + auth + scoping" — i.e. shippable at the API layer.
 * Where a value is date-relative (AR aging buckets age with the calendar), we assert the DRIFT-PROOF
 * invariant (buckets sum to the customer's TotalOpen) instead of the exact bucket, so the tier stays
 * green over time without going back to liveness-only.
 *
 * Run from the INSTANCE WORKTREE ROOT (so the instance `.env`/launcher resolve):
 *   cd ~/MJDev/instances/<slug>/mj
 *   npx tsx packages/dev-apps/bizapps-accounting/test-harnesses/api/readmodels-api.ts
 *
 * Exit codes:  0 = all passed · 1 = assertion failures · 2 = bootstrap/connection error.
 *
 * Config (env overrides):
 *   MJ_API_URL  base URL of MJAPI            (default http://localhost:4070)
 *   MJ_API_KEY  the mj_sk_* user key         (default: minted via the mjdev launcher)
 */
import { execSync } from 'node:child_process';

// ─── config (proven facts) ───────────────────────────────────────────────────
const API_URL = (process.env.MJ_API_URL ?? 'http://localhost:4070').replace(/\/+$/, '');
const GRAPHQL_URL = `${API_URL}/`;
const MJDEV_LAUNCHER = '/Users/marcelotorres/MJDev/bin/mjdev';
const INSTANCE_SLUG = 'bizapps-accounting-dev';
// Association demo companies (test-harnesses/server/seed-demo.ts). CO1 = AR/DefRev/Tax demos;
// CO2 = intercompany leg 1 (so intercompany is validated on the company that actually OWNS the flow).
const CO1 = 'a55c0de1-0001-4000-8000-000000000001';
const CO2 = 'a55c0de1-0002-4000-8000-000000000002';

// ─── tiny assert harness ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
const sum = (xs: number[]): number => xs.reduce((s, x) => s + Number(x), 0);

// ─── readiness preflight: is MJAPI serving on the port? ─────────────────────────
async function preflight(): Promise<void> {
  let status: number;
  try {
    const res = await fetch(GRAPHQL_URL, { method: 'GET' });
    status = res.status;
  } catch (e) {
    failBootstrap(`MJAPI is not reachable at ${API_URL} (${e instanceof Error ? e.message : String(e)})`);
    return;
  }
  if (status >= 200 && status < 500) {
    console.log(`Preflight: MJAPI serving at ${API_URL} (HTTP ${status}).`);
    return;
  }
  failBootstrap(`MJAPI at ${API_URL} returned HTTP ${status} (expected it to be serving).`);
}

function failBootstrap(reason: string): never {
  console.error(`\nBOOTSTRAP ERROR: ${reason}`);
  console.error(`Fix: ${MJDEV_LAUNCHER} run ${INSTANCE_SLUG} api`);
  process.exit(2);
}

// ─── API key resolution (env or mint via the launcher) ──────────────────────────
function resolveApiKey(): string {
  const fromEnv = process.env.MJ_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  let out: string;
  try {
    out = execSync(`${MJDEV_LAUNCHER} key ${INSTANCE_SLUG}`, { encoding: 'utf8' });
  } catch (e) {
    failBootstrap(`could not mint API key via launcher: ${e instanceof Error ? e.message : String(e)}`);
  }
  const key = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('mj_sk_')).pop();
  if (!key) failBootstrap(`launcher produced no mj_sk_ key (got: ${JSON.stringify(out).slice(0, 200)})`);
  return key;
}

// ─── gql helper: POST a query, throw on non-200 or on GraphQL errors ────────────
async function gql<T>(apiKey: string, query: string): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ query }),
  });
  if (res.status !== 200) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${GRAPHQL_URL}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors && json.errors.length > 0) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors).slice(0, 500)}`);
  if (json.data === undefined || json.data === null) throw new Error(`GraphQL response missing data key: ${JSON.stringify(json).slice(0, 300)}`);
  return (json as { data: T }).data;
}

/** Fetch one read-model field for a company; returns rows (throws are caught by callers' check()). */
async function fetchRows<T>(apiKey: string, field: string, companyID: string, selection: string): Promise<T[]> {
  const data = await gql<Record<string, T[]>>(apiKey, `query { ${field}(companyID: "${companyID}") { ${selection} } }`);
  const rows = data[field];
  if (!Array.isArray(rows)) throw new Error(`data.${field} is not an array`);
  return rows;
}

// ─── row types ────────────────────────────────────────────────────────────────
interface TrialBalanceRow { GLAccountCode: string; AccountType: string; TotalDebits: number; TotalCredits: number; NetBalance: number; }
interface AROpenRow { CustomerName: string; OpenBalance: number; }
interface AgingRow { CustomerName: string; Current_0_30: number; Days_31_60: number; Days_61_90: number; Days_Over_90: number; TotalOpen: number; }
interface DefRevRow { Additions: number; Releases: number; ClosingBalance: number; }
interface TaxRow { AccruedAmount: number; RemittedAmount: number; OutstandingLiability: number; Status: string; }
interface BatchRow { Status: string; }
interface ICRow { EntryType: string; GLAccountCode: string; }

// helper: find a customer's value by name fragment
const byName = <T extends { CustomerName: string }>(rows: T[], frag: string): T | undefined =>
  rows.find((r) => r.CustomerName.includes(frag));

// ─── the seven read-model queries, asserted on REAL expected values ─────────────
async function run(apiKey: string): Promise<void> {
  // 1. Trial Balance — must FOOT (debits = credits) and net to zero.
  console.log('\nAccountingTrialBalance(CO1) — foots:');
  try {
    const rows = await fetchRows<TrialBalanceRow>(apiKey, 'AccountingTrialBalance', CO1, 'GLAccountCode AccountType TotalDebits TotalCredits NetBalance');
    check('4 GL accounts', rows.length === 4, `got ${rows.length}`);
    check('sum(Debits) === sum(Credits) === 3920', sum(rows.map(r => r.TotalDebits)) === 3920 && sum(rows.map(r => r.TotalCredits)) === 3920, `Dr ${sum(rows.map(r => r.TotalDebits))} / Cr ${sum(rows.map(r => r.TotalCredits))}`);
    check('sum(NetBalance) === 0 (balanced)', sum(rows.map(r => r.NetBalance)) === 0, `got ${sum(rows.map(r => r.NetBalance))}`);
    check('AR (11201) net === 2300', (rows.find(r => r.GLAccountCode === '11201')?.NetBalance) === 2300, `got ${rows.find(r => r.GLAccountCode === '11201')?.NetBalance}`);
  } catch (e) { check('AccountingTrialBalance executes', false, e instanceof Error ? e.message : String(e)); }

  // 2. AR Open by Customer — Globex 1000, Umbrella 1000, Acme 300 (Initech settled → excluded). Total 2300.
  console.log('\nAccountingAROpenByCustomer(CO1) — real open balances:');
  try {
    const rows = await fetchRows<AROpenRow>(apiKey, 'AccountingAROpenByCustomer', CO1, 'CustomerName OpenBalance');
    check('3 customers with open balance (settled excluded)', rows.length === 3, `got ${rows.length}`);
    check('sum(OpenBalance) === 2300', sum(rows.map(r => r.OpenBalance)) === 2300, `got ${sum(rows.map(r => r.OpenBalance))}`);
    check('Globex open === 1000', byName(rows, 'Globex')?.OpenBalance === 1000, `got ${byName(rows, 'Globex')?.OpenBalance}`);
    check('Umbrella open === 1000', byName(rows, 'Umbrella')?.OpenBalance === 1000, `got ${byName(rows, 'Umbrella')?.OpenBalance}`);
    check('Acme (partial) open === 300', byName(rows, 'Acme')?.OpenBalance === 300, `got ${byName(rows, 'Acme')?.OpenBalance}`);
    check('Initech (settled) absent', !byName(rows, 'Initech'), 'Initech should be excluded by HAVING <> 0');
  } catch (e) { check('AccountingAROpenByCustomer executes', false, e instanceof Error ? e.message : String(e)); }

  // 3. AR Aging — assert DRIFT-PROOF invariants (buckets age with the calendar): per-customer
  //    buckets sum to TotalOpen, and the totals match AR-open. NOT exact buckets.
  console.log('\nAccountingARAging(CO1) — drift-proof invariants:');
  try {
    const rows = await fetchRows<AgingRow>(apiKey, 'AccountingARAging', CO1, 'CustomerName Current_0_30 Days_31_60 Days_61_90 Days_Over_90 TotalOpen');
    check('3 customers', rows.length === 3, `got ${rows.length}`);
    const bucketsSumToTotal = rows.every(r => r.Current_0_30 + r.Days_31_60 + r.Days_61_90 + r.Days_Over_90 === r.TotalOpen);
    check('every customer: buckets sum to TotalOpen', bucketsSumToTotal, JSON.stringify(rows));
    check('sum(TotalOpen) === 2300 (matches AR-open)', sum(rows.map(r => r.TotalOpen)) === 2300, `got ${sum(rows.map(r => r.TotalOpen))}`);
    check('Umbrella TotalOpen === 1000', byName(rows, 'Umbrella')?.TotalOpen === 1000, `got ${byName(rows, 'Umbrella')?.TotalOpen}`);
  } catch (e) { check('AccountingARAging executes', false, e instanceof Error ? e.message : String(e)); }

  // 4. Deferred Revenue rollforward — defer 300, release 120 → net 180.
  console.log('\nAccountingDefRevRollforward(CO1) — waterfall:');
  try {
    const rows = await fetchRows<DefRevRow>(apiKey, 'AccountingDefRevRollforward', CO1, 'Additions Releases ClosingBalance');
    check('>= 2 rollforward periods', rows.length >= 2, `got ${rows.length}`);
    check('sum(Additions) === 300', sum(rows.map(r => r.Additions)) === 300, `got ${sum(rows.map(r => r.Additions))}`);
    check('sum(Releases) === 120', sum(rows.map(r => r.Releases)) === 120, `got ${sum(rows.map(r => r.Releases))}`);
    check('a period closes at 180 (300 deferred − 120 released)', rows.some(r => r.ClosingBalance === 180), `closings ${rows.map(r => r.ClosingBalance).join(',')}`);
  } catch (e) { check('AccountingDefRevRollforward executes', false, e instanceof Error ? e.message : String(e)); }

  // 5. Sales Tax Liability — PartiallyPaid (1000/350/650) + Open (500/0/500). Totals 1500/350/1150.
  console.log('\nAccountingSalesTaxLiability(CO1) — accrued/remitted/outstanding:');
  try {
    const rows = await fetchRows<TaxRow>(apiKey, 'AccountingSalesTaxLiability', CO1, 'AccruedAmount RemittedAmount OutstandingLiability Status');
    check('2 liability rows', rows.length === 2, `got ${rows.length}`);
    check('sum(Accrued) === 1500', sum(rows.map(r => r.AccruedAmount)) === 1500, `got ${sum(rows.map(r => r.AccruedAmount))}`);
    check('sum(Remitted) === 350', sum(rows.map(r => r.RemittedAmount)) === 350, `got ${sum(rows.map(r => r.RemittedAmount))}`);
    check('sum(Outstanding) === 1150', sum(rows.map(r => r.OutstandingLiability)) === 1150, `got ${sum(rows.map(r => r.OutstandingLiability))}`);
    const partial = rows.find(r => r.Status === 'PartiallyPaid');
    check('PartiallyPaid row = accrued 1000 / outstanding 650', partial?.AccruedAmount === 1000 && partial?.OutstandingLiability === 650, JSON.stringify(partial));
  } catch (e) { check('AccountingSalesTaxLiability executes', false, e instanceof Error ? e.message : String(e)); }

  // 6. Batch Dispatch Status — the seed posts 4 batches for CO1, all dispatched (Acknowledged).
  console.log('\nAccountingBatchDispatchStatus(CO1) — all dispatched:');
  try {
    const rows = await fetchRows<BatchRow>(apiKey, 'AccountingBatchDispatchStatus', CO1, 'Status');
    check('4 batches', rows.length === 4, `got ${rows.length}`);
    check('every batch Status === Acknowledged', rows.every(r => r.Status === 'Acknowledged'), `statuses ${rows.map(r => r.Status).join(',')}`);
  } catch (e) { check('AccountingBatchDispatchStatus executes', false, e instanceof Error ? e.message : String(e)); }

  // 7. Intercompany Flow — proves BY-COMPANY SCOPING: CO1 owns none (0), CO2 owns the seeded leg.
  console.log('\nAccountingIntercompanyFlow — scoping (CO1 empty, CO2 has the leg):');
  try {
    const co1 = await fetchRows<ICRow>(apiKey, 'AccountingIntercompanyFlow', CO1, 'EntryType GLAccountCode');
    check('CO1 has 0 intercompany rows (scoping correct)', co1.length === 0, `got ${co1.length}`);
    const co2 = await fetchRows<ICRow>(apiKey, 'AccountingIntercompanyFlow', CO2, 'EntryType GLAccountCode');
    check('CO2 has the intercompany leg (>= 1 row)', co2.length >= 1, `got ${co2.length}`);
    check('CO2 rows are EntryType IntercompanyFlow', co2.length > 0 && co2.every(r => r.EntryType === 'IntercompanyFlow'), `types ${co2.map(r => r.EntryType).join(',')}`);
  } catch (e) { check('AccountingIntercompanyFlow executes', false, e instanceof Error ? e.message : String(e)); }
}

// ─── main ───────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('=== Tier-3 API harness: bizapps-accounting read models (real-value coverage) ===');
  await preflight();
  const apiKey = resolveApiKey();
  console.log(`Auth: X-API-Key ${apiKey.slice(0, 10)}… (resolved)`);
  await run(apiKey);
  const total = passed + failed;
  console.log(`\nAPI harness: ${passed}/${total} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => failBootstrap(e instanceof Error ? e.message : String(e)));
