/**
 * TIER 4 config — component/DOM tests (headless Angular under jsdom, no browser).
 *
 * Separate from `vitest.config.ts` (tier 1) so the pure unit tests never pay the jsdom +
 * Angular-compile cost. Specs live BESIDE their components as `*.dom.test.ts`.
 *
 * Run: `npm run test:dom` (from packages/Angular).
 */
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const setupFile = fileURLToPath(new URL('./vitest.dom.setup.ts', import.meta.url));

// The Angular compiler must see the specs in its TS program to type-check templates. The build
// tsconfig deliberately EXCLUDES tests, so tsconfig.spec.json re-includes them.
const specTsconfig = resolve(process.cwd(), 'tsconfig.spec.json');
const angularOptions = existsSync(specTsconfig) ? { jit: false, tsconfig: specTsconfig } : { jit: false };

export default defineConfig({
  plugins: [angular(angularOptions)],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [setupFile],
    testTimeout: 30000,
    restoreMocks: true,
    // Angular's compiled output references globalThis symbols; a single fork keeps the
    // environment stable across files.
    pool: 'forks',
    include: ['src/**/*.dom.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/generated/**'],
    // NOT passWithNoTests: an empty tier-4 run must fail loudly rather than report green.
    passWithNoTests: false,
  },
});
