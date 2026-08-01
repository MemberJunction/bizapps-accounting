/**
 * Vitest config for @mj-biz-apps/accounting-ng-widgets — TIER 1 only.
 *
 * Pure, no-DB, no-Angular-runtime unit tests over the widget package's pure seams: the view-model
 * builders, and the layer-purity guard that keeps this package framework-clean.
 *
 * This is the tier-1 payoff of the layering. A presentational widget that takes plain view models
 * can be reasoned about with object literals; one that took a `BaseEntity` and read its own data
 * could only be tested by standing up MJ metadata and a provider.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.dom.test.ts'],
  },
});
