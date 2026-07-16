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
// (AccountingPeriodEntityServer removed 2026-07-06 — AccountingPeriod retired, CH-1.)

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

// S1 — batching engine: net Pending JEs into a MULTI-COMPANY batch (per-company grouping on the
// line items, AM-4), resolve ERP accounts, lock + dispatch (CFO-approval gate + ERP-post seam).
export {
  buildBatch,
  buildBatchFromView,
  classifyViewEntries,
  BatchFromViewError,
  approveBatch,
  sendBatch,
  cancelBatch,
  regenerateBatch,
  netLines,
  resolveExternalAccount,
  mockErpPoster,
  AutoApproveGate,
} from './BatchingEngine.js';
export type {
  BatchTargetSystem,
  BuildBatchOptions,
  BuildBatchFromViewOptions,
  DimRef,
  NettableLine,
  NetGroup,
  BuildBatchResult,
  ErpPostResult,
  ErpPoster,
  BatchApprovalGate,
  SendBatchOptions,
} from './BatchingEngine.js';

// S1 — the REAL CFO-approval gate, backed by the bizapps-tasks app (replaces AutoApproveGate in
// production). See TasksAppApprovalGate.ts.
export { TasksAppApprovalGate } from './TasksAppApprovalGate.js';

// S3 — scheduled-JE schedule CREATION (Block 4). The materializer was retired 2026-07-06 (AM-6):
// domain entity servers generate the JEs. See ScheduledJournalEntryService.ts.
export {
  createScheduledEntries,
  computeStraightLineSchedule,
  mapScheduledEntryType,
} from './ScheduledJournalEntryService.js';
export type {
  ScheduledEntryType,
  JournalEntryType,
  SchedulePeriod,
  CreateScheduleSpec,
} from './ScheduledJournalEntryService.js';

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

// Block 4 — deterministic, idempotent Association demo seed (multi-company AR/DefRev/Tax/Intercompany
// data so the Explorer GUI + the read-model views have meaningful fixtures). See AssociationDemoSeedData.ts.
export { seedAssociationDemo } from './AssociationDemoSeedData.js';
export type { DemoSeedReport } from './AssociationDemoSeedData.js';

// The accounting ENGINE (plan §2.2-2.3): server write path over the browser-safe cache, plus the
// Accounting.CreateJournalEntry remotable op (code-only — registered via LoadCreateJournalEntryOperation).
// The contract + pure pipeline types live in @mj-biz-apps/accounting-engine-base — import them from there.
export { AccountingEngine } from './AccountingEngine.js';
export { CreateJournalEntryOperation, LoadCreateJournalEntryOperation } from './CreateJournalEntryOperation.js';
// Accounting.CreateJournalEntries — the SET form: every draft's rows in ONE TransactionGroup (all or none).
export { CreateJournalEntriesOperation, LoadCreateJournalEntriesOperation } from './CreateJournalEntriesOperation.js';
// Accounting.CreateScheduledJournalEntries (B3.1) — atomic rev-rec/amortization schedule persist.
export { CreateScheduledJournalEntriesOperation, LoadCreateScheduledJournalEntriesOperation } from './CreateScheduledJournalEntriesOperation.js';
export { createScheduledJournalEntriesAtomic } from './ScheduledJournalEntryService.js';
export type { ScheduledJournalEntriesInput, ScheduledJournalEntriesResult, ScheduleValidationError } from './ScheduledJournalEntryService.js';
// Accounting.MaterializeDueScheduledEntries (B3.2) — DATE-driven materialization of due scheduled JEs.
export { MaterializeScheduledEntriesOperation, LoadMaterializeScheduledEntriesOperation } from './MaterializeScheduledEntriesOperation.js';
export type { MaterializeScheduledEntriesInput } from './MaterializeScheduledEntriesOperation.js';
export { materializeDueScheduledEntries } from './MaterializationService.js';
export type { MaterializeResult } from './MaterializationService.js';

export * from './BuildBatchOperation.js';
