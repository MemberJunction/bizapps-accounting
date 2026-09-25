/**
 * #145 — the recovery paths for a batch that got past Approved and then failed.
 *
 *   · Retry:  sendJournalEntryBatch accepts a Failed batch, re-runs the gate and the coherence check,
 *             and takes the Failed → Sent edge LEGAL_TRANSITIONS already allowed. Its pre-flight ERP
 *             lookup (#182) decides whether the caller's confirmation that it has not posted is needed.
 *   · Resume: resumeJournalEntryBatchPosting finishes a Posted batch's Batched → GLPosted flip with
 *             no ERP call — re-sending a Posted batch would duplicate the ERP journal.
 *   · Visibility: findStrandedJournalEntries reports the entries each of those states holds.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataProvider, RunViewParams, UserInfo } from '@memberjunction/core';

vi.mock('../JournalEntryTypes.js', () => ({
    GetJournalEntryBatchSummaryEntryType: async () => ({ ID: 'aaaaaaaa-0000-0000-0000-00000000000a', Code: 'JournalEntryBatchSummary' }),
}));

import {
    findStrandedJournalEntries,
    resumeJournalEntryBatchPosting,
    sendJournalEntryBatch,
    type ErpJournalLookup,
    type ErpJournalLookupResult,
    type ErpPoster,
    type JournalEntryBatchApprovalGate,
} from '../JournalEntryBatchEngine.js';

const USER = { ID: 'USER-1' } as UserInfo;
const BATCH_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

interface JournalEntryRow { Status: string; JournalEntryBatchID: string; GLPostedAt: Date | null; GLReferenceID: string | null }

interface FakeBatch {
    ID: string;
    JournalEntryBatchNumber: string;
    Status: string;
    ErrorMessage: string | null;
    ExternalJournalEntryBatchRef: string | null;
    PostedAt: Date | null;
    SentAt: Date | null;
    SummaryJournalEntryID: string | null;
    LatestResult: { CompleteMessage: string } | null;
    statusHistory: string[];
    Load: (id: string) => Promise<boolean>;
    Save: () => Promise<boolean>;
    CheckControlTotalCoherence: () => Promise<string[]>;
}

/** An in-memory world: one batch, its member entries, and which entry saves should fail. */
function world(status: string, entries: Record<string, JournalEntryRow>, opts: { failingEntryIds?: string[]; missingEntryIds?: string[]; drift?: string[]; summaryLinesScanFails?: boolean; failFirstSaveAt?: string } = {}) {
    let saveFailed = false;
    const batch: FakeBatch = {
        ID: BATCH_ID,
        JournalEntryBatchNumber: 'JEB-0001',
        Status: status,
        ErrorMessage: status === 'Failed' ? 'ERP tenant unreachable' : null,
        ExternalJournalEntryBatchRef: status === 'Posted' ? 'ERP-REF-1' : null,
        PostedAt: status === 'Posted' ? new Date('2026-09-01T10:00:00Z') : null,
        SentAt: null,
        SummaryJournalEntryID: opts.summaryLinesScanFails ? 'cccccccc-0000-0000-0000-000000000001' : null,
        LatestResult: null,
        statusHistory: [],
        Load: async () => true,
        Save: vi.fn(async () => {
            if (opts.failFirstSaveAt === batch.Status && !saveFailed) { saveFailed = true; return false; }
            batch.statusHistory.push(batch.Status);
            return true;
        }),
        CheckControlTotalCoherence: async () => opts.drift ?? [],
    };

    const journalEntry = () => {
        const je = {
            ID: '',
            Status: '',
            GLPostedAt: null as Date | null,
            GLReferenceID: null as string | null,
            LatestResult: { CompleteMessage: 'lock trigger' },
            Load: async (id: string) => {
                if (opts.missingEntryIds?.includes(id)) return false;
                je.ID = id; Object.assign(je, entries[id]); return true;
            },
            Save: async () => {
                if (opts.failingEntryIds?.includes(je.ID)) return false;
                Object.assign(entries[je.ID], { Status: je.Status, GLPostedAt: je.GLPostedAt, GLReferenceID: je.GLReferenceID });
                return true;
            },
        };
        return je;
    };

    const batchedIds = () => Object.entries(entries).filter(([, e]) => e.Status === 'Batched').map(([id]) => ({ ID: id }));
    const provider = {
        GetEntityObject: async (name: string) => (name === BATCH_ENTITY ? batch : journalEntry()),
        RunView: async (params: RunViewParams) =>
            params.EntityName !== JE_ENTITY && opts.summaryLinesScanFails
                ? { Success: false, ErrorMessage: 'timeout', Results: [] }
                : { Success: true, Results: params.EntityName === JE_ENTITY ? batchedIds() : [] },
    } as unknown as IMetadataProvider;

    return { batch, entries, provider };
}

