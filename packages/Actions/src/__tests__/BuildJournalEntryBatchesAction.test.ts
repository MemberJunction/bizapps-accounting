import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import { RunActionParams } from '@memberjunction/actions-base';
import { Metadata, type UserInfo } from '@memberjunction/core';

import { UserCache } from '@memberjunction/generic-database-provider';
import { BuildJournalEntryBatchesAction, postingDateForCutoff, resolveCutoff } from '../BuildJournalEntryBatchesAction';
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
        vi.spyOn(serverEngine, 'findStrandedJournalEntries').mockResolvedValue([]);
        // AutoPost is restricted to the MJ system user (#269); every run here is made as it unless a case says otherwise.
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue({ ID: 'SYSTEM-USER' } as UserInfo);
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

    it('passes StartDate to the engine as the caller wrote it, so its shape decides day vs instant', async () => {
        // `new Date(startDate)` turned 2026-09-30T19:00:00-05:00 into UTC midnight on 1 October,
        // which the engine then read as the day 1 October (golive #168).
        const pendingCompaniesSpy = vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);

        await new BuildJournalEntryBatchesAction().Run(runParams([{ Name: 'StartDate', Value: '2026-09-30T19:00:00-05:00' }]));

        expect(pendingCompaniesSpy.mock.calls[0][2].startDate).toBe('2026-09-30T19:00:00-05:00');
    });

    it('dates the batches the last day of the sweep window — the cutoff day — not the run date (golive #314)', async () => {
        const pendingCompaniesSpy = vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch').mockImplementation(async (companyId) => buildResult(companyId));

        await new BuildJournalEntryBatchesAction().Run(runParams([{ Name: 'Cutoff', Value: '2026-08-31' }]));

        expect(pendingCompaniesSpy.mock.calls[0][2].postingDate).toEqual(new Date('2026-08-31T00:00:00Z'));
        expect(buildBatchSpy.mock.calls[0][6]?.postingDate).toEqual(new Date('2026-08-31T00:00:00Z'));
    });

    it('leaves the posting date to the engine (today) when the run has no cutoff', async () => {
        const pendingCompaniesSpy = vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);

        await new BuildJournalEntryBatchesAction().Run(runParams([]));

        expect(pendingCompaniesSpy.mock.calls[0][2].postingDate).toBeNull();
    });

    it('refuses a malformed StartDate with an error naming it, before reading any company', async () => {
        // Thrown, like an unknown CutoffMode: `new Date('2026-02-30')` silently rolled to 2 March.
        const pendingCompaniesSpy = vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);

        await expect(new BuildJournalEntryBatchesAction().Run(runParams([{ Name: 'StartDate', Value: '2026-02-30' }])))
            .rejects.toThrow(/StartDate: '2026-02-30' is not a real calendar day/);
        expect(pendingCompaniesSpy).not.toHaveBeenCalled();
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

    // ─── Posting date = the end of the sweep window (golive #314 acceptance criteria) ──────

    describe('postingDateForCutoff', () => {
        const chicago = 'America/Chicago';
        const day = (d: Date | null): string | null => d?.toISOString() ?? null;

        it('a nightly run on 9/1 (cutoff 8/31) is dated 8/31', () => {
            const now = new Date('2026-09-01T06:00:00Z'); // 1 AM Central
            expect(day(postingDateForCutoff(resolveCutoff(undefined, 'PriorDay', now, chicago), now, chicago))).toBe('2026-08-31T00:00:00.000Z');
        });

        it('a monthly run on 9/1 (cutoff 8/31) is dated 8/31', () => {
            const now = new Date('2026-09-01T08:00:00Z'); // 3 AM Central
            expect(day(postingDateForCutoff(resolveCutoff(undefined, 'PriorMonth', now, chicago), now, chicago))).toBe('2026-08-31T00:00:00.000Z');
        });

        it('a nightly run on 9/15 (cutoff 9/14) is dated 9/14', () => {
            const now = new Date('2026-09-15T06:00:00Z');
            expect(day(postingDateForCutoff(resolveCutoff(undefined, 'PriorDay', now, chicago), now, chicago))).toBe('2026-09-14T00:00:00.000Z');
        });

        it('a cutoff later than today ends the window today — a posting date is never in the future', () => {
            const now = new Date('2026-09-15T15:00:00Z');
            expect(day(postingDateForCutoff(new Date('2026-09-30T00:00:00Z'), now, chicago))).toBe('2026-09-15T00:00:00.000Z');
        });

        it('takes today in the business zone, not UTC', () => {
            // 9 PM Central on 14 September is already the 15th in UTC.
            const now = new Date('2026-09-15T02:00:00Z');
            expect(day(postingDateForCutoff(new Date('2026-09-30T00:00:00Z'), now, chicago))).toBe('2026-09-14T00:00:00.000Z');
        });

        it('no cutoff gives no posting date, so the engine uses today', () => {
            expect(postingDateForCutoff(null, new Date(), chicago)).toBeNull();
        });
    });

    // ─── Cutoff arithmetic (golive #161 / #162 acceptance criteria) ──────────────────────

    describe('resolveCutoff', () => {
        // pendingCandidateFilter turns a midnight-UTC cutoff into `EffectiveDate < cutoff + 1 day`,
        // so the cutoff DAY is inclusive. These are the dates that make "strictly before" true.
        it('PriorDay resolves to yesterday — so the filter becomes "before the run date"', () => {
            const cutoff = resolveCutoff(undefined, 'PriorDay', new Date('2026-08-20T01:00:00Z'), 'UTC');
            expect(cutoff?.toISOString()).toBe('2026-08-19T00:00:00.000Z');
        });

        it('PriorDay crosses a month boundary', () => {
            const cutoff = resolveCutoff(undefined, 'PriorDay', new Date('2026-09-01T01:00:00Z'), 'UTC');
            expect(cutoff?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
        });

        it('PriorMonth resolves to the last day of the prior month — filter becomes "before the 1st"', () => {
            const cutoff = resolveCutoff(undefined, 'PriorMonth', new Date('2026-04-01T03:00:00Z'), 'UTC');
            expect(cutoff?.toISOString()).toBe('2026-03-31T00:00:00.000Z');
        });

        it('PriorMonth handles a short prior month and a year boundary', () => {
            expect(resolveCutoff(undefined, 'PriorMonth', new Date('2026-03-01T03:00:00Z'), 'UTC')?.toISOString())
                .toBe('2026-02-28T00:00:00.000Z');
            expect(resolveCutoff(undefined, 'PriorMonth', new Date('2026-01-01T03:00:00Z'), 'UTC')?.toISOString())
                .toBe('2025-12-31T00:00:00.000Z');
        });

        it('an explicit Cutoff overrides the relative mode, so the manual path is unaffected', () => {
            const cutoff = resolveCutoff('2026-08-25', 'PriorDay', new Date('2026-09-01T01:00:00Z'), 'UTC');
            expect(cutoff?.toISOString()).toBe('2026-08-25T00:00:00.000Z');
        });

        // An explicit Cutoff's SHAPE decides what it means (golive #168): a plain day is that day; a
        // date-time with an offset is the BUSINESS day it falls on. 7 PM Central on 30 September is
        // exactly UTC midnight on 1 October — read as a Date, it looked like a day input for the 1st.
        it('an explicit date-time cutoff at 7 PM Central is 30 September, not 1 October', () => {
            const cutoff = resolveCutoff('2026-09-30T19:00:00-05:00', undefined, new Date('2026-10-01T12:00:00Z'), 'America/Chicago');
            expect(cutoff?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
        });

        it('an explicit date-time cutoff in the evening is the business day, not its UTC day', () => {
            const cutoff = resolveCutoff('2026-10-01T02:30:00Z', undefined, new Date('2026-10-01T12:00:00Z'), 'America/Chicago');
            expect(cutoff?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
        });

        it.each([
            ['garbage', /Cutoff: 'garbage' is not a calendar day/],
            ['2026-02-30', /Cutoff: '2026-02-30' is not a real calendar day/],
            ['2026-09-30T19:00:00', /with an offset/],
        ])('refuses a malformed explicit Cutoff (%s) instead of throwing a bare RangeError or rolling over', (value, message) => {
            expect(() => resolveCutoff(value, undefined, new Date(), 'UTC')).toThrow(message);
        });

        it('no cutoff and no mode means no date clause at all', () => {
            expect(resolveCutoff(undefined, undefined, new Date(), 'UTC')).toBeNull();
        });

        it('rejects an unknown mode rather than silently dropping the date clause', () => {
            expect(() => resolveCutoff(undefined, 'LastWeek', new Date(), 'UTC')).toThrow(/unknown CutoffMode/);
        });

        // ── The acceptance criteria, at the instants the jobs ACTUALLY fire ──────────────────
        //
        // Both jobs carry `Timezone: America/Chicago`, so their cron hours are Central, not UTC.
        // These two tests use the real firing instants; they are what bc-aidp-next-golive#168 asks
        // for, and they are the reason the Timezone on those job rows must equal the business zone.

        it('the nightly run at 01:00 Central on 1 September includes the 9 PM Central entry of 31 August', () => {
            // `0 0 1 * * *` in America/Chicago fires at 06:00Z (CDT). Business day = 1 September,
            // so the cutoff is 31 August and pendingCandidateFilter asks for `EffectiveDate < 1 Sep`
            // — the 31 August entry is in, which is the acceptance criterion.
            const cutoff = resolveCutoff(undefined, 'PriorDay', new Date('2026-09-01T06:00:00Z'), 'America/Chicago');
            expect(cutoff?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
        });

        it('the monthly run at 03:00 Central on 1 September closes AUGUST, not July', () => {
            // `0 0 3 1 * *` in America/Chicago fires at 08:00Z (CDT). Business day = 1 September,
            // so the cutoff is 31 August → `EffectiveDate < 1 Sep` → the whole of August posts.
            const cutoff = resolveCutoff(undefined, 'PriorMonth', new Date('2026-09-01T08:00:00Z'), 'America/Chicago');
            expect(cutoff?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
        });

        // ── Why the Timezone on those job rows is load-bearing ───────────────────────────────
        //
        // These two pin what happens if a host leaves the schedule on a clock that has not rolled
        // over into the business day yet — the state this branch originally shipped in, with the
        // cron on UTC and the cutoff on Central. `resolveCutoff` is not wrong in either case: it
        // answers correctly for the instant it is handed. The schedule is what must agree with it.

        it('fired before the business day rolls over, PriorDay lags a full day', () => {
            // 02:00Z on 1 Sep is 21:00 Central on 31 Aug — still August in Chicago, so "the day
            // before today" is 30 August and the 31st waits for the next run.
            const early = resolveCutoff(undefined, 'PriorDay', new Date('2026-09-01T02:00:00Z'), 'America/Chicago');
            expect(early?.toISOString()).toBe('2026-08-30T00:00:00.000Z');
            const nextRun = resolveCutoff(undefined, 'PriorDay', new Date('2026-09-02T02:00:00Z'), 'America/Chicago');
            expect(nextRun?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
        });

        it('fired before the business day rolls over, PriorMonth skips the month being closed', () => {
            // 01:00Z on 1 Sep is 20:00 Central on 31 Aug. The month has not ended in Chicago, so
            // "the last day of the prior month" is 31 JULY — August would not post until October.
            const early = resolveCutoff(undefined, 'PriorMonth', new Date('2026-09-01T01:00:00Z'), 'America/Chicago');
            expect(early?.toISOString()).toBe('2026-07-31T00:00:00.000Z');
            // Later the same UTC day, Chicago has caught up and the answer is right again — which
            // is why a spot check at midday would have missed this entirely.
            const later = resolveCutoff(undefined, 'PriorMonth', new Date('2026-09-01T12:00:00Z'), 'America/Chicago');
            expect(later?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
        });
    });

    // ─── Gate selection (the scheduled-posting approval waiver) ──────────────────────────

    it('defaults to the bizapps-tasks CFO gate and does not dispatch', async () => {
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch');
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch')
            .mockImplementation(async (companyId) => buildResult(companyId));
        const approveSpy = vi.spyOn(serverEngine, 'approveJournalEntryBatch');
        const sendSpy = vi.spyOn(serverEngine, 'sendJournalEntryBatch');

        await new BuildJournalEntryBatchesAction().Run(runParams([]));

        expect(buildBatchSpy.mock.calls[0][5]).toBeInstanceOf(serverEngine.TasksAppApprovalGate);
        expect(autoPostSpy).not.toHaveBeenCalled();
        expect(approveSpy).not.toHaveBeenCalled();
        expect(sendSpy).not.toHaveBeenCalled();
    });

    /** autoPostJournalEntryBatch as it answers for one company: built, then sent to `status`. */
    const autoPosted = (companyId: string, status = 'Posted', errorMessage: string | null = null) =>
        ({ build: buildResult(companyId), batch: { Status: status, ErrorMessage: errorMessage } as never });

    it('AutoPost runs each company through the engine\'s waiver, and never builds or sends directly', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch')
            .mockImplementation(async (companyId) => autoPosted(companyId));
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch');
        const sendSpy = vi.spyOn(serverEngine, 'sendJournalEntryBatch');

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(autoPostSpy.mock.calls.map(c => c[0])).toEqual(['CO-1', 'CO-2']);
        // The context user is the approver the waiver stamps; the include-list reaches the engine.
        expect(autoPostSpy).toHaveBeenCalledWith('CO-1', 'BusinessCentral', expect.objectContaining({ ID: 'SYSTEM-USER' }), expect.anything(),
            expect.objectContaining({ entryTypeCodes: ['OrderBooking', 'PaymentReceipt', 'Refund'] }));
        expect(buildBatchSpy).not.toHaveBeenCalled();
        expect(sendSpy).not.toHaveBeenCalled();
        expect(result.Success).toBe(true);
        expect(result.Message).toContain('All dispatched to the ERP');
    });

    // The ERP accepted the batch, and neither its Posted nor its Failed save landed: triage keeps the
    // reference, so the retry records the batch Posted instead of sending it again.
    it('passes the ERP reference to triage when the Failed save did not persist after the ERP accepted the batch', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        const notRecorded = new serverEngine.JournalEntryBatchFailureNotRecordedError('BATCH-CO-1', 'Sent', 'G00042', 'recording Posted failed', 'database unavailable');
        vi.spyOn(serverEngine, 'autoPostJournalEntryBatch').mockRejectedValue(new serverEngine.AutoPostDispatchError(buildResult('CO-1'), notRecorded));
        const failSpy = vi.spyOn(serverEngine, 'recordDispatchFailure').mockResolvedValue({ status: 'Failed', marked: true });

        await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(failSpy).toHaveBeenCalledWith('BATCH-CO-1', notRecorded.message, expect.anything(), expect.anything(), 'G00042');
    });

    it('marks a batch Failed when its dispatch throws, and carries on to the next company', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch').mockImplementation(async (companyId) => {
            if (companyId === 'CO-1') throw new serverEngine.AutoPostDispatchError(buildResult(companyId), new Error('ERP tenant unreachable'));
            return autoPosted(companyId);
        });
        const failSpy = vi.spyOn(serverEngine, 'recordDispatchFailure')
            .mockResolvedValue({ status: 'Failed', marked: true });

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(autoPostSpy).toHaveBeenCalledTimes(2); // CO-2 still ran
        expect(failSpy).toHaveBeenCalledWith('BATCH-CO-1', 'ERP tenant unreachable', expect.anything(), expect.anything(), null);
        expect(result.Success).toBe(false);
        expect(result.ResultCode).toBe('POST_INCOMPLETE');
        expect(result.Message).toContain('1 of 2 company(ies) did not post');
        expect(result.Message).toContain('ERP tenant unreachable');
    });

    // A throw can leave the batch in a state that cannot legally become Failed. Reporting the real
    // state matters most when the ERP already took the journal.
    it('reports a batch the ERP already accepted as Posted with a do-not-re-post warning', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        vi.spyOn(serverEngine, 'autoPostJournalEntryBatch')
            .mockRejectedValue(new serverEngine.AutoPostDispatchError(buildResult('CO-1'), new Error('JE Batched->GLPosted failed')));
        vi.spyOn(serverEngine, 'recordDispatchFailure').mockResolvedValue({ status: 'Posted', marked: false });

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.Success).toBe(false);
        expect(result.Message).toContain('DO NOT RE-POST');
        expect(result.Message).toContain('(Posted:');
        expect(result.Message).not.toContain('(Failed:');
    });

    it('reports a batch stuck in Approved as Approved rather than claiming it was marked Failed', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        vi.spyOn(serverEngine, 'autoPostJournalEntryBatch')
            .mockRejectedValue(new serverEngine.AutoPostDispatchError(buildResult('CO-1'), new Error('Approved->Sent save failed')));
        vi.spyOn(serverEngine, 'recordDispatchFailure').mockResolvedValue({ status: 'Approved', marked: false });

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.Success).toBe(false);
        expect(result.Message).toContain('(Approved:');
        expect(result.Message).toContain('NOT marked Failed');
    });

    // #184: a refused send means another dispatch holds the batch. Marking it Failed would put that
    // dispatch's in-flight batch on the retry list while its ERP call may still be running.
    it('never marks a batch Failed when its send was refused because another dispatch holds it', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        const refused = new serverEngine.JournalEntryBatchSendRefusedError('BATCH-CO-1', 'Sent', 'JournalEntryBatch send refused: the batch is already Sent.');
        vi.spyOn(serverEngine, 'autoPostJournalEntryBatch')
            .mockRejectedValue(new serverEngine.AutoPostDispatchError(buildResult('CO-1'), refused));
        const failSpy = vi.spyOn(serverEngine, 'recordDispatchFailure');

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(failSpy).not.toHaveBeenCalled();
        expect(result.Success).toBe(false);
        expect(result.Message).toContain('(Sent:');
        expect(result.Message).toContain('sent by another dispatch');
    });

    // ─── A build failure must not strand the companies already dispatched ────────────────

    it('AutoPost dispatches each company as it builds, so a later build failure strands nothing', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2', 'CO-3']);
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch').mockImplementation(async (companyId) => {
            // Before a batch exists the engine throws the build's own error, not an AutoPostDispatchError.
            if (companyId === 'CO-2') throw new Error('summary JE did not balance');
            return autoPosted(companyId);
        });
        const failSpy = vi.spyOn(serverEngine, 'recordDispatchFailure');

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        // CO-1 posted BEFORE CO-2 threw, and CO-3 still ran after it.
        expect(autoPostSpy.mock.calls.map(c => c[0])).toEqual(['CO-1', 'CO-2', 'CO-3']);
        expect(failSpy).not.toHaveBeenCalled(); // no batch to mark
        // The build failure is counted, so NotifyOnFailure fires rather than the run reporting clean.
        expect(result.Success).toBe(false);
        expect(result.ResultCode).toBe('POST_INCOMPLETE');
        expect(result.Message).toContain('1 of 3 company(ies) did not post');
        expect(result.Message).toContain('company CO-2 (BuildFailed: summary JE did not balance)');
    });

    it('AutoPost skips a company whose candidates net to zero', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        vi.spyOn(serverEngine, 'autoPostJournalEntryBatch').mockImplementation(async (companyId) => {
            if (companyId === 'CO-1') throw new serverEngine.EmptyJournalEntryBatchError('nets to zero');
            return autoPosted(companyId);
        });

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.Success).toBe(true);
        expect(result.Message).toContain('Built 1 batch(es)');
    });

    it('the attended path still aborts on a build failure, since those batches carry approval Tasks', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1', 'CO-2']);
        vi.spyOn(serverEngine, 'buildJournalEntryBatch').mockImplementation(async (companyId) => {
            if (companyId === 'CO-2') throw new Error('summary JE did not balance');
            return buildResult(companyId);
        });

        await expect(new BuildJournalEntryBatchesAction().Run(runParams([])))
            .rejects.toThrow(/summary JE did not balance/);
    });

    it('reports a poster that returns Failed without throwing', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        vi.spyOn(serverEngine, 'autoPostJournalEntryBatch').mockResolvedValue(autoPosted('CO-1', 'Failed', 'No active integration'));

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.ResultCode).toBe('POST_INCOMPLETE');
        expect(result.Message).toContain('No active integration');
    });

    it('an AutoPost run with nothing eligible posts nothing and errors on nothing', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch');

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.Success).toBe(true);
        expect(result.ResultCode).toBe('NO_BATCHES');
        expect(autoPostSpy).not.toHaveBeenCalled();
    });

    // ─── Auto-post is restricted to the MJ system user (#269) ────────────────────────────

    it('refuses AutoPost from any user but the system user, before any company is read', async () => {
        const pendingSpy = vi.spyOn(serverEngine, 'pendingCompanies');
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch');
        const params = runParams(AUTO_POST_INPUTS);
        params.ContextUser = { ID: 'SOME-OTHER-USER' } as never;

        await expect(new BuildJournalEntryBatchesAction().Run(params)).rejects.toThrow(/restricted to the MJ system user/);
        expect(pendingSpy).not.toHaveBeenCalled();
        expect(autoPostSpy).not.toHaveBeenCalled();
    });

    it('refuses AutoPost when the user cache does not hold the system user', async () => {
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue(undefined as never);
        const pendingSpy = vi.spyOn(serverEngine, 'pendingCompanies');

        await expect(new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS))).rejects.toThrow(/user cache does not hold it/);
        expect(pendingSpy).not.toHaveBeenCalled();
    });

    it('lets the system user auto-post', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch')
            .mockImplementation(async (companyId) => autoPosted(companyId));

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.Success).toBe(true);
        expect(autoPostSpy).toHaveBeenCalledWith('CO-1', 'BusinessCentral', expect.objectContaining({ ID: 'SYSTEM-USER' }), expect.anything(), expect.anything());
    });

    it('leaves an attended run by any user unrestricted: it builds behind the CFO approval gate', async () => {
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue(undefined as never);
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue(['CO-1']);
        const buildBatchSpy = vi.spyOn(serverEngine, 'buildJournalEntryBatch')
            .mockImplementation(async (companyId) => buildResult(companyId));
        const params = runParams([]);
        params.ContextUser = { ID: 'SOME-OTHER-USER' } as never;

        await new BuildJournalEntryBatchesAction().Run(params);

        expect(buildBatchSpy).toHaveBeenCalledTimes(1);
        expect(buildBatchSpy.mock.calls[0][5]).toBeInstanceOf(serverEngine.TasksAppApprovalGate);
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
    // #145: entries a Failed or partly-flipped Posted batch holds are invisible to the sweep, so every
    // run reports them — including one with nothing new to batch.
    it('reports stranded journal entries on every run, with the recovery each batch needs', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);
        vi.spyOn(serverEngine, 'findStrandedJournalEntries').mockResolvedValue([
            { batchId: 'B-1', batchNumber: 'JEB-1', batchStatus: 'Failed', journalEntryCount: 3, recovery: 'Retry' },
            { batchId: 'B-2', batchNumber: 'JEB-2', batchStatus: 'Posted', journalEntryCount: 1, recovery: 'ResumePosting' },
        ]);

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.ResultCode).toBe('NO_BATCHES');
        expect(result.Message).toContain('4 journal entries are stranded in 2 batch(es)');
        expect(result.Message).toContain('JEB-1 (Failed, 3 — confirm in the ERP that document JEB-1 has not posted before retrying the dispatch; if it has, do not retry)');
        expect(result.Message).toContain('JEB-2 (Posted, 1 — resume its GL posting)');
    });

    it('does not fail a run when the stranded-entry scan itself fails', async () => {
        vi.spyOn(serverEngine, 'pendingCompanies').mockResolvedValue([]);
        vi.spyOn(serverEngine, 'findStrandedJournalEntries').mockRejectedValue(new Error('scan timeout'));

        const result = await new BuildJournalEntryBatchesAction().Run(runParams(AUTO_POST_INPUTS));

        expect(result.Success).toBe(true);
        expect(result.Message).toContain('Could not count stranded journal entries: scan timeout');
    });
});

