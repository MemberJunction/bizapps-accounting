import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { BuildJournalEntryBatchesAction } from '../BuildJournalEntryBatchesAction';
import * as serverEngine from '@mj-biz-apps/accounting-core-entities-server';

describe('BuildJournalEntryBatchesAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Metadata.Provider = {
            Config: { ActiveStatusAssertions: false },
        } as any;
    });

    it('is registered in MJGlobal ClassFactory as Accounting.BuildJournalEntryBatches', () => {
        const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, 'Accounting.BuildJournalEntryBatches');
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(BuildJournalEntryBatchesAction);
    });

    it('processes inputs, passes exclude options, and populates output parameters', async () => {
        const action = new BuildJournalEntryBatchesAction();

        const pendingCompaniesSpy = vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch').mockImplementation(async (companyId) => {
            return {
                batchId: `BATCH-${companyId}`,
                summaryJournalEntryId: `SUMM-${companyId}`,
                summaryLineCount: 4,
                totalDebits: 1500,
                totalCredits: 1500,
                jeCount: 10,
                approvalTaskId: 'TASK-1',
            };
        });

        const params = new RunActionParams();
        params.ContextUser = { ID: 'USER-123' } as any;
        params.Params = [
            { Name: 'TargetSystem', Type: 'Input', Value: 'BusinessCentral' },
            { Name: 'Cutoff', Type: 'Input', Value: '2026-08-25' },
            { Name: 'ExcludeEntryTypeCodes', Type: 'Input', Value: ['RevenueRecognition'] },
            { Name: 'BatchCount', Type: 'Output', Value: 0 },
            { Name: 'Batches', Type: 'Output', Value: '' },
        ];

        const result = await action.Run(params);

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('SUCCESS');
        expect(result.Message).toContain('Successfully built 2 batch(es)');
        expect(pendingCompaniesSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                excludeEntryTypeCodes: ['RevenueRecognition'],
            })
        );
        expect(buildBatchSpy).toHaveBeenCalledTimes(2);

        const batchCountParam = params.Params.find(p => p.Name === 'BatchCount');
        expect(batchCountParam?.Value).toBe(2);

        const batchesParam = params.Params.find(p => p.Name === 'Batches');
        expect(batchesParam?.Value).toContain('BATCH-CO-1');
        expect(batchesParam?.Value).toContain('BATCH-CO-2');
    });

    it('returns NO_BATCHES when no candidate companies have pending entries', async () => {
        const action = new BuildJournalEntryBatchesAction();

        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch');

        const params = new RunActionParams();
        params.ContextUser = { ID: 'USER-123' } as any;
        params.Params = [
            { Name: 'TargetSystem', Type: 'Input', Value: 'BusinessCentral' },
            { Name: 'BatchCount', Type: 'Output', Value: 0 },
        ];

        const result = await action.Run(params);

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('NO_BATCHES');
        expect(result.Message).toContain('No candidate journal entries found to batch.');
        expect(buildBatchSpy).not.toHaveBeenCalled();
    });
});