const batched = (): JournalEntryRow => ({ Status: 'Batched', JournalEntryBatchID: BATCH_ID, GLPostedAt: null, GLReferenceID: null });
const posted = (): JournalEntryRow => ({ Status: 'GLPosted', JournalEntryBatchID: BATCH_ID, GLPostedAt: new Date('2026-09-01T10:00:00Z'), GLReferenceID: 'ERP-REF-1' });

const approvedGate = (): JournalEntryBatchApprovalGate => ({ assertApproved: vi.fn(async () => undefined) });
const acceptingPoster = (): ErpPoster => vi.fn(async () => ({ success: true, externalJournalEntryBatchRef: 'ERP-REF-2' }));

describe('sendJournalEntryBatch — retrying a Failed batch', () => {
    it('takes a Failed batch through Sent to Posted and flips every member entry', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched(), 'je-2': batched() });
        const gate = approvedGate();

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate, poster: acceptingPoster(), provider, confirmNotAlreadyPostedInERP: true });

        expect(result.Status).toBe('Posted');
        expect(batch.statusHistory).toEqual(['Sent', 'Posted']);
        expect(Object.values(entries).map(e => e.Status)).toEqual(['GLPosted', 'GLPosted']);
        expect(entries['je-1'].GLReferenceID).toBe('ERP-REF-2');
    });

    // The retry reuses the original approval, but it still has to BE approved.
    it('re-asserts the approval gate on a retry', async () => {
        const { provider } = world('Failed', { 'je-1': batched() });
        const gate = approvedGate();

        await sendJournalEntryBatch(BATCH_ID, USER, { gate, poster: acceptingPoster(), provider, confirmNotAlreadyPostedInERP: true });

        expect(gate.assertApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    });

    it('clears the earlier attempt\'s ErrorMessage once the retry posts', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });

        await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster: acceptingPoster(), provider, confirmNotAlreadyPostedInERP: true });

        expect(batch.ErrorMessage).toBeNull();
    });

    it('records the new failure and leaves the entries Batched when the retry fails too', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched() });
        const poster: ErpPoster = async () => ({ success: false, error: 'still down' });

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true });

        expect(result.Status).toBe('Failed');
        expect(batch.ErrorMessage).toBe('still down');
        expect(entries['je-1'].Status).toBe('Batched');
    });

    // Member-set / footing drift is caught on a retry. This is self-consistency only: fields the
    // check does not read, such as PostingDate, are not covered (#183).
    it('refuses a retry whose content no longer matches what was approved, without calling the ERP', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { drift: ['Member set changed.'] });
        const poster = acceptingPoster();

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true }))
            .rejects.toThrow(/no longer matches its approved content/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    // Failed does not prove the ERP rejected the journal, so with no ERP lookup a retry needs the operator's ERP check.
    it.each([undefined, false])('refuses a retry without the ERP confirmation (%s), without calling the ERP', async (confirm) => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: confirm }))
            .rejects.toThrow(/Confirm in the ERP that document JEB-0001 has not posted/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
        expect(batch.Save).not.toHaveBeenCalled();
    });

    // An empty result would send the ERP an empty journal.
    // Loaded before the →Sent save, so the batch is not left stranded at Sent.
    it('throws when the summary lines fail to load, without calling the ERP or leaving Failed', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { summaryLinesScanFails: true });
        const poster = acceptingPoster();

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true }))
            .rejects.toThrow(/summary JE lines for batch .* failed to load: timeout/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Save).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    // A throwing poster would otherwise leave the batch at Sent, which no operator action can leave.
    it('marks the batch Failed with the cause when the poster throws', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched() });
        const poster: ErpPoster = async () => { throw new Error('beforePost extension failed'); };

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true });

        expect(result.Status).toBe('Failed');
        expect(batch.statusHistory).toEqual(['Sent', 'Failed']);
        expect(batch.ErrorMessage).toBe('beforePost extension failed');
        expect(entries['je-1'].Status).toBe('Batched');
    });

    it.each(['Pending', 'Sent', 'Posted', 'Archived', 'Cancelled'])('refuses to send a %s batch', async (status) => {
        const { provider } = world(status, { 'je-1': batched() });
        const poster = acceptingPoster();

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, provider }))
            .rejects.toThrow(/only an Approved batch can be sent or a Failed batch retried/);
        expect(poster).not.toHaveBeenCalled();
    });
});

