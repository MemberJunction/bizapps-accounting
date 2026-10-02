/**
 * #145 — the recovery paths for a batch that got past Approved and then failed.
 *
 *   The engine resolves its gate, poster and lookup through JournalEntryBatchDispatchServices (#233);
 *   `send` below registers each test's in a higher-priority fake rather than passing them.
 *
 *   · Retry:  sendJournalEntryBatch accepts a Failed batch, re-runs the gate and the coherence check,
 *             and takes the Failed → Sent edge LEGAL_TRANSITIONS already allowed. Its pre-flight ERP
 *             lookup (#182) decides whether the caller's confirmation that it has not posted is needed.
 *   · Resume: resumeJournalEntryBatchPosting finishes a Posted batch's Batched → GLPosted flip with
 *             no ERP call — re-sending a Posted batch would duplicate the ERP journal.
 *   · Visibility: findStrandedJournalEntries reports the entries each of those states holds.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import type { IMetadataProvider, RunViewParams, UserInfo } from '@memberjunction/core';

vi.mock('../JournalEntryTypes.js', () => ({
    GetJournalEntryBatchSummaryEntryType: async () => ({ ID: 'aaaaaaaa-0000-0000-0000-00000000000a', Code: 'JournalEntryBatchSummary' }),
}));

import {
    assertAutoPostPolicy,
    autoPostJournalEntryBatch,
    findStrandedJournalEntries,
    mockErpPoster,
    resumeJournalEntryBatchPosting,
    sendJournalEntryBatch,
    unavailableErpLookup,
    AutoPostDispatchError,
    JournalEntryBatchSendRefusedError,
    type ErpJournalLookup,
    type ErpJournalLookupResult,
    type ErpPoster,
    type JournalEntryBatchApprovalGate,
} from '../JournalEntryBatchEngine.js';
import { JournalEntryBatchDispatchServices } from '../JournalEntryBatchDispatchServices.js';

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
    SealMismatchDetectedAt: Date | null;
    SummaryJournalEntryID: string | null;
    LatestResult: { CompleteMessage: string } | null;
    statusHistory: string[];
    Load: (id: string) => Promise<boolean>;
    Save: () => Promise<boolean>;
    CheckApprovedContent: () => Promise<{ CoherenceProblems: string[]; SealProblems: string[] }>;
}

/** What the database holds for the batch: the columns the SealMismatchDetectedAt rule reads. */
interface StoredBatch { Status: string; SendAttemptCount: number; SealMismatchDetectedAt: Date | null }

/**
 * trg_JournalEntryBatch_Immutability's SealMismatchDetectedAt rule (50034, #216): set only by the save
 * that records a retried batch Posted (Sent -> Posted, SendAttemptCount above 1), never changed or
 * cleared after. The fake's Save applies it, so every test here also shows the engine never writes the
 * flag where the database would refuse it.
 */
function sealFlagRefusal(before: StoredBatch, after: StoredBatch): string | null {
    const was = before.SealMismatchDetectedAt;
    const now = after.SealMismatchDetectedAt;
    const changed = was !== null && (now === null || Math.abs(now.getTime() - was.getTime()) >= 1);
    const setOutsideAdoption = was === null && now !== null
        && !(before.Status === 'Sent' && after.Status === 'Posted' && after.SendAttemptCount > 1);
    return changed || setOutsideAdoption ? 'JournalEntryBatch SealMismatchDetectedAt refused.' : null;
}

