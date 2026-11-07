import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata, type UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/generic-database-provider';
import * as serverEngine from '@mj-biz-apps/accounting-core-entities-server';
import { DispatchApprovedJournalEntryBatchesAction } from '../DispatchApprovedJournalEntryBatchesAction';

/**
 * The selection and the sends are `dispatchApprovedJournalEntryBatches` in
 * accounting-core-entities-server, tested there (ApprovedBatchDispatch.test.ts) with the Send approved
 * batches operation that shares it. What is under test here is the action's own part: the system-user
 * check, the inputs it passes and the result it reports.
 */
const CO_1 = '11111111-1111-4111-8111-111111111111';

type Outcome = serverEngine.ApprovedBatchDispatchOutcome;
const outcome = (n: number, status: string, over: Partial<Outcome> = {}): Outcome => ({
    batchId: `B-${n}`, batchNumber: `BATCH-00000${n}`, companyId: CO_1, company: 'Co 1', status,
    error: null, needsAttention: status !== 'Posted', takenByAnotherSend: false, ...over,
});

const runParams = (inputs: Array<{ Name: string; Value: unknown }> = [], userId = 'SYSTEM-USER'): RunActionParams => {
    const params = new RunActionParams();
    params.ContextUser = { ID: userId } as never;
    params.Params = [
        ...inputs.map(i => ({ Name: i.Name, Type: 'Input' as const, Value: i.Value })),
        { Name: 'PostedCount', Type: 'Output', Value: 0 },
        { Name: 'Batches', Type: 'Output', Value: '' },
    ];
    return params;
};

const mockDispatch = (outcomes: Outcome[]) =>
    vi.spyOn(serverEngine, 'dispatchApprovedJournalEntryBatches').mockResolvedValue(outcomes);

describe('DispatchApprovedJournalEntryBatchesAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Metadata.Provider = { Config: { ActiveStatusAssertions: false } } as never;
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue({ ID: 'SYSTEM-USER' } as UserInfo);
    });

    it('is registered in MJGlobal ClassFactory as Accounting.DispatchApprovedJournalEntryBatches', () => {
        const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, 'Accounting.DispatchApprovedJournalEntryBatches');
        expect(instance).toBeInstanceOf(DispatchApprovedJournalEntryBatchesAction);
    });

    it('sends through the shared dispatch, passing its filter inputs and the server provider', async () => {
        const dispatch = mockDispatch([outcome(1, 'Posted'), outcome(2, 'Posted')]);

        const params = runParams([{ Name: 'TargetSystem', Value: 'BusinessCentral' }, { Name: 'CompanyIDs', Value: [CO_1] }]);
        const result = await new DispatchApprovedJournalEntryBatchesAction().Run(params);

        expect(result).toMatchObject({ Success: true, ResultCode: 'SUCCESS' });
        expect(dispatch).toHaveBeenCalledWith({ targetSystem: 'BusinessCentral', companyIds: [CO_1] }, params.ContextUser, Metadata.Provider);
        expect(params.Params.find(p => p.Name === 'PostedCount')?.Value).toBe(2);
    });

    it('passes no narrowing when no filter inputs are given', async () => {
        const dispatch = mockDispatch([]);

        await new DispatchApprovedJournalEntryBatchesAction().Run(runParams([{ Name: 'CompanyIDs', Value: [] }]));

        expect(dispatch.mock.calls[0][0]).toEqual({ targetSystem: null, companyIds: null });
    });

    it('reports a clean run with nothing to send', async () => {
        mockDispatch([]);

        const result = await new DispatchApprovedJournalEntryBatchesAction().Run(runParams());

        expect(result).toMatchObject({ Success: true, ResultCode: 'NO_BATCHES' });
    });

    it('fails the run naming each batch that did not post', async () => {
        mockDispatch([
            outcome(1, 'Failed', { error: 'could not check the ERP for document BATCH-000001' }),
            outcome(2, 'Approved', { error: 'The batch was not sent: batch BATCH-000002 no longer matches its approved content.' }),
            outcome(3, 'Posted'),
        ]);

        const params = runParams();
        const result = await new DispatchApprovedJournalEntryBatchesAction().Run(params);

        expect(result.Success).toBe(false);
        expect(result.ResultCode).toBe('POST_INCOMPLETE');
        expect(result.Message).toContain('BATCH-000001 (Failed: could not check the ERP');
        expect(result.Message).toContain('BATCH-000002 (Approved: The batch was not sent');
        expect(result.Message).not.toContain('BATCH-000003');
        expect(params.Params.find(p => p.Name === 'PostedCount')?.Value).toBe(1);
        expect(JSON.parse(String(params.Params.find(p => p.Name === 'Batches')?.Value))).toHaveLength(3);
    });

    it('leaves a batch another send took first to that send, without failing the run', async () => {
        mockDispatch([outcome(1, 'Sent', { needsAttention: false, takenByAnotherSend: true })]);

        const result = await new DispatchApprovedJournalEntryBatchesAction().Run(runParams());

        expect(result.Success).toBe(true);
    });

    it('runs only as the MJ system user, before reading any batch', async () => {
        const dispatch = mockDispatch([outcome(1, 'Posted')]);

        await expect(new DispatchApprovedJournalEntryBatchesAction().Run(runParams([], 'FINANCE-USER')))
            .rejects.toThrow(/runs only as the MJ system user/);
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('fails closed when the user cache does not hold the system user', async () => {
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue(undefined as never);

        await expect(new DispatchApprovedJournalEntryBatchesAction().Run(runParams()))
            .rejects.toThrow(/runs only as the MJ system user/);
    });
});

describe('the hourly dispatch job', () => {
    const [job] = JSON.parse(readFileSync(
        resolve(__dirname, '../../../../metadata/scheduled-jobs/.accounting-dispatch-approved-batches-hourly.json'), 'utf8',
    )) as Array<{ fields: { CronExpression: string; Configuration: { ActionID: string; Params?: unknown[] } } }>;
    const actions = JSON.parse(readFileSync(resolve(__dirname, '../../../../metadata/actions/.accounting-actions.json'), 'utf8')) as
        Array<{ fields: { DriverClass: string }; primaryKey: { ID: string } }>;

    it('runs the dispatch action', () => {
        const action = actions.find(a => a.fields.DriverClass === 'Accounting.DispatchApprovedJournalEntryBatches');
        expect(job.fields.Configuration.ActionID).toBe(action?.primaryKey.ID);
    });

    it('declares a six-field cron, seconds first', () => {
        expect(job.fields.CronExpression.trim().split(/\s+/)).toHaveLength(6);
    });
});