describe('sendJournalEntryBatch — sending an Approved batch', () => {
    // With no ERP lookup, the confirmation applies to a Failed retry only; a first send cannot already be in the ERP.
    it('sends an Approved batch without the ERP confirmation', async () => {
        const { batch, entries, provider } = world('Approved', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, provider });

        expect(result.Status).toBe('Posted');
        expect(poster).toHaveBeenCalledOnce();
        expect(batch.statusHistory).toEqual(['Sent', 'Posted']);
        expect(entries['je-1'].Status).toBe('GLPosted');
    });
});

describe('sendJournalEntryBatch — the pre-flight ERP lookup (#182)', () => {
    const lookupReturning = (result: ErpJournalLookupResult): ErpJournalLookup => vi.fn(async () => result);
    const found = (): ErpJournalLookup => lookupReturning({ status: 'Found', externalJournalEntryBatchRef: 'JEB-0001' });

    it.each(['Approved', 'Failed'])('records a %s batch the ERP already holds as Posted, without posting it again', async (status) => {
        const { batch, entries, provider } = world(status, { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: found(), provider });

        expect(poster).not.toHaveBeenCalled();
        expect(result.Status).toBe('Posted');
        expect(batch.statusHistory).toEqual(['Sent', 'Posted']);
        expect(batch.ExternalJournalEntryBatchRef).toBe('JEB-0001');
        expect(batch.ErrorMessage).toBeNull();
        expect(entries['je-1']).toMatchObject({ Status: 'GLPosted', GLReferenceID: 'JEB-0001' });
    });

    // The operator's confirmation is an override for a lookup that cannot answer, not for one that did.
    it('records a matching posting as Posted even when the operator confirmed it had not posted', async () => {
        const { provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: found(), provider, confirmNotAlreadyPostedInERP: true });

        expect(poster).not.toHaveBeenCalled();
        expect(result.Status).toBe('Posted');
    });

    it('retries a Failed batch without the confirmation once the ERP says nothing posted', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: lookupReturning({ status: 'NotFound' }), provider });

        expect(poster).toHaveBeenCalledOnce();
        expect(result.Status).toBe('Posted');
        expect(batch.ExternalJournalEntryBatchRef).toBe('ERP-REF-2');
    });

    it.each<[string, ErpJournalLookupResult, RegExp]>([
        ['a posting that differs', { status: 'Mismatch', detail: 'it posted on 2026-08-31.' }, /already holds document JEB-0001, and it does not match this batch: it posted on 2026-08-31/],
        ['a lookup that failed', { status: 'Error', error: 'BC 503.' }, /could not check the ERP for document JEB-0001 before sending: BC 503/],
    ])('refuses a Failed retry on %s, leaving it Failed and the ERP untouched', async (_case, preflight, message) => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: lookupReturning(preflight), provider }))
            .rejects.toThrow(message);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Save).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    // Left at Approved it would hold its entries where no stranded-batch scan looks.
    it.each<[string, ErpJournalLookupResult]>([
        ['a posting that differs', { status: 'Mismatch', detail: 'it posted on 2026-08-31.' }],
        ['a lookup that failed', { status: 'Error', error: 'BC 503.' }],
    ])('marks a first send Failed with the reason on %s, without posting', async (_case, preflight) => {
        const { batch, entries, provider } = world('Approved', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: lookupReturning(preflight), provider });

        expect(poster).not.toHaveBeenCalled();
        expect(result.Status).toBe('Failed');
        expect(batch.statusHistory).toEqual(['Sent', 'Failed']);
        expect(batch.ErrorMessage).toMatch(/document JEB-0001/);
        expect(entries['je-1'].Status).toBe('Batched');
    });

    it.each<[string, ErpJournalLookupResult]>([
        ['a posting that differs', { status: 'Mismatch', detail: 'it posted on 2026-08-31.' }],
        ['a lookup that failed', { status: 'Error', error: 'BC 503.' }],
    ])('posts on %s when the operator confirmed the batch has not posted', async (_case, preflight) => {
        const { provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: lookupReturning(preflight), provider, confirmNotAlreadyPostedInERP: true });

        expect(poster).toHaveBeenCalledOnce();
        expect(result.Status).toBe('Posted');
    });

    it('treats a lookup that throws as a failed lookup', async () => {
        const { provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();
        const lookup: ErpJournalLookup = async () => { throw new Error('socket hang up'); };

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup, provider }))
            .rejects.toThrow(/could not check the ERP .*socket hang up/);
        expect(poster).not.toHaveBeenCalled();
    });

    it('runs the lookup only after the gate and the coherence check pass', async () => {
        const { provider } = world('Approved', { 'je-1': batched() }, { drift: ['Member set changed.'] });
        const lookup = found();

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster: acceptingPoster(), lookup, provider }))
            .rejects.toThrow(/no longer matches its approved content/);
        expect(lookup).not.toHaveBeenCalled();
    });

    // The issue's path: the ERP accepts, the Sent→Posted save fails, triage records Failed, an operator
    // retries. The retry must find the posting instead of sending the journal a second time.
    it('recovers a batch whose Sent→Posted save failed after the ERP accepted it, with one post in total', async () => {
        const { batch, entries, provider } = world('Approved', { 'je-1': batched() }, { failFirstSaveAt: 'Posted' });
        const poster = acceptingPoster();

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: lookupReturning({ status: 'NotFound' }), provider }))
            .rejects.toThrow(/Sent→Posted failed/);
        // What recordDispatchFailure writes for a batch the database still holds at Sent.
        batch.Status = 'Failed';

        const result = await sendJournalEntryBatch(BATCH_ID, USER, { gate: approvedGate(), poster, lookup: lookupReturning({ status: 'Found', externalJournalEntryBatchRef: 'ERP-REF-2' }), provider });

        expect(poster).toHaveBeenCalledOnce();
        expect(result.Status).toBe('Posted');
        expect(entries['je-1']).toMatchObject({ Status: 'GLPosted', GLReferenceID: 'ERP-REF-2' });
    });
});

