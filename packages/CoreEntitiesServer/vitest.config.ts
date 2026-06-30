/**
 * Vitest config for @mj-biz-apps/accounting-core-entities-server.
 *
 * ISOLATED, no-DB unit tests ONLY (MJ convention: no database connections in unit
 * tests; keep them deterministic and < 5s). Live, DB-backed hook validation (W1/W2/W3
 * firing against a real instance) lives in the tsx harness at
 * `<app-root>/test-harnesses/server/block0-runtime.ts`, NOT here.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