/** An in-memory world: one batch, its member entries, and which entry saves should fail. */
function world(status: string, entries: Record<string, JournalEntryRow>, opts: { failingEntryIds?: string[]; missingEntryIds?: string[]; drift?: string[]; sealDrift?: string[]; summaryLinesScanFails?: boolean; failFirstSaveAt?: string; sentSaveMessage?: string; currentStatus?: string } = {}) {
    let saveFailed = false;
    // Every batch past Approved was sent at least once (Posted and Failed are reachable only from Sent).
    const stored: StoredBatch = { Status: status, SendAttemptCount: status === 'Approved' || status === 'Pending' ? 0 : 1, SealMismatchDetectedAt: null };
    const batch: FakeBatch = {
        ID: BATCH_ID,
        JournalEntryBatchNumber: 'JEB-0001',
        Status: status,
        ErrorMessage: status === 'Failed' ? 'ERP tenant unreachable' : null,
        ExternalJournalEntryBatchRef: status === 'Posted' ? 'ERP-REF-1' : null,
        PostedAt: status === 'Posted' ? new Date('2026-09-01T10:00:00Z') : null,
        SentAt: null,
        SealMismatchDetectedAt: null,
        SummaryJournalEntryID: opts.summaryLinesScanFails ? 'cccccccc-0000-0000-0000-000000000001' : null,
        LatestResult: null,
        statusHistory: [],
        Load: async () => true,
        Save: vi.fn(async () => {
            if (opts.failFirstSaveAt === batch.Status && !saveFailed) { saveFailed = true; return false; }
            if (opts.sentSaveMessage && batch.Status === 'Sent') { batch.LatestResult = { CompleteMessage: opts.sentSaveMessage }; return false; }
            // The entity stamps SendAttemptCount on every move into Sent.
            const sendAttemptCount = batch.Status === 'Sent' && stored.Status !== 'Sent' ? stored.SendAttemptCount + 1 : stored.SendAttemptCount;
            const next: StoredBatch = { Status: batch.Status, SendAttemptCount: sendAttemptCount, SealMismatchDetectedAt: batch.SealMismatchDetectedAt };
            const refusal = sealFlagRefusal(stored, next);
            if (refusal) { batch.LatestResult = { CompleteMessage: refusal }; return false; }
            Object.assign(stored, next);
            batch.statusHistory.push(batch.Status);
            return true;
        }),
        CheckApprovedContent: async () => ({ CoherenceProblems: opts.drift ?? [], SealProblems: opts.sealDrift ?? [] }),
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
            params.EntityName === BATCH_ENTITY
                ? { Success: true, Results: opts.currentStatus ? [{ Status: opts.currentStatus }] : [] }
                : params.EntityName !== JE_ENTITY && opts.summaryLinesScanFails
                ? { Success: false, ErrorMessage: 'timeout', Results: [] }
                : { Success: true, Results: params.EntityName === JE_ENTITY ? batchedIds() : [] },
    } as unknown as IMetadataProvider;

    return { batch, entries, provider, stored };
}

const batched = (): JournalEntryRow => ({ Status: 'Batched', JournalEntryBatchID: BATCH_ID, GLPostedAt: null, GLReferenceID: null });
const posted = (): JournalEntryRow => ({ Status: 'GLPosted', JournalEntryBatchID: BATCH_ID, GLPostedAt: new Date('2026-09-01T10:00:00Z'), GLReferenceID: 'ERP-REF-1' });

const approvedGate = (): JournalEntryBatchApprovalGate => ({ assertApproved: vi.fn(async () => undefined) });
const acceptingPoster = (): ErpPoster => vi.fn(async () => ({ success: true, externalJournalEntryBatchRef: 'ERP-REF-2' }));

/** What the registered fake hands the engine for the current send. Unset outside one. */
let registered: { gate: JournalEntryBatchApprovalGate; poster: ErpPoster; lookup: ErpJournalLookup } | null = null;

class FakeDispatchServices extends JournalEntryBatchDispatchServices {
    private get current() {
        if (!registered) throw new Error('FakeDispatchServices: nothing set up for this test');
        return registered;
    }
    public override CreateApprovalGate(): JournalEntryBatchApprovalGate { return this.current.gate; }
    public override CreatePoster(): ErpPoster { return this.current.poster; }
    public override CreateLookup(): ErpJournalLookup { return this.current.lookup; }
}

beforeAll(() => {
    MJGlobal.Instance.ClassFactory.Register(JournalEntryBatchDispatchServices, FakeDispatchServices, null, 1000, true);
});
afterEach(() => { registered = null; });

/**
 * Send BATCH_ID with this gate, poster and lookup registered. The defaults are an approved batch,
 * a poster that accepts it, and an ERP that offers no lookup.
 */
