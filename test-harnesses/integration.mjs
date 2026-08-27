import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '.env'), quiet: true });
dotenv.config({ path: path.resolve(here, '../../MJ/.env'), quiet: true });
process.env.MJ_INTEGRATION_TEST = '1';
process.env.RUN_MUTATION_TESTS = process.env.RUN_MUTATION_TESTS ?? '1';
const ALL = ['acct-world', 'acct-ledger', 'acct-batch'];
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const { bootstrapIntegrationClient } = await import('@memberjunction/testing-integration/client');
const { Metadata } = await import('@memberjunction/core');
const { IntegrationCheckRegistry } = await import('@memberjunction/testing-integration/registry');
await bootstrapIntegrationClient();
await import('../packages/IntegrationTests/dist/index.js');
const user = Metadata.Provider.CurrentUser;
if (!user) throw new Error('No CurrentUser');
const ctx = { User: user, Provider: Metadata.Provider, Schema: '__mj', Storage: undefined };
let pass = 0, fail = 0;
console.log('\n  Accounting integration (GraphQL)\n');
for (const request of only.length ? only : ALL) {
    const [b, id] = request.includes('.') ? request.split('.') : [request, null];
    for (const check of IntegrationCheckRegistry.Instance.GetBundle(b).filter((c) => !id || c.Id === request)) {
        const t = Date.now();
        try {
            await check.Fn(ctx);
            console.log(`  ok   ${check.Id.padEnd(22)} ${Date.now() - t}ms  ${check.Name}`);
            pass++;
        } catch (e) {
            console.error(`  FAIL ${check.Id.padEnd(22)} ${e instanceof Error ? e.message : e}`);
            fail++;
        }
    }
}
console.log(`\n  ${pass} passed / ${fail} failed\n`);
process.exit(fail ? 1 : 0);