describe('resumeJournalEntryBatchPosting', () => {
    it('finishes a partial flip, stamping the batch\'s own posting time and ERP reference', async () => {
        const { batch, entries, provider } = world('Posted', { 'je-1': posted(), 'je-2': batched(), 'je-3': batched() });

        const result = await resumeJournalEntryBatchPosting(BATCH_ID, USER, provider);

        expect(result.journalEntriesPosted).toBe(2);
        expect(Object.values(entries).every(e => e.Status === 'GLPosted')).toBe(true);
        expect(entries['je-2'].GLReferenceID).toBe('ERP-REF-1');
        expect(entries['je-2'].GLPostedAt).toEqual(batch.PostedAt);
        expect(batch.Save).not.toHaveBeenCalled();
    });

    it('is a no-op on a Posted batch whose flip already completed', async () => {
        const { provider } = world('Posted', { 'je-1': posted() });

        const result = await resumeJournalEntryBatchPosting(BATCH_ID, USER, provider);

        expect(result.journalEntriesPosted).toBe(0);
    });

    it('stops loudly on an entry that still will not save, leaving the rest for the next resume', async () => {
        const { entries, provider } = world('Posted', { 'je-1': batched(), 'je-2': batched() }, { failingEntryIds: ['je-1'] });

        await expect(resumeJournalEntryBatchPosting(BATCH_ID, USER, provider)).rejects.toThrow(/JE je-1 Batched→GLPosted failed: lock trigger/);
        expect(entries['je-1'].Status).toBe('Batched');
    });

    // A failed Load leaves a new record, and saving it would attempt a CREATE.
    it('stops loudly on an entry that will not load instead of saving a new record', async () => {
        const { entries, provider } = world('Posted', { 'je-1': batched() }, { missingEntryIds: ['je-1'] });

        await expect(resumeJournalEntryBatchPosting(BATCH_ID, USER, provider)).rejects.toThrow(/JE je-1 not found/);
        expect(entries['je-1'].Status).toBe('Batched');
    });

    it('points a Failed batch at retry instead', async () => {
        const { provider } = world('Failed', { 'je-1': batched() });

        await expect(resumeJournalEntryBatchPosting(BATCH_ID, USER, provider)).rejects.toThrow(/Failed batch is retried by dispatching it again/);
    });

    it.each(['Pending', 'Approved', 'Sent', 'Archived'])('refuses a %s batch', async (status) => {
        const { entries, provider } = world(status, { 'je-1': batched() });

        await expect(resumeJournalEntryBatchPosting(BATCH_ID, USER, provider)).rejects.toThrow(/only a Posted batch/);
        expect(entries['je-1'].Status).toBe('Batched');
    });
});