function send(o: { gate?: JournalEntryBatchApprovalGate; poster?: ErpPoster; lookup?: ErpJournalLookup; provider: IMetadataProvider; confirmNotAlreadyPostedInERP?: boolean }) {
    registered = { gate: o.gate ?? approvedGate(), poster: o.poster ?? mockErpPoster, lookup: o.lookup ?? unavailableErpLookup };
    return sendJournalEntryBatch(BATCH_ID, USER, { provider: o.provider, confirmNotAlreadyPostedInERP: o.confirmNotAlreadyPostedInERP });
}

describe('sendJournalEntryBatch — the engine resolves its own gate, poster and lookup (#233)', () => {
    it('refuses when the resolved gate does, whatever the caller passes', async () => {
        const { batch, provider } = world('Approved', { 'je-1': batched() });
        const poster = acceptingPoster();
        registered = { gate: { assertApproved: vi.fn(async () => { throw new Error('is not approved'); }) }, poster, lookup: unavailableErpLookup };
        const permissive: JournalEntryBatchApprovalGate = { assertApproved: vi.fn(async () => undefined) };

        await expect(sendJournalEntryBatch(BATCH_ID, USER, { provider, gate: permissive, poster: acceptingPoster() } as never))
            .rejects.toThrow(/is not approved/);
        expect(permissive.assertApproved).not.toHaveBeenCalled();
        expect(poster).not.toHaveBeenCalled();
        expect(batch.statusHistory).toEqual([]);
    });

    it('posts through the resolved poster', async () => {
        const { provider } = world('Approved', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await send({ poster, provider });

        expect(poster).toHaveBeenCalledTimes(1);
        expect(result.Status).toBe('Posted');
    });

    it('resolves the tasks-backed gate and the AccountingERPEngine poster when nothing replaced them', async () => {
        const { TasksAppApprovalGate } = await import('../TasksAppApprovalGate.js');
        const real = new JournalEntryBatchDispatchServices();
        const provider = {} as IMetadataProvider;
        expect(real.CreateApprovalGate(provider)).toBeInstanceOf(TasksAppApprovalGate);
        expect(typeof real.CreatePoster(provider)).toBe('function');
    });
});

describe('autoPostJournalEntryBatch — the scheduled-posting waiver refuses before building', () => {
    it.each([
        [{}, /requires an explicit EntryTypeCodes include-list/],
        [{ entryTypeCodes: [] }, /requires an explicit EntryTypeCodes include-list/],
        [{ entryTypeCodes: ['OrderBooking'], excludeEntryTypeCodes: ['Refund'] }, /does not accept ExcludeEntryTypeCodes/],
    ])('refuses %j', async (options, message) => {
        expect(() => assertAutoPostPolicy(options)).toThrow(message);
        const getEntityObject = vi.fn();
        const provider = { GetEntityObject: getEntityObject, RunView: vi.fn() } as unknown as IMetadataProvider;
        await expect(autoPostJournalEntryBatch('CO-1', 'BusinessCentral', USER, provider, options)).rejects.toThrow(message);
        expect(getEntityObject).not.toHaveBeenCalled();
    });

    // No batch exists yet, so the error is the build's own, not an AutoPostDispatchError.
    it('throws the build\'s own error, unwrapped, when the build fails', async () => {
        const provider = { GetEntityObject: vi.fn(), RunView: async () => ({ Success: true, Results: [] }) } as unknown as IMetadataProvider;
        const error = await autoPostJournalEntryBatch('11111111-0000-4000-8000-000000000001', 'BusinessCentral', USER, provider, { entryTypeCodes: ['OrderBooking'] })
            .then(() => null, (e: unknown) => e);
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(AutoPostDispatchError);
        expect((error as Error).message).toMatch(/^buildJournalEntryBatch: /);
    });
});

describe('sendJournalEntryBatch — retrying a Failed batch', () => {
    it('takes a Failed batch through Sent to Posted and flips every member entry', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched(), 'je-2': batched() });
        const gate = approvedGate();

        const result = await send({ gate, poster: acceptingPoster(), provider, confirmNotAlreadyPostedInERP: true });

        expect(result.Status).toBe('Posted');
        expect(batch.statusHistory).toEqual(['Sent', 'Posted']);
        expect(Object.values(entries).map(e => e.Status)).toEqual(['GLPosted', 'GLPosted']);
        expect(entries['je-1'].GLReferenceID).toBe('ERP-REF-2');
    });

    // The retry reuses the original approval, but it still has to BE approved.
    it('re-asserts the approval gate on a retry', async () => {
        const { provider } = world('Failed', { 'je-1': batched() });
        const gate = approvedGate();

        await send({ gate, poster: acceptingPoster(), provider, confirmNotAlreadyPostedInERP: true });

        expect(gate.assertApproved).toHaveBeenCalledWith(BATCH_ID, USER);
    });

    it('clears the earlier attempt\'s ErrorMessage once the retry posts', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });

        await send({ gate: approvedGate(), poster: acceptingPoster(), provider, confirmNotAlreadyPostedInERP: true });

        expect(batch.ErrorMessage).toBeNull();
    });

    it('records the new failure and leaves the entries Batched when the retry fails too', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched() });
        const poster: ErpPoster = async () => ({ success: false, error: 'still down' });

        const result = await send({ gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true });

        expect(result.Status).toBe('Failed');
        expect(batch.ErrorMessage).toBe('still down');
        expect(entries['je-1'].Status).toBe('Batched');
    });

    // Drift from the approved content is caught on a retry — footing, member set and summary header
    // refuse it before the ERP lookup; the approved-content seal (#183) is judged after it (#216).
    it('refuses a retry whose content no longer matches what was approved, without calling the ERP', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { drift: ['Member set changed.'] });
        const poster = acceptingPoster();

        await expect(send({ gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true }))
            .rejects.toThrow(/no longer matches its approved content/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    // Failed does not prove the ERP rejected the journal, so with no ERP lookup a retry needs the operator's ERP check.
    it.each([undefined, false])('refuses a retry without the ERP confirmation (%s), without calling the ERP', async (confirm) => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        await expect(send({ gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: confirm }))
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

        await expect(send({ gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true }))
            .rejects.toThrow(/summary JE lines for batch .* failed to load: timeout/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Save).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    // A throwing poster would otherwise leave the batch at Sent, which no operator action can leave.
    it('marks the batch Failed with the cause when the poster throws', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched() });
        const poster: ErpPoster = async () => { throw new Error('beforePost extension failed'); };

        const result = await send({ gate: approvedGate(), poster, provider, confirmNotAlreadyPostedInERP: true });

        expect(result.Status).toBe('Failed');
        expect(batch.statusHistory).toEqual(['Sent', 'Failed']);
        expect(batch.ErrorMessage).toBe('beforePost extension failed');
        expect(entries['je-1'].Status).toBe('Batched');
    });

    it.each(['Pending', 'Sent', 'Posted', 'Archived', 'Cancelled'])('refuses to send a %s batch', async (status) => {
        const { provider } = world(status, { 'je-1': batched() });
        const poster = acceptingPoster();

        await expect(send({ gate: approvedGate(), poster, provider }))
            .rejects.toThrow(/only an Approved batch can be sent or a Failed batch retried/);
        expect(poster).not.toHaveBeenCalled();
    });
});

