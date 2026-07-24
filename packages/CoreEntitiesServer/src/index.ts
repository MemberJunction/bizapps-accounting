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
export { JournalEntryLineEntityServer } from './JournalEntryLineEntityServer.js';
export { JournalEntryBatchEntityServer } from './JournalEntryBatchEntityServer.js';
export { GLAccountEntityServer } from './GLAccountEntityServer.js';
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

// (JournalEntryValidation retired 2026-07-24, phase-2 sweep — its per-record rules live in
//  JournalEntryEntityServer.Validate/ValidateAsync; nothing consumed the standalone module.
//  Git history keeps it if a batch-side pre-lock validator is ever wanted again.)

// S1 — batching engine: net a company's Pending JEs into a SINGLE-COMPANY batch (D7) whose
// summary is a BatchSummary JournalEntry, lock + dispatch (CFO-approval gate + ERP-post seam).
export {
  buildBatch,
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

// (ScheduledJournalEntryService retired 2026-07-23 — the schedule tables were dropped in the
//  rewritten baseline (plan D15: rev-rec is REAL forward-dated JEs written at booking).
//  ChartOfAccountsMappingService retired 2026-07-23 — the mapping table was dropped; the account
//  Code / GLAccount.ExternalAccountID is the ERP wire identity. Both live in git history.)

// Block 4 — deterministic, idempotent Association demo seed (multi-company AR/DefRev/Tax/Intercompany
// data so the Explorer GUI + the read-model views have meaningful fixtures). See AssociationDemoSeedData.ts.
export { seedAssociationDemo } from './AssociationDemoSeedData.js';
export type { DemoSeedReport } from './AssociationDemoSeedData.js';

// The accounting ENGINE (plan §2.2-2.3): server write path over the browser-safe cache, plus the
// Accounting.CreateJournalEntry remotable op (code-only — registered via LoadCreateJournalEntryOperation).
// The contract + pure pipeline types live in @mj-biz-apps/accounting-engine-base — import them from there.
export { AccountingEngine } from './AccountingEngine.js';
export { CreateJournalEntryOperation, LoadCreateJournalEntryOperation } from './CreateJournalEntryOperation.js';
export { CreateJournalEntriesOperation, LoadCreateJournalEntriesOperation } from './CreateJournalEntriesOperation.js';
