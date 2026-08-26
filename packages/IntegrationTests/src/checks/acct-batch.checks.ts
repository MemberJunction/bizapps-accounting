/**
 * acct-batch — GraphQL-wire proof that batching can run.
 *
 * AB1 previews candidates (read-only). It does NOT call BuildJournalEntryBatch, which would
 * consume pending JEs (including booked order entries) and raise approval tasks. After AW3
 * stamps ApprovalCFOUserID, the UI/API build path is unblocked for those candidates.
 */
import {
    Assert,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration/registry';
import { WorldCompanies } from './acct-world.checks.js';
import { RemoteOps } from '../wire.js';

interface PreviewOutput {
    Candidates?: Array<{ ID: string; CompanyID: string; EntryNumber: string }>;
    TotalDebits?: number;
    TotalCredits?: number;
}

const checks: NamedCheck[] = [
    {
        Id: 'acct-batch.AB1',
        Name: 'AB1 — PreviewJournalEntryBatch sees pending candidates for BCP',
        RequiresMutation: true,
        Fn: async (ctx) => {
            const bcp = WorldCompanies().find((c) => c.CompanyCode === 'BCP');
            Assert(!!bcp, 'BCP company missing — run orders catalog-world.CW1 then acct-world.AW3');

            const preview = await RemoteOps(ctx).RouteOperation<
                { CompanyIDs: string[] },
                PreviewOutput
            >('Accounting.PreviewJournalEntryBatch', { CompanyIDs: [bcp.ID] });
            Assert(preview.Success, preview.ErrorMessage ?? 'Accounting.PreviewJournalEntryBatch failed');
            const candidates = preview.Output?.Candidates ?? [];
            Assert(
                candidates.length > 0,
                `BCP has no pending JE candidates to batch (preview returned 0). Book an order or post a Pending JE first.`,
            );
        },
    },
];

for (const c of checks) IntegrationCheckRegistry.Instance.Register(c);
IntegrationCheckRegistry.Instance.RegisterLifecycle('acct-batch', { Setup: async () => {}, Teardown: async () => {} });
