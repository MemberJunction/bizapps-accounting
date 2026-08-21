/**
 * Vitest config for @mj-biz-apps/accounting-engine-base.
 *
 * ISOLATED, no-DB unit tests ONLY (MJ convention: no database connections in unit
 * tests; keep them deterministic and < 5s). Live, DB-backed engine validation (real caches +
 * the remotable op against a real instance) lives in the tsx harness at
 * `<app-root>/test-harnesses/server/engine-runtime.ts`, NOT here.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
