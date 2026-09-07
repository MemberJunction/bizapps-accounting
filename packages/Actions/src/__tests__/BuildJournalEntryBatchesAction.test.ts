import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { BuildJournalEntryBatchesAction, resolveCutoff } from '../BuildJournalEntryBatchesAction';
import * as serverEngine from '@mj-biz-apps/accounting-core-entities-server';

/** A built batch, shaped as buildJournalEntryBatch returns it. */
const buildResult = (companyId: string): serverEngine.BuildJournalEntryBatchResult => ({
    batchId: `BATCH-${companyId}`,
    summaryJournalEntryId: `SUMM-${companyId}`,
    summaryLineCount: 4,
    totalDebits: 1500,
    totalCredits: 1500,
    jeCount: 10,
    approvalTaskId: null,
});

/** The params every run needs, plus whatever the case under test adds. */
const runParams = (inputs: Array<{ Name: string; Value: unknown }>): RunActionParams => {
    const params = new RunActionParams();
    params.ContextUser = { ID: 'SYSTEM-USER' } as never;
    params.Params = [
        { Name: 'TargetSystem', Type: 'Input', Value: 'BusinessCentral' },
        ...inputs.map(i => ({ Name: i.Name, Type: 'Input' as const, Value: i.Value })),
        { Name: 'BatchCount', Type: 'Output', Value: 0 },
        { Name: 'Batches', Type: 'Output', Value: '' },
    ];
    return params;
};

/** The nightly job's shipped configuration. */
const AUTO_POST_INPUTS = [
    { Name: 'AutoPost', Value: true },
    { Name: 'CutoffMode', Value: 'PriorDay' },
    { Name: 'EntryTypeCodes', Value: ['OrderBooking', 'PaymentReceipt', 'Refund'] },
];

describe('BuildJournalEntryBatchesAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Metadata.Provider = {
            Config: { ActiveStatusAssertions: false },
        } as never;
    });

    it('is registered in MJGlobal ClassFactory as Accounting.BuildJournalEntryBatches', () => {
        const instance = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(BaseAction, 'Accounting.BuildJournalEntryBatches');
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(BuildJournalEntryBatchesAction);
    });

    it('processes inputs, passes exclude options, and populates output parameters', async () => {
        const pendingCompaniesSpy = vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch')
            .mockImplementation(async (companyId) => buildResult(companyId));

        const params = runParams([
            { Name: 'Cutoff', Value: '2026-08-25' },
            { Name: 'ExcludeEntryTypeCodes', Value: ['RevenueRecognition'] },
        ]);
        const result = await new BuildJournalEntryBatchesAction().Run(params);

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('SUCCESS');
        expect(result.Message).toContain('Built 2 batch(es)');
        expect(result.Message).toContain('Awaiting approval');
        expect(pendingCompaniesSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ excludeEntryTypeCodes: ['RevenueRecognition'] }),
        );
        expect(buildBatchSpy).toHaveBeenCalledTimes(2);
        expect(params.Params.find(p => p.Name === 'BatchCount')?.Value).toBe(2);
        expect(params.Params.find(p => p.Name === 'Batches')?.Value).toContain('BATCH-CO-1');
    });

    it('returns NO_BATCHES when no candidate companies have pending entries', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch');

        const result = await new BuildJournalEntryBatchesAction().Run(runParams([]));

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('NO_BATCHES');
        expect(result.Message).toContain('No candidate journal entries found to batch.');
        expect(buildBatchSpy).not.toHaveBeenCalled();
    });

    // ─── Cutoff arithmetic (golive #161 / #162 acceptance criteria) ──────────────────────

    describe('resolveCutoff', () => {
        // pendingCandidateFilter turns a midnight-UTC cutoff into `EffectiveDate < cutoff + 1 day`,
        // so the cutoff DAY is inclusive. These are the dates that make "strictly before" true.
        it('PriorDay resolves to yesterday — so the filter becomes "before the run date"', () => {
            const cutoff = resolveCutoff(undefined, 'PriorDay', new Date('2026-08-20T01:00:00Z'));
            expect(cutoff?.toISOString()).toBe('2026-08-19T00:00:00.000Z');
        });

        it('PriorDay crosses a month boundary', () => {
            const cutoff = resolveCutoff(undefined, 'PriorDay', new Date('2026-09-01T01:00:00Z'));
            expect(cutoff?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
        });

        it('PriorMonth resolves to the last day of the prior month — filter becomes "before the 1st"', () => {
            const cutoff = resolveCutoff(undefined, 'PriorMonth', new Date('2026-04-01T03:00:00Z'));
            expect(cutoff?.toISOString()).toBe('2026-03-31T00:00:00.000Z');
        });

        it('PriorMonth handles a short prior month and a year boundary', () => {
            expect(resolveCutoff(undefined, 'PriorMonth', new Date('2026-03-01T03:00:00Z'))?.toISOString())
                .toBe('2026-02-28T00:00:00.000Z');
            expect(resolveCutoff(undefined, 'PriorMonth', new Date('2026-01-01T03:00:00Z'))?.toISOString())
                .toBe('2025-12-31T00:00:00.000Z');
        });

        it('an explicit Cutoff overrides the relative mode, so the manual path is unaffected', () => {
            const cutoff = resolveCutoff('2026-08-25', 'PriorDay', new Date('2026-09-01T01:00:00Z'));
            expect(cutoff?.toISOString()).toBe('2026-08-25T00:00:00.000Z');
        });

        it('no cutoff and no mode means no date clause at all', () => {
            expect(resolveCutoff(undefined, undefined, new Date())).toBeNull();
        });

        it('rejects an unknown mode rather than silently dropping the date clause', () => {
            expect(() => resolveCutoff(undefined, 'LastWeek', new Date())).toThrow(/unknown CutoffMode/);
        });
    });

    // ─── Gate selection (the scheduled-posting approval waiver) ──────────────────────────

    it('defaults to the bizapps-tasks CFO gate and does not dispatch', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch')
            .mockImplementation(async (companyId) => buildResult(companyId));
        const approveSpy = vi.spyOn(serverEngine, 'approveJournalEntryBatch');
        const sendSpy = vi.spyOn(serverEngine, 'sendJournalEntryBatch');

        await new BuildJournalEntryBatchesAction().Run(runParams([]));

        expect(buildBatchSpy.mock.calls[0][5]).toBeInstanceOf(serverEngine.TasksAppApprovalGate);
        expect(approveSpy).not.toHaveBeenCalled();
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it('AutoPost selects AutoApproveGate and posts through to the ERP in one run', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch')
            .mockImplementation(async (companyId) => buildResult(companyId));
        const approveSpy = vi.spyOn(serverEngine, 'approveJournalEntryBatch').mockResolvedValue({} as never);
        const sendSpy = vi.spyOn(serverEngine, 'sendJournalEntryBatch')
            .mockResolvedValue({ Status: 'Posted', ErrorMessage: null } as never);
        vi.spyOn(serverEngine, 'createAccountingERPPoster').mockReturnValue(vi.fn() as never);

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(buildBatchSpy.mock.calls[0][5]).toBe(serverEngine.AutoApproveGate);
        expect(sendSpy).toHaveBeenCalledTimes(2);
        expect(result.Success).toBe(true);
        expect(result.Message).toContain('All dispatched to the ERP');
        // The waiver removes the approval step, not the audit trail: the context user is stamped.
        expect(approveSpy).toHaveBeenCalledWith('BATCH-CO-1', 'SYSTEM-USER', expect.anything(), expect.anything());
    });

    it('marks a batch Failed when its dispatch throws, and carries on to the next company', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        vi.spyOn(serverEngine, 'buildJournalEntryBatch').mockImplementation(async (companyId) => buildResult(companyId));
        vi.spyOn(serverEngine, 'approveJournalEntryBatch').mockResolvedValue({} as never);
        vi.spyOn(serverEngine, 'createAccountingERPPoster').mockReturnValue(vi.fn() as never);
        const sendSpy = vi.spyOn(serverEngine, 'sendJournalEntryBatch').mockImplementation(async (batchId) => {
            if (batchId === 'BATCH-CO-1') throw new Error('ERP tenant unreachable');
            return { Status: 'Posted', ErrorMessage: null } as never;
        });
        const failSpy = vi.spyOn(serverEngine, 'failJournalEntryBatch').mockResolvedValue({} as never);

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(sendSpy).toHaveBeenCalledTimes(2); // CO-2 still ran
        expect(failSpy).toHaveBeenCalledWith('BATCH-CO-1', 'ERP tenant unreachable', expect.anything(), expect.anything());
        expect(result.Success).toBe(false);
        expect(result.ResultCode).toBe('DISPATCH_FAILED');
        expect(result.Message).toContain('1 of 2 batch(es) failed to dispatch');
        expect(result.Message).toContain('ERP tenant unreachable');
    });

    it('reports a poster that returns Failed without throwing', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        vi.spyOn(serverEngine, 'buildJournalEntryBatch').mockImplementation(async (companyId) => buildResult(companyId));
        vi.spyOn(serverEngine, 'approveJournalEntryBatch').mockResolvedValue({} as never);
        vi.spyOn(serverEngine, 'createAccountingERPPoster').mockReturnValue(vi.fn() as never);
        vi.spyOn(serverEngine, 'sendJournalEntryBatch')
            .mockResolvedValue({ Status: 'Failed', ErrorMessage: 'No active integration' } as never);

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.ResultCode).toBe('DISPATCH_FAILED');
        expect(result.Message).toContain('No active integration');
    });

    it('an AutoPost run with nothing eligible posts nothing and errors on nothing', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);
        const sendSpy = vi.spyOn(serverEngine, 'sendJournalEntryBatch');

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('NO_BATCHES');
        expect(sendSpy).not.toHaveBeenCalled();
    });

    // ─── Auto-post policy is include-list only ───────────────────────────────────────────

    it('refuses to auto-post without an explicit EntryTypeCodes include-list', async () => {
        const pendingSpy = vi.spyOn(serverEngine, 'pendingCompanies');
        const params = runParams([{ Name: 'AutoPost', Value: true }, { Name: 'CutoffMode', Value: 'PriorDay' }]);

        await expect(new BuildJournalEntryBatchesAction().Run(params)).rejects.toThrow(/include-list/);
        expect(pendingSpy).not.toHaveBeenCalled();
    });

    it('accepts a string "True" from an admin-typed Static param', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);
        const params = runParams([
            { Name: 'AutoPost', Value: 'True' },
            { Name: 'CutoffMode', Value: 'PriorDay' },
        ]);

        // AutoPost was honoured, so the include-list guard fires rather than a quiet attended build.
        await expect(new BuildJournalEntryBatchesAction().Run(params)).rejects.toThrow(/include-list/);
    });

    it('refuses an ExcludeEntryTypeCodes blacklist on the auto-post path', async () => {
        const params = runParams([...AUTO_POST_INPUTS, { Name: 'ExcludeEntryTypeCodes', Value: ['Manual'] }]);

        await expect(new BuildJournalEntryBatchesAction().Run(params)).rejects.toThrow(/not a blacklist/);
    });
});
