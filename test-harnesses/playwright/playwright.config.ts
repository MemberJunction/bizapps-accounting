import { defineConfig, devices } from '@playwright/test';
import { EXPLORER_BASE_URL } from './lib/env';

/**
 * Playwright config for the bizapps-accounting GUI harness.
 *
 * Decisions (see README.md + .mjdev-docs/TEST-PROTOCOL.md):
 *  - **System Chrome** (`channel: 'chrome'`) — never download a Playwright browser. The browser
 *    binary is pre-verified in lib/global-setup.ts before any test launches.
 *  - **Serial, single worker** — these are heavy live-instance e2e tests sharing ONE Explorer +
 *    ONE instance DB; never run them concurrently (harness-notes.md lesson #2 applies app-wide).
 *  - **Generous timeouts** — the dev Explorer (Vite/Angular) is slow to first-render a dashboard.
 *  - **No webServer** — MJAPI + MJExplorer are started out-of-band via `mjdev run` (see README).
 *    global-setup asserts both are reachable and fails loudly with instructions if not.
 */
export default defineConfig({
  testDir: './specs',
  globalSetup: './lib/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: EXPLORER_BASE_URL,
    headless: true,
    channel: 'chrome',
    viewport: { width: 1500, height: 1100 },
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
