/**
 * Vitest config for the LIVE tier-2 server harness (phase 2). Runs against the live instance
 * DB — strictly sequential (one file, no parallelism): the fixtures share one database and the
 * teardown toggles table triggers, so two concurrent runs would race.
 *
 * Run from the app root:
 *   npx vitest run --config test-harnesses/server/vitest.config.ts
 *
 * Standalone on purpose — NOT registered in any package's test script, so `npm test` stays
 * DB-free; this suite is invoked deliberately (it needs the live instance).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