// #184: trg_JournalEntryBatch_SendOnce refuses the →Sent save of a send that lost a race.
describe('sendJournalEntryBatch — a send refused because another dispatch sent the batch first', () => {
    const refusal = 'Error executing SQL: JournalEntryBatch send refused: the batch is already Sent.';

    it.each(['Sent', 'Posted'])('throws JournalEntryBatchSendRefusedError naming the status the batch reads now (%s), without calling the ERP', async (now) => {
        const { provider } = world('Failed', { 'je-1': batched() }, { sentSaveMessage: refusal, currentStatus: now });
        const poster = acceptingPoster();

        const sent = send({ poster, provider, confirmNotAlreadyPostedInERP: true });

        await expect(sent).rejects.toBeInstanceOf(JournalEntryBatchSendRefusedError);
        await expect(sent).rejects.toMatchObject({ JournalEntryBatchID: BATCH_ID, Status: now });
        expect(poster).not.toHaveBeenCalled();
    });

    it('keeps any other →Sent save failure a plain error', async () => {
        const { provider } = world('Approved', { 'je-1': batched() }, { sentSaveMessage: 'deadlock victim', currentStatus: 'Approved' });

        const sent = send({ poster: acceptingPoster(), provider });

        await expect(sent).rejects.toThrow(/Approved→Sent failed: deadlock victim/);
        await expect(sent).rejects.not.toBeInstanceOf(JournalEntryBatchSendRefusedError);
    });
});

