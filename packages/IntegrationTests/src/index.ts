/**
 * @mj-biz-apps/accounting-integration-tests — GraphQL-wire checks for accounting.
 *
 * BUNDLES
 *   acct-world   AW1–AW3  metadata lookup + stamp ApprovalCFOUserID on world companies
 *   acct-ledger  AL1      Journal Entry RunView
 *   acct-batch   AB1      PreviewJournalEntryBatch over remote ops (does not consume pending JEs)
 */
import { LoadGeneratedEntities } from '@mj-biz-apps/accounting-entities';

LoadGeneratedEntities();

export * from './entity-names.js';
export * from './wire.js';
export * from './checks/acct-world.checks.js';
export * from './checks/acct-ledger.checks.js';
export * from './checks/acct-batch.checks.js';

export function LoadAccountingIntegrationTests(): void {
    // side-effect import is the registration
}
