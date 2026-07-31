/**
 * Vitest config for @mj-biz-apps/accounting-ng — TIER 1 only.
 *
 * Pure, no-DB, no-Angular-runtime unit tests over the EXTRACTED pure seams (the tier-1 boundary
 * doctrine in TEST-ARCHITECTURE): the workspace-tab state machine, the parking-discipline guard,
 * and any other sync helper the components delegate to.
 *
 * Rendering Angular components against a real in-process DB is TIER 4 and has its own config
 * (`vitest.dom.config.ts`) — it needs the analogjs plugin + jsdom, which would slow every tier-1
 * run for no benefit. Keep the two separate.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // Tier 4's DOM specs live beside their components as *.dom.test.ts — never picked up here.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.dom.test.ts'],
  },
});