describe('sendJournalEntryBatch — sending an Approved batch', () => {
    // With no ERP lookup, the confirmation applies to a Failed retry only; a first send cannot already be in the ERP.
    it('sends an Approved batch without the ERP confirmation', async () => {
        const { batch, entries, provider } = world('Approved', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await send({ gate: approvedGate(), poster, provider });

        expect(result.Status).toBe('Posted');
        expect(poster).toHaveBeenCalledOnce();
        expect(batch.statusHistory).toEqual(['Sent', 'Posted']);
        expect(entries['je-1'].Status).toBe('GLPosted');
    });
});

describe('sendJournalEntryBatch — the pre-flight ERP lookup (#182)', () => {
    const lookupReturning = (result: ErpJournalLookupResult): ErpJournalLookup => vi.fn(async () => result);
    const found = (): ErpJournalLookup => lookupReturning({ status: 'Found', externalJournalEntryBatchRef: 'JEB-0001' });

    it('records a Failed batch the ERP already holds as Posted, without posting it again', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await send({ gate: approvedGate(), poster, lookup: found(), provider });

        expect(poster).not.toHaveBeenCalled();
        expect(result.Status).toBe('Posted');
        expect(batch.statusHistory).toEqual(['Sent', 'Posted']);
        expect(batch.ExternalJournalEntryBatchRef).toBe('JEB-0001');
        expect(batch.ErrorMessage).toBeNull();
        expect(entries['je-1']).toMatchObject({ Status: 'GLPosted', GLReferenceID: 'JEB-0001' });
    });

    // A batch this database never sent cannot have posted from here: the database was copied from one
    // that sent it. Marking it Failed would let its retry adopt that journal, so it stays Approved.
    it.each([undefined, true])('refuses a first send whose number the ERP already holds, leaving it Approved (confirmation: %s)', async (confirm) => {
        const { batch, entries, provider } = world('Approved', { 'je-1': batched() });
        const poster = acceptingPoster();

        await expect(send({ gate: approvedGate(), poster, lookup: found(), provider, confirmNotAlreadyPostedInERP: confirm }))
            .rejects.toThrow(/already holds a posting under document JEB-0001 \(JEB-0001\) that carries this batch's token and matches it, but this batch has never been sent/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Save).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Approved');
        expect(entries['je-1'].Status).toBe('Batched');
    });

    // #206: another environment's journal under the same number. Recording it Posted would lose this
    // batch; sending it would put two journals under one document number.
    it.each<[string, string | undefined, RegExp]>([
        ['Failed', undefined, /stays Failed\. Cancel it from Dispatch status/],
        ['Failed', 'confirmed', /stays Failed\. Cancel it from Dispatch status/],
        ['Approved', undefined, /stays Approved\. Archive it from Batch approvals/],
    ])('refuses a %s batch whose number holds another batch\'s journal, with no override (%s)', async (status, confirm, wayOut) => {
        const { batch, entries, provider } = world(status, { 'je-1': batched() });
        const poster = acceptingPoster();
        const lookup = lookupReturning({ status: 'Foreign', detail: 'its lines carry the token of batch other-batch.' });

        await expect(send({ gate: approvedGate(), poster, lookup, provider, confirmNotAlreadyPostedInERP: confirm === 'confirmed' }))
            .rejects.toThrow(wayOut);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Save).not.toHaveBeenCalled();
        expect(batch.Status).toBe(status);
        expect(entries['je-1'].Status).toBe('Batched');
    });

    // The operator's confirmation is an override for a lookup that cannot answer, not for one that did.
    it('records a matching posting as Posted even when the operator confirmed it had not posted', async () => {
        const { provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await send({ gate: approvedGate(), poster, lookup: found(), provider, confirmNotAlreadyPostedInERP: true });

        expect(poster).not.toHaveBeenCalled();
        expect(result.Status).toBe('Posted');
    });

    it('retries a Failed batch without the confirmation once the ERP says nothing posted', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await send({ gate: approvedGate(), poster, lookup: lookupReturning({ status: 'NotFound' }), provider });

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

        await expect(send({ gate: approvedGate(), poster, lookup: lookupReturning(preflight), provider }))
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

        const result = await send({ gate: approvedGate(), poster, lookup: lookupReturning(preflight), provider });

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

        const result = await send({ gate: approvedGate(), poster, lookup: lookupReturning(preflight), provider, confirmNotAlreadyPostedInERP: true });

        expect(poster).toHaveBeenCalledOnce();
        expect(result.Status).toBe('Posted');
    });

    // A lookup that finds nothing while the company has an unread post is not trusted (#205).
    const blind: ErpJournalLookupResult = { status: 'Unavailable', reason: 'the ERP accepted 1 batch(es) in this company that could not then be read back (batch-earlier).' };

    it('refuses a Failed retry the lookup cannot be trusted on, and says why', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();

        await expect(send({ gate: approvedGate(), poster, lookup: lookupReturning(blind), provider }))
            .rejects.toThrow(/may already be in the ERP, and the ERP lookup cannot be trusted to find it: the ERP accepted 1 batch\(es\) .* Confirm in the ERP that document JEB-0001 has not posted/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    it('sends a first send the lookup cannot be trusted on: it has never posted from here', async () => {
        const { provider } = world('Approved', { 'je-1': batched() });
        const poster = acceptingPoster();

        const result = await send({ gate: approvedGate(), poster, lookup: lookupReturning(blind), provider });

        expect(poster).toHaveBeenCalledOnce();
        expect(result.Status).toBe('Posted');
    });

    it('treats a lookup that throws as a failed lookup', async () => {
        const { provider } = world('Failed', { 'je-1': batched() });
        const poster = acceptingPoster();
        const lookup: ErpJournalLookup = async () => { throw new Error('socket hang up'); };

        await expect(send({ gate: approvedGate(), poster, lookup, provider }))
            .rejects.toThrow(/could not check the ERP .*socket hang up/);
        expect(poster).not.toHaveBeenCalled();
    });

    it('runs the lookup only after the gate and the coherence check pass', async () => {
        const { provider } = world('Approved', { 'je-1': batched() }, { drift: ['Member set changed.'] });
        const lookup = found();

        await expect(send({ gate: approvedGate(), poster: acceptingPoster(), lookup, provider }))
            .rejects.toThrow(/no longer matches its approved content/);
        expect(lookup).not.toHaveBeenCalled();
    });

    // The issue's path: the ERP accepts, the Sent→Posted save fails, an operator retries. The retry must
    // find the posting instead of sending the journal a second time.
    it('recovers a batch whose Sent→Posted save failed after the ERP accepted it, with one post in total', async () => {
        const { batch, entries, provider } = world('Approved', { 'je-1': batched() }, { failFirstSaveAt: 'Posted' });
        const poster = acceptingPoster();

        const first = await send({ gate: approvedGate(), poster, lookup: lookupReturning({ status: 'NotFound' }), provider });
        expect(first.Status).toBe('Failed');

        const result = await send({ gate: approvedGate(), poster, lookup: lookupReturning({ status: 'Found', externalJournalEntryBatchRef: 'ERP-REF-2' }), provider });

        expect(poster).toHaveBeenCalledOnce();
        expect(result.Status).toBe('Posted');
        expect(entries['je-1']).toMatchObject({ Status: 'GLPosted', GLReferenceID: 'ERP-REF-2' });
    });

    // #30 item 6: thrown, the save failure left the batch at Sent on a manual dispatch, which nothing
    // retries, archives or reports.
    it('marks a batch Failed, keeping the ERP reference, when the ERP accepted it and the Posted save failed', async () => {
        const { batch, entries, provider } = world('Approved', { 'je-1': batched() }, { failFirstSaveAt: 'Posted' });
        batch.LatestResult = { CompleteMessage: 'deadlock victim' };

        const result = await send({ gate: approvedGate(), poster: acceptingPoster(), lookup: lookupReturning({ status: 'NotFound' }), provider });

        expect(result.Status).toBe('Failed');
        expect(batch.statusHistory).toEqual(['Sent', 'Failed']);
        expect(batch.ExternalJournalEntryBatchRef).toBe('ERP-REF-2');
        expect(batch.PostedAt).toBeNull();
        expect(batch.ErrorMessage).toBe(
            'The ERP accepted document JEB-0001 as ERP-REF-2, but recording the batch Posted failed: deadlock victim ' +
            'Retry it: the ERP lookup finds the posting and records it Posted without sending it again. Do not confirm it as not posted.',
        );
        expect(entries['je-1'].Status).toBe('Batched');
    });

    it('marks a Failed retry Failed again, with the found reference, when recording the found posting fails', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { failFirstSaveAt: 'Posted' });
        const poster = acceptingPoster();

        const result = await send({ gate: approvedGate(), poster, lookup: found(), provider });

        expect(poster).not.toHaveBeenCalled();
        expect(result.Status).toBe('Failed');
        expect(batch.statusHistory).toEqual(['Sent', 'Failed']);
        expect(batch.ExternalJournalEntryBatchRef).toBe('JEB-0001');
        expect(batch.ErrorMessage).toMatch(/^The ERP accepted document JEB-0001 as JEB-0001, but recording the batch Posted failed/);
    });
});

