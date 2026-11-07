import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata, type UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/generic-database-provider';
import { RunERPSyncAction } from '../RunERPSyncAction';
import * as serverEngine from '@mj-biz-apps/accounting-core-entities-server';

type SyncOutput = Awaited<ReturnType<typeof serverEngine.AccountingERPEngine.Instance.SyncMasterData>>;
type SyncRow = SyncOutput['Results'][number];

/** The params the nightly job sends: no objects or companies, so every ERP connection syncs everything. */
const runParams = (): RunActionParams => {
    const params = new RunActionParams();
    params.ContextUser = { ID: 'SYSTEM-USER' } as never;
    params.Params = [];
    return params;
};

const row = (companyId: string, outcome: Pick<SyncRow, 'Success' | 'Message' | 'Skipped'>): SyncRow => ({
    CompanyID: companyId,
    CompanyIntegrationID: `CI-${companyId}`,
    ProviderName: 'business-central',
    Objects: ['accounts', 'dimensions', 'dimensionValues'],
    ...outcome,
});

const SKIPPED = row('SIDECAR', { Success: true, Skipped: true, Message: 'Skipped: no active, sync-enabled entity maps for accounts on this Company Integration.' });

describe('RunERPSyncAction (#256)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Metadata.Provider = { Config: { ActiveStatusAssertions: false } } as never;
        // The action is restricted to the MJ system user, which the scheduled sync job runs as.
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue({ ID: 'SYSTEM-USER' } as UserInfo);
    });

    it('refuses any caller other than the MJ system user', async () => {
        const sync = vi.spyOn(serverEngine.AccountingERPEngine.Instance, 'SyncMasterData');
        const params = runParams();
        params.ContextUser = { ID: 'SOMEONE-ELSE' } as never;
        await expect(new RunERPSyncAction().Run(params)).rejects.toThrow(/runs only as the MJ system user/);
        expect(sync).not.toHaveBeenCalled();
    });

    it('succeeds when every connection either synced or was skipped, and says which were skipped', async () => {
        vi.spyOn(serverEngine.AccountingERPEngine.Instance, 'SyncMasterData').mockResolvedValue({
            Success: true,
            Results: [row('BLUE-CYPRESS', { Success: true, Message: 'Synced' }), SKIPPED],
        });

        const result = await new RunERPSyncAction().Run(runParams());

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('SUCCESS');
        expect(result.Message).toBe(`BLUE-CYPRESS: ok; SIDECAR: ${SKIPPED.Message}`);
    });

    it('fails when a connection failed to sync, even beside a skipped one', async () => {
        vi.spyOn(serverEngine.AccountingERPEngine.Instance, 'SyncMasterData').mockResolvedValue({
            Success: false,
            Results: [row('BLUE-CYPRESS', { Success: false, Message: 'BC 401' }), SKIPPED],
        });

        const result = await new RunERPSyncAction().Run(runParams());

        expect(result.Success).toBe(false);
        expect(result.ResultCode).toBe('ERROR');
        expect(result.Message).toContain('BLUE-CYPRESS: BC 401');
    });
});