/**
 * The scheduled sweep selects companies through the engine's real `pendingCompanies`, so a
 * company's PostingStartDate must keep its pre-floor entries out of the nightly run. The provider
 * here answers the sweep's reads from memory; only the per-company build/dispatch is stubbed.
 */
describe('BuildJournalEntryBatchesAction — company posting start dates', () => {
    const CO_HISTORY_ONLY = 'aaaaaaaa-0000-0000-0000-000000000001';
    const CO_LIVE = 'bbbbbbbb-0000-0000-0000-000000000002';
    const SUMMARY_TYPE = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';
    const ORDER_TYPE = '684c06d4-55da-49d7-8453-e046fc82b895';
    const journals = [
        { ID: 'je-1', CompanyID: CO_HISTORY_ONLY, EffectiveDate: '2025-05-01', Status: 'Pending', EntryTypeID: ORDER_TYPE },
        { ID: 'je-2', CompanyID: CO_LIVE, EffectiveDate: '2025-05-01', Status: 'Pending', EntryTypeID: ORDER_TYPE },
        { ID: 'je-3', CompanyID: CO_LIVE, EffectiveDate: '2025-06-15', Status: 'Pending', EntryTypeID: ORDER_TYPE },
    ];

    /** Evaluates the engine's ExtraFilter subset (=, <>, >=, <, IN, AND, OR, NOT) over the rows. */
    const matches = (filter: string) => new Function('r', `return (${filter
        .replace(/\b(\w+) IN \(([^)]*)\)/g, '[$2].includes(r.$1)')
        .replace(/\b(\w+)\s*(<>|>=|<=|<|>|=)\s*'/g, (_m, col: string, op: string) => `r.${col} ${op === '=' ? '===' : op === '<>' ? '!==' : op} '`)
        .replace(/\bAND\b/g, '&&').replace(/\bOR\b/g, '||').replace(/\bNOT\b/g, '!')});`) as (row: object) => boolean;

    const sweepProvider = (floors: Array<{ ID: string; PostingStartDate: Date | null }>) => {
        const read = async (params: { EntityName?: string; ExtraFilter?: string }) => {
            if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Types') {
                return params.ExtraFilter === 'IsJournalEntryBatchSummary=1'
                    ? { Success: true, Results: [{ ID: SUMMARY_TYPE, Code: 'JournalEntryBatchSummary' }] }
                    : { Success: true, Results: [{ ID: ORDER_TYPE, Code: 'OrderBooking' }] };
            }
            if (params.EntityName === 'MJ_BizApps_Accounting: Accounting Company Profiles') {
                return { Success: true, Results: floors.filter(f => f.PostingStartDate !== null) };
            }
            if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entries') {
                return { Success: true, Results: journals.filter(matches(params.ExtraFilter ?? 'true')) };
            }
            return { Success: true, Results: [] };
        };
        return { Config: { ActiveStatusAssertions: false }, RunView: read, RunViews: (all: Array<{ EntityName?: string; ExtraFilter?: string }>) => Promise.all(all.map(read)) };
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(serverEngine, 'findStrandedJournalEntries').mockResolvedValue([]);
        // AutoPost is restricted to the MJ system user (#269); the sweep runs as it.
        vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue({ ID: 'SYSTEM-USER' } as UserInfo);
    });

    const autoPostedCompanies = async (floors: Array<{ ID: string; PostingStartDate: Date | null }>): Promise<string[]> => {
        Metadata.Provider = sweepProvider(floors) as never;
        const autoPostSpy = vi.spyOn(serverEngine, 'autoPostJournalEntryBatch').mockImplementation(async (companyId) => ({
            build: buildResult(companyId),
            batch: { ID: `BATCH-${companyId}`, Status: 'Posted', ErrorMessage: null } as never,
        }));
        await new BuildJournalEntryBatchesAction().Run(runParams([
            { Name: 'AutoPost', Value: true },
            { Name: 'Cutoff', Value: '2025-12-31' },
            { Name: 'EntryTypeCodes', Value: ['OrderBooking'] },
        ]));
        return autoPostSpy.mock.calls.map(c => c[0]).sort();
    };

    it('the nightly sweep skips a company whose only Pending entries predate its posting start date', async () => {
        const floor = new Date('2025-06-01T00:00:00.000Z');
        expect(await autoPostedCompanies([{ ID: CO_HISTORY_ONLY, PostingStartDate: floor }, { ID: CO_LIVE, PostingStartDate: floor }]))
            .toEqual([CO_LIVE]);
    });

    it('with no posting start date set, the sweep is unchanged', async () => {
        expect(await autoPostedCompanies([{ ID: CO_HISTORY_ONLY, PostingStartDate: null }])).toEqual([CO_HISTORY_ONLY, CO_LIVE]);
    });
});
