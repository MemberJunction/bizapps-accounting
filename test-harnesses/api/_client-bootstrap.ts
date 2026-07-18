/**
 * Shared tier-3 bootstrap — stand up the app's REAL GraphQL client (GraphQLDataProvider) against the
 * running MJAPI, so a harness can import the app's typed clients (ReadModelsClient, BatchDispatchClient,
 * …) and drive them exactly as the Explorer dashboards do. Port from `mjdev ps`, `mj_sk_*` key from
 * `mjdev key`. No hand-rolled fetch, no re-typed query strings — the production client path.
 */
import { execSync } from 'node:child_process';
import {
  setupGraphQLClient,
  GraphQLProviderConfigData,
  GraphQLDataProvider,
} from '@memberjunction/graphql-dataprovider';

export const LAUNCHER = process.env.MJDEV_BIN ?? '/Users/marcelotorres/MJDev/bin/mjdev';
export const SLUG = process.env.MJDEV_SLUG ?? 'accounting-engine-dev';

export function failBootstrap(reason: string): never {
  console.error(`\nBOOTSTRAP ERROR: ${reason}`);
  console.error(`Fix: ${LAUNCHER} run ${SLUG} api  (then wait for READY)`);
  process.exit(2);
}

/** Resolve the live MJAPI base URL from mjdev ps (survives port auto-moves). */
export function resolveApiUrl(): string {
  let ps: { processes?: Array<{ label?: string; status?: string; port?: number }> };
  try {
    ps = JSON.parse(execSync(`${LAUNCHER} ps ${SLUG} --json`).toString());
  } catch (e) {
    failBootstrap(`could not run 'mjdev ps ${SLUG} --json': ${e instanceof Error ? e.message : String(e)}`);
  }
  const api = (ps.processes ?? []).find((p) => p.label === 'MJAPI' && p.status === 'running');
  if (!api?.port) failBootstrap(`MJAPI not running for '${SLUG}'. Start it: ${LAUNCHER} run ${SLUG} api`);
  return `http://localhost:${api.port}`;
}

export function resolveApiKey(): string {
  const fromEnv = process.env.MJ_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const out = execSync(`${LAUNCHER} key ${SLUG}`, { encoding: 'utf8' });
  const key = out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('mj_sk_')).pop();
  if (!key) failBootstrap('launcher produced no mj_sk_ key');
  return key;
}

/** Boot the real GraphQL client as the global provider; returns it for `new SomeClient(provider)`. */
export async function bootstrapClientProvider(): Promise<GraphQLDataProvider> {
  const url = resolveApiUrl();
  const key = resolveApiKey();
  const config = new GraphQLProviderConfigData('', url, '', async () => '', '__mj', undefined, undefined, undefined, key);
  const provider = await setupGraphQLClient(config);
  console.log(`Tier-3 client bootstrap: MJAPI ${url}, key ${key.slice(0, 10)}…`);
  return provider;
}

/** Tiny shared assertion counter for the client-driven tier-3 harnesses. */
export function makeChecker() {
  let passed = 0;
  let failed = 0;
  return {
    check(label: string, ok: boolean, detail?: string): void {
      if (ok) { passed++; console.log(`  ✓ ${label}`); }
      else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
    },
    summary(name: string): number {
      const total = passed + failed;
      console.log(`\n${name}: ${passed}/${total} passed`);
      return failed;
    },
  };
}
