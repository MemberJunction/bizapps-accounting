/**
 * acct-world — committed accounting world over GraphQL.
 *
 * AW1/AW2 look up shipped metadata (currencies, roles, JE types) and world GL/companies
 * from ORD-WORLD. AW3 stamps AccountingCompanyProfile.ApprovalCFOUserID to the current
 * user so batching's TasksAppApprovalGate can raise a CFO approval task. That field is
 * NOT set when orders catalog-world creates the ACPs, and the gate hard-fails without it.
 */
import { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import {
    Assert,
    IntegrationCheckRegistry,
    type IntegrationCheckContext,
    type NamedCheck,
} from '@memberjunction/testing-integration/registry';
import { ACCT_ENTITIES } from '../entity-names.js';
import { RequireSave, ResolveCFOUserID, SameID, View } from '../wire.js';

export interface WorldCompany {
    ID: string;
    CompanyCode: string;
}

let worldCompanies: WorldCompany[] | null = null;

export function WorldCompanies(): WorldCompany[] {
    Assert(!!worldCompanies?.length, 'acct-world.AW3 has not run — ApprovalCFOUserID is not stamped');
    return worldCompanies!;
}

const checks: NamedCheck[] = [
    {
        Id: 'acct-world.AW1',
        Name: 'AW1 — shipped currencies and GL roles are visible over GraphQL',
        RequiresMutation: true,
        Fn: async (ctx) => {
            const [currencies, roles] = await View(ctx).RunViews(
                [
                    { EntityName: ACCT_ENTITIES.Currency, Fields: ['ID', 'Code'], ResultType: 'simple' },
                    { EntityName: ACCT_ENTITIES.GLRole, Fields: ['ID', 'Name'], ResultType: 'simple' },
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
                    { EntityName: ACCT_ENTITIES.JEType, Fields: ['ID', 'Name'], ResultType: 'simple' },
                    { EntityName: ACCT_ENTITIES.GLAccount, Fields: ['ID'], MaxRows: 50, ResultType: 'simple' },
                    { EntityName: ACCT_ENTITIES.Company, Fields: ['ID'], MaxRows: 20, ResultType: 'simple' },
                ],
                ctx.User,
            );
            Assert(types.Success, types.ErrorMessage ?? 'JE types');
            Assert(accounts.Success, accounts.ErrorMessage ?? 'accounts');
            Assert(companies.Success, companies.ErrorMessage ?? 'companies');
            Assert((types.Results?.length ?? 0) > 0, 'JE types missing');
            Assert((companies.Results?.length ?? 0) > 0, 'no Accounting Company Profiles — run orders catalog-world.CW1 first');
        },
    },
    {
        Id: 'acct-world.AW3',
        Name: 'AW3 — every active company has ApprovalCFOUserID (required before batching)',
        RequiresMutation: true,
        Fn: async (ctx) => {
            const userId = await ResolveCFOUserID(ctx);

            const res = await View(ctx).RunView<{
                ID: string;
                CompanyCode: string;
                ApprovalCFOUserID: string | null;
                IsActive: boolean | number;
            }>(
                {
                    EntityName: ACCT_ENTITIES.Company,
                    Fields: ['ID', 'CompanyCode', 'ApprovalCFOUserID', 'IsActive'],
                    ResultType: 'simple',
                },
                ctx.User,
            );
            Assert(res.Success, res.ErrorMessage ?? 'companies');
            const rows = (res.Results ?? []).filter((r) => r.IsActive === true || r.IsActive === 1);
            Assert(rows.length > 0, 'no active Accounting Company Profiles — run orders catalog-world.CW1 first');

            const stamped: WorldCompany[] = [];
            for (const row of rows) {
                if (!SameID(row.ApprovalCFOUserID, userId)) {
                    const acp = await ctx.Provider.GetEntityObject<mjBizAppsAccountingAccountingCompanyProfileEntity>(
                        ACCT_ENTITIES.Company,
                        ctx.User,
                    );
                    Assert(await acp.Load(row.ID), `failed to load ACP ${row.CompanyCode} ${row.ID}`);
                    acp.ApprovalCFOUserID = userId;
                    await RequireSave(acp, `ApprovalCFOUserID on ${row.CompanyCode}`);
                }
                stamped.push({ ID: row.ID, CompanyCode: row.CompanyCode });
            }

            const verify = await View(ctx).RunView<{ ID: string; ApprovalCFOUserID: string | null }>(
                {
                    EntityName: ACCT_ENTITIES.Company,
                    ExtraFilter: `ID IN (${stamped.map((c) => `'${c.ID}'`).join(',')})`,
                    Fields: ['ID', 'ApprovalCFOUserID'],
                    ResultType: 'simple',
                },
                ctx.User,
            );
            Assert(verify.Success, verify.ErrorMessage ?? 're-read companies');
            for (const row of verify.Results ?? []) {
                Assert(SameID(row.ApprovalCFOUserID, userId), `ACP ${row.ID} still has no ApprovalCFOUserID`);
            }
            worldCompanies = stamped;
        },
    },
];

for (const c of checks) IntegrationCheckRegistry.Instance.Register(c);
IntegrationCheckRegistry.Instance.RegisterLifecycle('acct-world', { Setup: async () => {}, Teardown: async () => {} });
