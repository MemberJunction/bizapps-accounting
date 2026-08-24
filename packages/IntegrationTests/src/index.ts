import { LoadGeneratedEntities } from '@mj-biz-apps/accounting-entities';
import { RunView, type IMetadataProvider } from '@memberjunction/core';
import {
    Assert,
    IntegrationCheckRegistry,
    type IntegrationCheckContext,
    type NamedCheck,
} from '@memberjunction/testing-integration/registry';

LoadGeneratedEntities();

const ENT = {
    Currency: 'MJ_BizApps_Accounting: Currencies',
    GLRole: 'MJ_BizApps_Accounting: GL Account Roles',
    GLAccount: 'MJ_BizApps_Accounting: GL Accounts',
    JEType: 'MJ_BizApps_Accounting: Journal Entry Types',
    JE: 'MJ_BizApps_Accounting: Journal Entries',
    Company: 'MJ_BizApps_Accounting: Accounting Company Profiles',
} as const;

function View(ctx: IntegrationCheckContext): RunView {
    return RunView.FromMetadataProvider(ctx.Provider as IMetadataProvider);
}

const checks: NamedCheck[] = [
    {
        Id: 'acct-world.AW1',
        Name: 'AW1 — shipped currencies and GL roles are visible over GraphQL',
        RequiresMutation: true,
        Fn: async (ctx) => {
            const [currencies, roles] = await View(ctx).RunViews(
                [
                    { EntityName: ENT.Currency, Fields: ['ID', 'Code'], ResultType: 'simple' },
                    { EntityName: ENT.GLRole, Fields: ['ID', 'Name'], ResultType: 'simple' },
                ],
                ctx.User,
            );
            Assert(currencies.Success, currencies.ErrorMessage ?? 'currencies');
            Assert(roles.Success, roles.ErrorMessage ?? 'roles');
            Assert((currencies.Results?.length ?? 0) > 0, 'push accounting metadata — currencies');
            Assert((roles.Results?.length ?? 0) > 0, 'push accounting metadata — GL roles');
        },
    },
    {
        Id: 'acct-world.AW2',
        Name: 'AW2 — journal entry types (metadata) and GL accounts (world) over GraphQL',
        RequiresMutation: true,
        Fn: async (ctx) => {
            const [types, accounts, companies] = await View(ctx).RunViews(
                [
                    { EntityName: ENT.JEType, Fields: ['ID', 'Name'], ResultType: 'simple' },
                    { EntityName: ENT.GLAccount, Fields: ['ID'], MaxRows: 50, ResultType: 'simple' },
                    { EntityName: ENT.Company, Fields: ['ID'], MaxRows: 20, ResultType: 'simple' },
                ],
                ctx.User,
            );
            Assert(types.Success, types.ErrorMessage ?? 'JE types');
            Assert(accounts.Success, accounts.ErrorMessage ?? 'accounts');
            Assert(companies.Success, companies.ErrorMessage ?? 'companies');
            Assert((types.Results?.length ?? 0) > 0, 'JE types missing');
        },
    },
    {
        Id: 'acct-ledger.AL1',
        Name: 'AL1 — RunView Journal Entries over GraphQL',
        RequiresMutation: true,
        Fn: async (ctx) => {
            const res = await View(ctx).RunView(
                { EntityName: ENT.JE, Fields: ['ID'], MaxRows: 25, ResultType: 'simple' },
                ctx.User,
            );
            Assert(res.Success, res.ErrorMessage ?? 'JE RunView');
            Assert(Array.isArray(res.Results), 'Results array');
        },
    },
];

for (const c of checks) IntegrationCheckRegistry.Instance.Register(c);
IntegrationCheckRegistry.Instance.RegisterLifecycle('acct-world', { Setup: async () => {}, Teardown: async () => {} });
IntegrationCheckRegistry.Instance.RegisterLifecycle('acct-ledger', { Setup: async () => {}, Teardown: async () => {} });

export function LoadAccountingIntegrationTests(): void {}
