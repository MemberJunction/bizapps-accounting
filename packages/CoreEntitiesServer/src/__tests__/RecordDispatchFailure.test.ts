/**
 * `Failed` is reachable from exactly one batch state. JournalEntryBatchEntityServer's
 * LEGAL_TRANSITIONS allows Sent → Failed, and NOT Pending → Failed, Approved → Failed or
 * Posted → Failed — so a dispatch throw that landed the batch anywhere but Sent must be reported,
 * not overwritten. The Posted case is the dangerous one: calling it Failed invites a re-post and a
 * duplicate ERP journal.
 */
import { describe, it, expect, vi } from 'vitest';
import type { IMetadataProvider } from '@memberjunction/core';
import type { UserInfo } from '@memberjunction/core';
import { recordDispatchFailure } from '../JournalEntryBatchEngine.js';

const USER = { ID: 'SYSTEM-USER' } as UserInfo;

/** The slice of a batch entity this function touches, plus a Save whose outcome the test picks. */
interface FakeBatch {
    Status: string;
    ErrorMessage: string | null;
    LatestResult: { CompleteMessage: string } | null;
    Load: (id: string) => Promise<boolean>;
    Save: () => Promise<boolean>;
}

const providerFor = (batch: FakeBatch): IMetadataProvider =>
    ({ GetEntityObject: async () => batch }) as unknown as IMetadataProvider;

const fakeBatch = (status: string, opts: { saves?: boolean; found?: boolean } = {}): FakeBatch => ({
    Status: status,
    ErrorMessage: null,
    LatestResult: { CompleteMessage: 'illegal transition' },
    Load: async () => opts.found !== false,
    Save: vi.fn(async function (this: void) { return opts.saves !== false; }),
});

describe('recordDispatchFailure', () => {
    it('marks a Sent batch Failed and records the cause', async () => {
        const batch = fakeBatch('Sent');

        const result = await recordDispatchFailure('BATCH-1', 'ERP tenant unreachable', USER, providerFor(batch));

        expect(result).toEqual({ status: 'Failed', marked: true });
        expect(batch.Status).toBe('Failed');
        expect(batch.ErrorMessage).toBe('ERP tenant unreachable');
        expect(batch.Save).toHaveBeenCalledTimes(1);
    });

    // The one that matters: the ERP already has this journal.
    it('leaves a Posted batch alone and reports it as Posted, never Failed', async () => {
        const batch = fakeBatch('Posted');

        const result = await recordDispatchFailure('BATCH-1', 'JE flip threw', USER, providerFor(batch));

        expect(result).toEqual({ status: 'Posted', marked: false });
        expect(batch.Status).toBe('Posted');
        expect(batch.Save).not.toHaveBeenCalled();
    });

    it('leaves an Approved batch alone — Approved → Failed is not a legal transition', async () => {
        const batch = fakeBatch('Approved');

        const result = await recordDispatchFailure('BATCH-1', 'send threw', USER, providerFor(batch));

        expect(result).toEqual({ status: 'Approved', marked: false });
        expect(batch.Save).not.toHaveBeenCalled();
    });

    it('leaves a Pending batch alone — it is still cancellable, not failable', async () => {
        const batch = fakeBatch('Pending');

        const result = await recordDispatchFailure('BATCH-1', 'approve threw', USER, providerFor(batch));

        expect(result).toEqual({ status: 'Pending', marked: false });
        expect(batch.Save).not.toHaveBeenCalled();
    });

    it('throws when the Failed save is rejected rather than reporting a mark that never landed', async () => {
        const batch = fakeBatch('Sent', { saves: false });

        await expect(recordDispatchFailure('BATCH-1', 'boom', USER, providerFor(batch)))
            .rejects.toThrow(/did not save: illegal transition/);
    });

    it('throws when the batch cannot be loaded', async () => {
        const batch = fakeBatch('Sent', { found: false });

        await expect(recordDispatchFailure('BATCH-1', 'boom', USER, providerFor(batch)))
            .rejects.toThrow(/batch BATCH-1 not found/);
    });
});
