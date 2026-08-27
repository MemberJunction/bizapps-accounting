import {
    Assert,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration/registry';
import { ACCT_ENTITIES } from '../entity-names.js';
import { View } from '../wire.js';

const checks: NamedCheck[] = [
    {
        Id: 'acct-ledger.AL1',
        Name: 'AL1 — RunView Journal Entries over GraphQL',
        RequiresMutation: true,
        Fn: async (ctx) => {
            const res = await View(ctx).RunView(
                { EntityName: ACCT_ENTITIES.JE, Fields: ['ID'], MaxRows: 25, ResultType: 'simple' },
                ctx.User,
            );
            Assert(res.Success, res.ErrorMessage ?? 'JE RunView');
            Assert(Array.isArray(res.Results), 'Results array');
        },
    },
];

for (const c of checks) IntegrationCheckRegistry.Instance.Register(c);
IntegrationCheckRegistry.Instance.RegisterLifecycle('acct-ledger', { Setup: async () => {}, Teardown: async () => {} });
