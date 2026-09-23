/**
 * Vitest config for @mj-biz-apps/accounting-ng — DOM-level component tests.
 *
 * Renders Angular components under jsdom with TestBed, with no backend: data access is
 * faked per spec. Specs live beside their components as `*.dom.test.ts`.
 *
 * Kept separate from `vitest.config.ts` (tier 1, pure functions) because the analogjs
 * compile + jsdom would slow every tier-1 run, and separate from the MJDEV-managed
 * `test-harnesses/gui/` config, which drives a running MJAPI.
 */
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'node:url';

const setupFile = fileURLToPath(new URL('./vitest.dom.setup.ts', import.meta.url));

export default defineConfig({
  plugins: [angular({ jit: false, tsconfig: './tsconfig.spec.json' })],
  test: {
    // Load-bearing, not a style choice: with globals on, @angular/core/testing installs its own
    // afterEach(resetTestingModule), which is what gives every spec a fresh TestBed.
    globals: true,
    environment: 'jsdom',
    setupFiles: [setupFile],
    include: ['src/**/*.dom.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    restoreMocks: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Angular's compiled output references `globalThis` symbols, so run forked, not threaded.
    pool: 'forks',
  },
});
