/**
 * BizApps Accounting Server Bootstrap
 *
 * Server-side bootstrap package for the BizApps Accounting Open App.
 * Ensures all entity subclasses, action subclasses, and GraphQL resolvers
 * are registered with the MJ class factory.
 */

// Import entity and action packages to trigger @RegisterClass decorators
import '@mj-biz-apps/accounting-entities';
import '@mj-biz-apps/accounting-actions';

// Server-side entity subclasses — must come after accounting-entities so
// @RegisterClass auto-increment gives these higher priority
import '@mj-biz-apps/accounting-core-entities-server';
import { LoadJournalEntryBatchOperations, LoadCreateJournalEntriesOperation, LoadCreateJournalEntryOperation, LoadGenerateReversalOperation } from '@mj-biz-apps/accounting-core-entities-server';

// Custom scheduled-job driver: nightly Business Central fan-out sync across all active company
// integrations. App-owned (kept out of the MJ platform); registered via @RegisterClass here.
import { LoadBizAppsAccountingBCFanOutSyncDriver } from './custom/BizAppsAccountingBCFanOutSyncDriver.js';

// Import generated GraphQL resolvers
import './generated/generated.js';

// NO custom hand-written resolvers remain: every custom server action travels the Remote
// Operations stack (four-surface doctrine, Amith 2026-07-28) — see JournalEntryBatchOperations.ts /
// GenerateReversalOperation.ts / CreateJournalEntr(y|ies)Operation.ts in core-entities-server.
// (BatchDispatchResolver, ReadModelsResolver, and JournalEntryResolver were deleted 2026-07-29.)

// Import generated class registrations manifest
import { CLASS_REGISTRATIONS } from './generated/class-registrations-manifest.js';

// Re-export the manifest for consumers
export { CLASS_REGISTRATIONS } from './generated/class-registrations-manifest.js';

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Absolute paths to the resolver files (generated + custom), for use with createMJServer().
 * NOTE the `*Resolver.{js,ts}` suffix (not `*.{js,ts}`): brace-expansion of `*.{js,ts}` would
 * also match the emitted `*.d.ts` declaration files (the `*` absorbs the `.d`), which ts-node
 * then fails to require. Requiring the literal `Resolver.js`/`Resolver.ts` ending excludes `.d.ts`.
 */
export const RESOLVER_PATHS = [
    resolve(__dirname, 'generated/generated.{js,ts}'),
];

/**
 * Bootstrap function called by DynamicPackageLoader during MJAPI startup.
 * The static imports above handle all registration; this function ensures
 * the module is fully evaluated.
 */
export function LoadBizAppsAccountingServer(): void {
    // Static imports above ensure all classes are registered.
    // This function exists as the startupExport entry point for DynamicPackageLoader.
    LoadCreateJournalEntryOperation(); // tree-shaking anchor for 'Accounting.CreateJournalEntry'
    LoadCreateJournalEntriesOperation(); // tree-shaking anchor for 'Accounting.CreateJournalEntries' (the SET op)
    LoadJournalEntryBatchOperations(); // tree-shaking anchor for the Accounting.BuildJournalEntryBatch/RegenerateJournalEntryBatch/DispatchJournalEntryBatch/RecordBatchDecision/GetBatchApprovalState ops
    LoadGenerateReversalOperation(); // tree-shaking anchor for 'Accounting.GenerateJournalEntryReversal'
    LoadBizAppsAccountingBCFanOutSyncDriver(); // tree-shaking anchor for the BC fan-out scheduled-job driver
}
