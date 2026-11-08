/**
 * Vitest config for the tier-2 server harness (phase 2). `*.live.test.ts` specs run against
 * the live instance DB — strictly sequential (one file, no parallelism): the fixtures share one
 * database and the teardown toggles table triggers, so two concurrent runs would race.
 * DB-free specs do not belong here — nothing runs this config automatically. Put them in the
 * owning package's `src/__tests__/`, where CI runs them.
 *
 * Run from the app root:
 *   npx vitest run --config test-harnesses/server/vitest.config.ts
 *
 * Standalone on purpose — NOT registered in any package's test script, so `npm test` stays
 * DB-free; this suite is invoked deliberately (it needs the live instance).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  resolve: {
    alias: {
      '@mj-biz-apps/accounting-entities': path.join(root, 'packages/Entities/dist/index.js'),
      '@mj-biz-apps/accounting-engine-base': path.join(root, 'packages/EngineBase/dist/index.js'),
      '@mj-biz-apps/accounting-core-entities-server': path.join(root, 'packages/CoreEntitiesServer/dist/index.js'),
      '@mj-biz-apps/accounting-actions': path.join(root, 'packages/Actions/dist/index.js'),
      '@mj-biz-apps/accounting-server': path.join(root, 'packages/Server/dist/index.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['test-harnesses/server/**/*.live.test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
    teardownTimeout: 30_000,
    // One worker, forks pool: the mssql sockets live in a child process, so a lingering
    // pool handle can't wedge the main vitest process at exit. (Vitest 4: pool options are
    // top-level — maxWorkers 1 is the singleFork equivalent.)
    pool: 'forks',
    maxWorkers: 1,
  },
});
