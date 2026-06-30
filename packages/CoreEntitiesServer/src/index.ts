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
export { AccountingPeriodEntityServer } from './AccountingPeriodEntityServer.js';

// Internal helpers exported for use by future EntityServer classes (period
// close, FX revaluation, etc.) and by the AccountingService façade in
// `@mj-biz-apps/accounting-server`.
export {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_GL_ACCOUNT_REFS,
} from './SeedData.js';
export type { SeededGLAccount } from './SeedData.js';
export { getNextJournalEntryNumber, getNextBatchNumber } from './SequenceService.js';

// F1 — post-time JE validation guard (balance / two-line / period-open / GL-active).
export { validateJournalEntry, checkBalance } from './JournalEntryValidation.js';
export type { JournalEntryValidationResult } from './JournalEntryValidation.js';

// S1 — batching engine: net Pending JEs into a Company×Period batch, resolve ERP accounts,
// lock + dispatch (CFO-approval gate + ERP-post seam). See BatchingEngine.ts.
export {
  buildBatch,
  sendBatch,
  netLines,
  resolveExternalAccount,
  mockErpPoster,
  AutoApproveGate,
} from './BatchingEngine.js';
export type {
  BatchTargetSystem,
  DimRef,
  NettableLine,
  NetGroup,
  BuildBatchResult,
  ErpPostResult,
  ErpPoster,
  BatchApprovalGate,
  SendBatchOptions,
} from './BatchingEngine.js';

// S3 — scheduled-JE schedules + materializer (Block 4). See ScheduledJournalEntryService.ts.
export {
  createScheduledEntries,
  materializeDueScheduledEntries,
  computeStraightLineSchedule,
  mapScheduledEntryType,
} from './ScheduledJournalEntryService.js';
export type {
  ScheduledEntryType,
  JournalEntryType,
  SchedulePeriod,
  CreateScheduleSpec,
  MaterializeResult,
} from './ScheduledJournalEntryService.js';

// Block 3 — intercompany net+batch engine: eager per-pair Due-To/Due-From provisioning +
// bilateral position netting ("gross preserved, net shipped", §C1). See IntercompanyBalancingService.ts.
export {
  provisionIntercompanyAccountsFor,
  netIntercompanyPositions,
  applyIntercompanyNetting,
  canonicalPair,
  compareSqlServerGuid,
} from './IntercompanyBalancingService.js';
export type {
  IntercompanyPair,
} from './IntercompanyBalancingService.js';

// Block 5 — Chart-of-Accounts mapping approval workflow (propose → approve, strict 1:1). See ChartOfAccountsMappingService.ts.
export {
  proposeMapping,
  approveMapping,
  rangesOverlap,
} from './ChartOfAccountsMappingService.js';
export type {
  ProposeMappingSpec,
  ApproveMappingResult,
} from './ChartOfAccountsMappingService.js';
