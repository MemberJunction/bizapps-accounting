/**
 * Compatibility shim: `netLines` still lives on JournalEntryBatchEngine so existing
 * server callers keep compiling. The behavior is owned by EngineBase.NetLines.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NetLines } from '@mj-biz-apps/accounting-engine-base';
import { AddDays, BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { netLines, type NettableLine } from '../JournalEntryBatchEngine.js';
import { todayBusiness } from '../BusinessDay.js';

const line = (glAccountId: string, debit: number, credit: number): NettableLine => ({
    companyId: '11111111-0000-0000-0000-000000000001',
    glAccountId,
    debit,
    credit,
    dims: [],
});

describe('netLines (compat alias for NetLines)', () => {
    it('delegates to NetLines from accounting-engine-base', () => {
        const input = [line('aaaaaaaa-0000-0000-0000-000000000001', 100, 0), line('aaaaaaaa-0000-0000-0000-000000000001', 0, 30)];
        expect(netLines(input)).toEqual(NetLines(input));
    });
});

describe('todayBusiness — PostingDate is stamped with today in the BUSINESS zone, not UTC', () => {
    // The engine is a singleton; set its loaded state directly (as bizapps-orders'
    // date-cell.test.ts does) so it answers a chosen zone with no IMetadataProvider at all, then
    // restore it so the stub cannot leak into other tests sharing this worker.
    const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
    const original = { rows: engine._configurations, loaded: engine._loaded };

    afterEach(() => {
        engine._configurations = original.rows;
        engine._loaded = original.loaded;
        vi.useRealTimers();
    });

    it('is the Chicago calendar day, pinned to UTC midnight, at an instant UTC and Chicago disagree on', () => {
        // 2026-09-01T02:00:00Z is 1 September in UTC but still 31 August, 9 PM, in Chicago (CDT,
        // UTC-5). The retired `todayUTC()` read UTC parts and answered '2026-09-01'; the fix reads
        // the business zone and must answer '2026-08-31' — the same acceptance case as C2's
        // resolveCutoff tests, now covered for PostingDate too.
        engine._configurations = [
            { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
        ];
        engine._loaded = true;
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-01T02:00:00.000Z'));

        const result = todayBusiness();

        expect(result.toISOString()).toBe('2026-08-31T00:00:00.000Z');
        expect(result.getUTCHours()).toBe(0);
        expect(result.getUTCMinutes()).toBe(0);
        expect(result.getUTCSeconds()).toBe(0);
        expect(result.getUTCMilliseconds()).toBe(0);
    });
});

import { pendingCandidateFilter } from '../JournalEntryBatchEngine.js';
import type { UserInfo } from '@memberjunction/core';

describe('pendingCandidateFilter', () => {
    const mockUser = { ID: 'USER-1' } as UserInfo;
    const REVREC_ID = '48d60bcc-044b-4cc2-9675-0d3b57bcdcba';
    const ORDER_ID = '684c06d4-55da-49d7-8453-e046fc82b895';
    const PAYMENT_ID = '411df6dc-3652-4151-836f-cda2e46a5038';
    const SUMMARY_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';

    const runViewFn = async (params: any) => {
        if (params.ExtraFilter?.includes("Code IN ('RevenueRecognition')")) {
            return { Success: true, Results: [{ ID: REVREC_ID, Code: 'RevenueRecognition' }] };
        }
        if (params.ExtraFilter?.includes("Code IN ('OrderBooking','PaymentReceipt')")) {
            return {
                Success: true,
                Results: [
                    { ID: ORDER_ID, Code: 'OrderBooking' },
                    { ID: PAYMENT_ID, Code: 'PaymentReceipt' },
                ],
            };
        }
        if (params.ExtraFilter?.includes("Code='JournalEntryBatchSummary'") || params.ExtraFilter?.includes("IsJournalEntryBatchSummary=1")) {
            return { Success: true, Results: [{ ID: SUMMARY_ID, Code: 'JournalEntryBatchSummary' }] };
        }
        return { Success: true, Results: [] };
    };

    const mockProviders = {
        md: {
            RunView: runViewFn,
        },
        rv: {
            RunView: runViewFn,
        },
    } as any;

    it('generates base Pending and non-summary clauses, ending at the default posting date, by default', async () => {
        const filter = await pendingCandidateFilter({}, mockUser, mockProviders);
        // No cutoff still ends the pool at the posting date — today's business day (golive #315).
        const through = AddDays(BusinessTimeZoneEngine.Instance.Today(), 1);
        expect(filter).toBe(`Status='Pending' AND EntryTypeID<>'${SUMMARY_ID}' AND EffectiveDate < '${through}'`);
    });

    it('adds NOT IN clause when excludeEntryTypeCodes is provided', async () => {
        const filter = await pendingCandidateFilter({
            excludeEntryTypeCodes: ['RevenueRecognition'],
        }, mockUser, mockProviders);
        expect(filter).toContain("Status='Pending'");
        expect(filter).toContain(`EntryTypeID<>'${SUMMARY_ID}'`);
        expect(filter).toContain(`EntryTypeID NOT IN ('${REVREC_ID}')`);
    });

    it('combines cutoff date and excludeEntryTypeCodes for daily batches', async () => {
        const cutoff = new Date('2026-08-25T00:00:00.000Z');
        const filter = await pendingCandidateFilter({
            cutoff,
            excludeEntryTypeCodes: ['RevenueRecognition'],
        }, mockUser, mockProviders);
        expect(filter).toContain("Status='Pending'");
        expect(filter).toContain("EffectiveDate < '2026-08-26'");
        expect(filter).toContain(`EntryTypeID NOT IN ('${REVREC_ID}')`);
    });

    it('adds IN clause when entryTypeCodes whitelist is provided', async () => {
        const filter = await pendingCandidateFilter({
            entryTypeCodes: ['OrderBooking', 'PaymentReceipt'],
        }, mockUser, mockProviders);
        expect(filter).toContain(`EntryTypeID IN ('${ORDER_ID}','${PAYMENT_ID}')`);
    });

    describe('cutoff is a BUSINESS day — EffectiveDate is a DATE column, never compared to an instant (golive #168)', () => {
        const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
        const original = { rows: engine._configurations, loaded: engine._loaded };

        beforeEach(() => {
            engine._configurations = [
                { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
            ];
            engine._loaded = true;
        });

        afterEach(() => {
            engine._configurations = original.rows;
            engine._loaded = original.loaded;
            vi.restoreAllMocks();
        });

        it('resolves a non-midnight cutoff instant to the business day it falls on, inclusive of that whole day', async () => {
            // 2026-10-01T02:30:00Z is 30 September, 9:30 PM in Chicago (CDT, UTC-5) — the batch
            // datetime an API or Action caller might send in the evening. The retired branch emitted
            // `EffectiveDate <= '2026-10-01T02:30:00.000Z'`, which against a DATE column admits
            // every JE dated 1 October (tomorrow, in Chicago) into the preview pool and the batch.
            const filter = await pendingCandidateFilter({ cutoff: new Date('2026-10-01T02:30:00.000Z') }, mockUser, mockProviders);
            expect(filter).toContain("EffectiveDate < '2026-10-01'");
            expect(filter).not.toContain('T02:30');
        });

        it('uses the single company in scope when resolving the business day', async () => {
            // Resolve ignores its company today (one app-wide zone), so the filter alone cannot tell
            // whether the company was passed; the spy pins that it is, for when per-company zones land.
            const resolve = vi.spyOn(BusinessTimeZoneEngine.Instance, 'Resolve');
            const filter = await pendingCandidateFilter(
                { cutoff: new Date('2026-10-01T02:30:00.000Z'), companyIds: ['11111111-0000-0000-0000-000000000001'] },
                mockUser,
                mockProviders,
            );
            expect(filter).toContain("EffectiveDate < '2026-10-01'");
            expect(resolve).toHaveBeenCalledWith('11111111-0000-0000-0000-000000000001');
        });

        it('uses the app-wide zone when more than one company is in scope', async () => {
            const resolve = vi.spyOn(BusinessTimeZoneEngine.Instance, 'Resolve');
            await pendingCandidateFilter(
                { cutoff: new Date('2026-10-01T02:30:00.000Z'), companyIds: ['11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002'] },
                mockUser,
                mockProviders,
            );
            expect(resolve).toHaveBeenCalledWith(undefined);
        });

        it('moves to the next day only once the business day has turned', async () => {
            // 2026-10-01T06:00:00Z is 1 October, 1 AM in Chicago — 1 October is now included.
            const filter = await pendingCandidateFilter({ cutoff: new Date('2026-10-01T06:00:00.000Z') }, mockUser, mockProviders);
            expect(filter).toContain("EffectiveDate < '2026-10-02'");
        });

        it('keeps a midnight-UTC cutoff as that calendar day, inclusive (unchanged behaviour)', async () => {
            const filter = await pendingCandidateFilter({ cutoff: new Date('2026-09-30T00:00:00.000Z') }, mockUser, mockProviders);
            expect(filter).toContain("EffectiveDate < '2026-10-01'");
        });
    });
});

