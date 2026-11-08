/**
 * Vitest config for @mj-biz-apps/accounting-server.
 *
 * ISOLATED, no-DB unit tests ONLY (MJ convention: no database connections in unit
 * tests; keep them deterministic and < 5s). The suites here read the generated
 * GraphQL source as text; they do not import it, so nothing boots MJ.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
