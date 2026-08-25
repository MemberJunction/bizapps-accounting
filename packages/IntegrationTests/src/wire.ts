import { RunView, type IMetadataProvider, type IRemoteOperationProvider } from '@memberjunction/core';
import type { IntegrationCheckContext } from '@memberjunction/testing-integration/registry';
import { Assert } from '@memberjunction/testing-integration/registry';

export function SameID(left: string | null | undefined, right: string | null | undefined): boolean {
    return (left ?? '').toLowerCase() === (right ?? '').toLowerCase();
}

export function View(ctx: IntegrationCheckContext): RunView {
    return RunView.FromMetadataProvider(ctx.Provider as IMetadataProvider);
}

export function RemoteOps(ctx: IntegrationCheckContext): IRemoteOperationProvider {
    const provider = ctx.Provider as IMetadataProvider & Partial<IRemoteOperationProvider>;
    Assert(typeof provider.RouteOperation === 'function', 'provider has no RouteOperation — GraphQL client bootstrap failed');
    return provider as IRemoteOperationProvider;
}

export async function RequireSave(
    entity: { Save: () => Promise<boolean>; LatestResult?: { CompleteMessage?: string } },
    what: string,
): Promise<void> {
    const saved = await entity.Save();
    Assert(saved, `${what} save failed: ${entity.LatestResult?.CompleteMessage ?? 'unknown'}`);
}

const SYSTEM_EMAILS = new Set(['not.set@nowhere.com', 'anonymous@magic-link.local']);

/**
 * The GraphQL IT client often authenticates as the System API-key user. Batching assigns the
 * approval Task to ApprovalCFOUserID, so stamp a real Explorer user — otherwise the UI login
 * cannot approve.
 */
export async function ResolveCFOUserID(ctx: IntegrationCheckContext): Promise<string> {
    const email = (ctx.User?.Email ?? '').toLowerCase();
    if (ctx.User?.ID && email && !SYSTEM_EMAILS.has(email)) {
        return ctx.User.ID;
    }
    const res = await View(ctx).RunView<{ ID: string; Email: string }>(
        {
            EntityName: 'MJ: Users',
            ExtraFilter: `Email IS NOT NULL`,
            Fields: ['ID', 'Email'],
            ResultType: 'simple',
        },
        ctx.User,
    );
    Assert(res.Success, res.ErrorMessage ?? 'MJ: Users');
    const human = (res.Results ?? []).find((r) => r.Email && !SYSTEM_EMAILS.has(r.Email.toLowerCase()));
    Assert(!!human?.ID, 'no human MJ: User to stamp as ApprovalCFOUserID (expected a real Explorer login)');
    return human!.ID;
}