describe('findStrandedJournalEntries', () => {
    const row = (batchId: string, number: string) => ({ JournalEntryBatchID: batchId, JournalEntryBatch: number });

    const providerReturning = (failed: ReturnType<typeof row>[], postedRows: ReturnType<typeof row>[], captured: RunViewParams[] = []) =>
        ({
            RunViews: async (params: RunViewParams[]) => {
                captured.push(...params);
                return [{ Success: true, Results: failed }, { Success: true, Results: postedRows }];
            },
        }) as unknown as IMetadataProvider;

    it('counts stranded member entries per batch, with the recovery each state needs', async () => {
        const provider = providerReturning(
            [row('batch-f1', 'JEB-1'), row('batch-f1', 'JEB-1'), row('batch-f2', 'JEB-2')],
            [row('batch-p1', 'JEB-3')],
        );

        const result = await findStrandedJournalEntries(USER, provider);

        expect(result).toEqual([
            { batchId: 'batch-f1', batchNumber: 'JEB-1', journalEntryCount: 2, batchStatus: 'Failed', recovery: 'Retry' },
            { batchId: 'batch-f2', batchNumber: 'JEB-2', journalEntryCount: 1, batchStatus: 'Failed', recovery: 'Retry' },
            { batchId: 'batch-p1', batchNumber: 'JEB-3', journalEntryCount: 1, batchStatus: 'Posted', recovery: 'ResumePosting' },
        ]);
    });

    it('scans only Batched members of Failed and Posted batches — not the summary entry, not Archived', async () => {
        const captured: RunViewParams[] = [];

        await findStrandedJournalEntries(USER, providerReturning([], [], captured));

        expect(captured.map(p => p.ExtraFilter)).toEqual([
            expect.stringMatching(/^Status='Batched' AND EntryTypeID<>'aaaaaaaa-0000-0000-0000-00000000000a' AND .*WHERE Status='Failed'\)$/),
            expect.stringMatching(/WHERE Status='Posted'\)$/),
        ]);
    });

    it('throws when a scan fails rather than reporting nothing stranded', async () => {
        const provider = {
            RunViews: async () => [{ Success: false, ErrorMessage: 'timeout' }, { Success: true, Results: [] }],
        } as unknown as IMetadataProvider;

        await expect(findStrandedJournalEntries(USER, provider)).rejects.toThrow(/Failed scan failed: timeout/);
    });
});
