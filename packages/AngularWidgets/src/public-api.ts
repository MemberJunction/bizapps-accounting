/**
 * `@mj-biz-apps/accounting-ng-widgets` — reusable accounting UI, layers 1 and 2.
 *
 * Framework-clean Angular. Nothing in here imports `@angular/router`,
 * `@memberjunction/ng-shared`, or any MJ Explorer package — that boundary is what lets these
 * components render inside an Explorer form, an Explorer slide-in, a standalone Angular app,
 * or a test, without a fork. It is enforced by `npm run check:ui-layers` (this package declares
 * `"mjUILayer": "widgets"`), not by good intentions.
 *
 * Layering rules and the Before/After event contract: the MJ repo's
 * `guides/UI_LAYERING_GUIDE.md`, and `docs/UI_LAYERING.md` in this repo for how they apply here.
 *
 * Exports only what this package defines (rule 5 — no re-exports from other packages).
 */

// ── Journal entry ───────────────────────────────────────────────────────────
export * from './lib/journal-entry/je-events';
export * from './lib/journal-entry/je-view-models';
export * from './lib/journal-entry/je-status-timeline.component';
export * from './lib/journal-entry/je-line-table.component';
export * from './lib/journal-entry/je-reversal-panel.component';
export * from './lib/journal-entry/journal-entry-detail.component';