// #216: dimension tags edited after approval break the seal. A Failed retry whose journal the ERP
// already holds is recorded Posted anyway, with no second post, and flagged; every other outcome
// still refuses it.
describe('sendJournalEntryBatch — a Failed retry whose approved-content seal no longer matches (#216)', () => {
    const SEAL = ['Batch JEB-0001 no longer matches the content that was approved.'];
    const lookupReturning = (result: ErpJournalLookupResult): ErpJournalLookup => vi.fn(async () => result);
    const found = (): ErpJournalLookup => lookupReturning({ status: 'Found', externalJournalEntryBatchRef: 'ERP-REF-1' });

    it('records it Posted from the ERP\'s posting, without posting it again, and flags the seal mismatch', async () => {
        const { batch, entries, provider } = world('Failed', { 'je-1': batched(), 'je-2': batched() }, { sealDrift: SEAL });
        const poster = acceptingPoster();

        const result = await send({ poster, lookup: found(), provider });

        expect(poster).not.toHaveBeenCalled();
        expect(result.Status).toBe('Posted');
        expect(batch.statusHistory).toEqual(['Sent', 'Posted']);
        expect(batch.ExternalJournalEntryBatchRef).toBe('ERP-REF-1');
        expect(batch.SealMismatchDetectedAt).toBeInstanceOf(Date);
        expect(batch.ErrorMessage).toBeNull();
        expect(Object.values(entries).map(e => e.Status)).toEqual(['GLPosted', 'GLPosted']);
    });

    it('leaves the flag unset when the seal matches', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() });

        const result = await send({ lookup: found(), provider });

        expect(result.Status).toBe('Posted');
        expect(batch.SealMismatchDetectedAt).toBeNull();
    });

    it.each<[string, ErpJournalLookupResult]>([
        ['finds nothing', { status: 'NotFound' }],
        ['finds a posting that differs', { status: 'Mismatch', detail: 'line 2 differs.' }],
        ['fails', { status: 'Error', error: 'BC 503.' }],
        ['finds another batch\'s journal', { status: 'Foreign', detail: 'its lines carry another token.' }],
    ])('refuses it, without calling the ERP or leaving Failed, when the lookup %s', async (_label, preflight) => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { sealDrift: SEAL });
        const poster = acceptingPoster();
        const lookup = lookupReturning(preflight);

        await expect(send({ poster, lookup, provider, confirmNotAlreadyPostedInERP: true }))
            .rejects.toThrow(/no longer matches its approved content — refusing to dispatch\. Batch JEB-0001 no longer matches/);
        expect(lookup).toHaveBeenCalledOnce();
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Save).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    it('refuses it when the ERP offers no lookup, even with the operator\'s confirmation', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { sealDrift: SEAL });
        const poster = acceptingPoster();

        await expect(send({ poster, provider, confirmNotAlreadyPostedInERP: true }))
            .rejects.toThrow(/no longer matches its approved content/);
        expect(poster).not.toHaveBeenCalled();
        expect(batch.Save).not.toHaveBeenCalled();
    });

    it('still refuses a first send from Approved before the lookup', async () => {
        const { batch, provider } = world('Approved', { 'je-1': batched() }, { sealDrift: SEAL });
        const lookup = found();

        await expect(send({ poster: acceptingPoster(), lookup, provider }))
            .rejects.toThrow(/no longer matches its approved content/);
        expect(lookup).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Approved');
    });

    it('still refuses a retry whose content is incoherent, before the lookup', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { drift: ['Member set changed.'], sealDrift: SEAL });
        const lookup = found();

        await expect(send({ poster: acceptingPoster(), lookup, provider }))
            .rejects.toThrow(/Member set changed\. Batch JEB-0001 no longer matches/);
        expect(lookup).not.toHaveBeenCalled();
        expect(batch.Status).toBe('Failed');
    });

    it('clears the flag when recording the posting fails, so the Failed batch does not carry it', async () => {
        const { batch, provider } = world('Failed', { 'je-1': batched() }, { sealDrift: SEAL, failFirstSaveAt: 'Posted' });

        const result = await send({ poster: acceptingPoster(), lookup: found(), provider });

        expect(result.Status).toBe('Failed');
        expect(batch.statusHistory).toEqual(['Sent', 'Failed']);
        expect(batch.SealMismatchDetectedAt).toBeNull();
    });

    // The flag is frozen (trg_JournalEntryBatch_Immutability, 50034): the fake's Save applies the rule.
    it('writes the flag in the save that records the retried batch Posted, which the database allows', async () => {
        const { batch, provider, stored } = world('Failed', { 'je-1': batched() }, { sealDrift: SEAL });

        await send({ lookup: found(), provider });

        expect(stored.Status).toBe('Posted');
        expect(stored.SendAttemptCount).toBe(2);
        expect(stored.SealMismatchDetectedAt).toBe(batch.SealMismatchDetectedAt);
        expect(stored.SealMismatchDetectedAt).toBeInstanceOf(Date);
    });

    it('persists no flag when recording the posting fails, and the next retry records it Posted and flags it', async () => {
        const { batch, provider, stored } = world('Failed', { 'je-1': batched() }, { sealDrift: SEAL, failFirstSaveAt: 'Posted' });

        await send({ lookup: found(), provider });
        expect(stored).toEqual({ Status: 'Failed', SendAttemptCount: 2, SealMismatchDetectedAt: null });

        const result = await send({ lookup: found(), provider });

        expect(result.Status).toBe('Posted');
        expect(batch.statusHistory).toEqual(['Sent', 'Failed', 'Sent', 'Posted']);
        expect(stored.SendAttemptCount).toBe(3);
        expect(stored.SealMismatchDetectedAt).toBeInstanceOf(Date);
    });

    it('cannot flag a batch outside that save, or change or clear the flag once set', async () => {
        const failed = world('Failed', { 'je-1': batched() });
        failed.batch.SealMismatchDetectedAt = new Date();
        expect(await failed.batch.Save()).toBe(false);
        expect(failed.stored.SealMismatchDetectedAt).toBeNull();

        const adopted = world('Failed', { 'je-1': batched() }, { sealDrift: SEAL });
        await send({ lookup: found(), provider: adopted.provider });
        const flaggedAt = adopted.stored.SealMismatchDetectedAt;
        adopted.batch.SealMismatchDetectedAt = null;
        expect(await adopted.batch.Save()).toBe(false);
        adopted.batch.SealMismatchDetectedAt = new Date((flaggedAt?.getTime() ?? 0) + 1000);
        expect(await adopted.batch.Save()).toBe(false);
        expect(adopted.stored.SealMismatchDetectedAt).toBe(flaggedAt);
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
