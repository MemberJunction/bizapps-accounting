/**
 * Vitest config for @mj-biz-apps/accounting-ng — TIER 1 only.
 *
 * Pure, no-DB, no-Angular-runtime unit tests over the EXTRACTED pure seams (the tier-1 boundary
 * in test-harnesses/README.md): the workspace-tab state machine, the parking-discipline guard,
 * and any other sync helper the components delegate to.
 *
 * Rendering Angular components under TestBed has its own config (`vitest.dom.config.ts`) — it
 * needs the analogjs plugin + jsdom, which would slow every tier-1 run for no benefit. Keep the
 * two separate. Rendering against a running MJAPI is TIER 4 (`test-harnesses/gui/`).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Any spec under src/, not only src/__tests__/ — a spec co-located with its component must run,
    // not silently pass as zero tests. Same glob as the other packages.
    include: ['src/**/*.test.ts'],
    // *.dom.test.ts are DOM specs — this package's (vitest.dom.config.ts) and tier 4's under
    // test-harnesses/gui/ — never picked up here.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.dom.test.ts'],
  },
});
