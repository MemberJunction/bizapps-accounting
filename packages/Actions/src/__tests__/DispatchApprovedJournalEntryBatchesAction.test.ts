import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata, RunView, type UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/generic-database-provider';
import * as serverEngine from '@mj-biz-apps/accounting-core-entities-server';
import { DispatchApprovedJournalEntryBatchesAction, approvedBatchFilter } from '../DispatchApprovedJournalEntryBatchesAction';

const CO_1 = '11111111-1111-4111-8111-111111111111';
const CO_2 = '22222222-2222-4222-8222-222222222222';

const row = (n: number, companyId = CO_1) => ({ ID: `B-${n}`, JournalEntryBatchNumber: `BATCH-00000${n}`, CompanyID: companyId });

/** A batch as sendJournalEntryBatch returns it. */
const sentBatch = (status: string, errorMessage: string | null = null) =>
    ({ Status: status, ErrorMessage: errorMessage }) as unknown as Awaited<ReturnType<typeof serverEngine.sendJournalEntryBatch>>;

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

const mockApproved = (rows: Array<ReturnType<typeof row>>) =>
    vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({ Success: true, Results: rows } as never);

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

    it('sends every Approved batch, oldest approval first, through the same send the Dispatch button uses', async () => {
        const view = mockApproved([row(1), row(2, CO_2)]);
        const send = vi.spyOn(serverEngine, 'sendJournalEntryBatch').mockResolvedValue(sentBatch('Posted'));

        const params = runParams();
        const result = await new DispatchApprovedJournalEntryBatchesAction().Run(params);

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('SUCCESS');
        expect(view.mock.calls[0][0]).toMatchObject({ ExtraFilter: `Status='Approved'`, OrderBy: 'ApprovedAt ASC' });
        expect(send.mock.calls.map(c => c[0])).toEqual(['B-1', 'B-2']);
        // No confirmation is ever passed: the job does not attest that a batch has not posted.
        expect(send.mock.calls[0][2]).toEqual({ provider: Metadata.Provider });
        expect(params.Params.find(p => p.Name === 'PostedCount')?.Value).toBe(2);
    });

    it('reports a clean run with nothing to send', async () => {
        mockApproved([]);
        const send = vi.spyOn(serverEngine, 'sendJournalEntryBatch');

        const result = await new DispatchApprovedJournalEntryBatchesAction().Run(runParams());

        expect(result).toMatchObject({ Success: true, ResultCode: 'NO_BATCHES' });
        expect(send).not.toHaveBeenCalled();
    });

    it('keeps going after a batch fails, and fails the run naming each batch that did not post', async () => {
        mockApproved([row(1), row(2), row(3)]);
        vi.spyOn(serverEngine, 'sendJournalEntryBatch')
            .mockResolvedValueOnce(sentBatch('Failed', 'could not check the ERP for document BATCH-000001'))
            .mockRejectedValueOnce(new Error('The batch was not sent: batch BATCH-000002 no longer matches its approved content.'))
            .mockResolvedValueOnce(sentBatch('Posted'));

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
        mockApproved([row(1)]);
        vi.spyOn(serverEngine, 'sendJournalEntryBatch')
            .mockRejectedValue(new serverEngine.JournalEntryBatchSendRefusedError('B-1', 'Sent', 'refused'));

        const result = await new DispatchApprovedJournalEntryBatchesAction().Run(runParams());

        expect(result.Success).toBe(true);
    });

    it('runs only as the MJ system user, before reading any batch', async () => {
        const view = mockApproved([row(1)]);

        await expect(new DispatchApprovedJournalEntryBatchesAction().Run(runParams([], 'FINANCE-USER')))
            .rejects.toThrow(/runs only as the MJ system user/);
        expect(view).not.toHaveBeenCalled();
    });

    it('fails closed when the user cache does not hold the system user', async () => {
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue(undefined as never);

        await expect(new DispatchApprovedJournalEntryBatchesAction().Run(runParams()))
            .rejects.toThrow(/runs only as the MJ system user/);
    });
});

describe('approvedBatchFilter', () => {
    it('narrows to a target ERP and to companies', () => {
        expect(approvedBatchFilter({ targetSystem: 'BusinessCentral', companyIds: [CO_1, CO_2] }))
            .toBe(`Status='Approved' AND TargetSystem='BusinessCentral' AND CompanyID IN ('${CO_1}','${CO_2}')`);
    });

    it('refuses a target ERP outside the known set and a company that is not an ID', () => {
        expect(() => approvedBatchFilter({ targetSystem: "x' OR 1=1 --" as never, companyIds: null })).toThrow(/is not a target ERP/);
        expect(() => approvedBatchFilter({ targetSystem: null, companyIds: ["x' OR 1=1 --"] })).toThrow(/not a valid UUID/);
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
