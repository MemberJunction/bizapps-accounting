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
export { GLAccountLinkEntityServer, LoadGLAccountLinkEntityServer } from './GLAccountLinkEntityServer.js';
export { IntercompanyAccountMatchEntityServer } from './IntercompanyAccountMatchEntityServer.js';
export { JournalEntryTypeEntityServer, LoadJournalEntryTypeEntityServer } from './JournalEntryTypeEntityServer.js';
// (AccountingPeriodEntityServer removed 2026-07-06 — AccountingPeriod retired, CH-1.)

// Internal helpers exported for use by future EntityServer classes (period
// close, FX revaluation, etc.) and by the AccountingService façade in
// `@mj-biz-apps/accounting-server`.
export {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_GL_ACCOUNT_REFS,
} from './SeedData.js';
export type { SeededGLAccount } from './SeedData.js';
export { getNextJournalEntryNumber, getNextJournalEntryBatchNumber } from './SequenceService.js';
export {
  LookupJournalEntryTypeByCode,
  LookupJournalEntryTypeByID,
  RequireJournalEntryTypeID,
  GetJournalEntryBatchSummaryEntryType,
} from './JournalEntryTypes.js';
export type { JournalEntryTypeRow } from './JournalEntryTypes.js';

// (JournalEntryValidation retired 2026-07-24, phase-2 sweep — its per-record rules live in
//  JournalEntryEntityServer.Validate/ValidateAsync; nothing consumed the standalone module.
//  Git history keeps it if a batch-side pre-lock validator is ever wanted again.)

// S1 — batching engine: net a company's Pending JEs into a SINGLE-COMPANY batch (D7) whose
// summary is a JournalEntryBatchSummary JournalEntry, lock + dispatch (CFO-approval gate + ERP-post seam).
export {
  buildBatch,
  buildBatchFromExplicitIds,
  buildBatchFromView,
  classifyViewEntries,
  previewBatch,
  pendingCandidateFilter,
  outOfOrderSkipCount,
  perCompanySubtotals,
  pendingCompanies,
  EmptyJournalEntryBatchError,
  JournalEntryBatchFromViewError,
  approveBatch,
  sendBatch,
  cancelBatch,
  regenerateBatch,
  netLines,
  resolveExternalAccount,
  mockErpPoster,
  AutoApproveGate,
} from './JournalEntryBatchEngine.js';
export type {
  JournalEntryBatchTargetSystem,
  DimRef,
  NettableLine,
  NetGroup,
  BuildJournalEntryBatchResult,
  BuildJournalEntryBatchOptions,
  BuildJournalEntryBatchFromViewOptions,
  JournalEntryBatchPreviewEntry,
  AffectedAccount,
  JournalEntryBatchPreviewResult,
  ErpPostResult,
  ErpPoster,
  JournalEntryBatchApprovalGate,
  SendJournalEntryBatchOptions,
} from './JournalEntryBatchEngine.js';

// S1 — the REAL CFO-approval gate, backed by the bizapps-tasks app (replaces AutoApproveGate in
// production). See TasksAppApprovalGate.ts.
export { TasksAppApprovalGate } from './TasksAppApprovalGate.js';

// (ScheduledJournalEntryService retired 2026-07-23 — the schedule tables were dropped in the
//  rewritten baseline (plan D15: rev-rec is REAL forward-dated JEs written at booking).
//  ChartOfAccountsMappingService retired 2026-07-23 — the mapping table was dropped; the account
//  Code / GLAccount.ExternalAccountID is the ERP wire identity. Both live in git history.)

// (AssociationDemoSeedData moved to test-harnesses/server/ 2026-07-27 — demo fixtures are dev/test
//  assets and must not ship in this package; seed-demo.ts consumes it locally via tsx.)

// The accounting ENGINE (plan §2.2-2.3): server write path over the browser-safe cache, plus the
// Accounting.CreateJournalEntry remotable op (code-only — registered via LoadCreateJournalEntryOperation).
// The contract + pure pipeline types live in @mj-biz-apps/accounting-engine-base — import them from there.
export { AccountingEngine } from './AccountingEngine.js';
export { CreateJournalEntryOperation, LoadCreateJournalEntryOperation } from './CreateJournalEntryOperation.js';
export { CreateJournalEntriesOperation, LoadCreateJournalEntriesOperation } from './CreateJournalEntriesOperation.js';
export {
  GenerateReversalOperation,
  LoadGenerateReversalOperation,
  type GenerateReversalInput,
  type GenerateReversalOutput,
} from './GenerateReversalOperation.js';
export {
  BuildJournalEntryBatchOperation,
  PreviewJournalEntryBatchOperation,
  RegenerateJournalEntryBatchOperation,
  DispatchJournalEntryBatchOperation,
  RecordJournalEntryBatchDecisionOperation,
  GetJournalEntryBatchApprovalStateOperation,
  LoadJournalEntryBatchOperations,
  type JournalEntryBatchCriteriaInput,
  type PreviewJournalEntryBatchInput,
  type BuildJournalEntryBatchInput,
  type BuildJournalEntryBatchOutput,
  type RegenerateJournalEntryBatchInput,
  type DispatchJournalEntryBatchInput,
  type DispatchJournalEntryBatchOutput,
  type JournalEntryBatchDecisionOutcome,
  type RecordJournalEntryBatchDecisionInput,
  type RecordJournalEntryBatchDecisionOutput,
  type GetJournalEntryBatchApprovalStateInput,
  type GetJournalEntryBatchApprovalStateOutput,
} from './JournalEntryBatchOperations.js';
