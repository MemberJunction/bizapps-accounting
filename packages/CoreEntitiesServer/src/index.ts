/**
 * @mj-biz-apps/accounting-core-entities-server
 *
 * Server-side entity subclasses for BizApps Accounting entities. These
 * @RegisterClass-decorated classes override Save() / Delete() to add
 * lifecycle hooks that previously lived in stored procs — and now flow
 * through BaseEntity so __mj.RecordChange captures audit history for every
 * row created or modified.
 *
 * See `workflows-and-agents.plan.md` for the full W1–W9 hook design.
 *
 * Import this package from your server bootstrap (already wired in
 * `@mj-biz-apps/accounting-server/src/index.ts`) to ensure @RegisterClass
 * decorators fire at startup.
 */
export { AccountingCompanyProfileEntityServer } from './AccountingCompanyProfileEntityServer.js';
export { JournalEntryEntityServer } from './JournalEntryEntityServer.js';
export { JournalEntryBatchEntityServer } from './JournalEntryBatchEntityServer.js';

// Internal helpers exported for use by future EntityServer classes (period
// close, FX revaluation, etc.) and by the AccountingService façade in
// `@mj-biz-apps/accounting-server`.
export {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_GL_ACCOUNT_REFS,
  DEFAULT_RECURRING_TEMPLATES,
} from './SeedData.js';
export type { SeededGLAccount, SeededRecurringTemplate } from './SeedData.js';
export { getNextJournalEntryNumber, getNextBatchNumber } from './SequenceService.js';
