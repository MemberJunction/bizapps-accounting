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
        // Manual entries awaiting approval stay out of every pool (golive #353).
        expect(filter).toBe(`Status='Pending' AND EntryTypeID<>'${SUMMARY_ID}' AND EffectiveDate < '${through}' AND (ApprovalLevel IS NULL OR ApprovedAt IS NOT NULL)`);
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

import { previewBatch } from '../JournalEntryBatchEngine.js';
import type { IMetadataProvider } from '@memberjunction/core';

describe('previewBatch — uncapped reads and chunked IN clauses for >1,000 entries (#488)', () => {
    const COMPANY_ID = '11111111-0000-4000-8000-000000000001';
    const SUMMARY_TYPE_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';
    const MANUAL_TYPE_ID = '684c06d4-55da-49d7-8453-e046fc82b895';
    const GL_DEBIT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
    const GL_CREDIT_ID = 'aaaaaaaa-0000-4000-8000-000000000002';
    const DIM_ID = 'dddddddd-0000-4000-8000-000000000001';
    const DIM_VAL_ID = 'dddddddd-0000-4000-8000-000000000002';
    const mockUser = { ID: 'USER-1' } as UserInfo;

    it('loads all 1,200 candidate entries, their 2,400 lines, and their dimension tags with IgnoreMaxRows: true and <=500-ID chunks', async () => {
        const entryCount = 1200;
        const entries = Array.from({ length: entryCount }, (_, i) => {
            const hex = (i + 1).toString(16).padStart(12, '0');
            return {
                ID: `00000000-0000-4000-8000-${hex}`,
                EntryNumber: `JE-${String(i + 1).padStart(4, '0')}`,
                EffectiveDate: '2026-08-15',
                EntryTypeID: MANUAL_TYPE_ID,
                CompanyID: COMPANY_ID,
                Description: `Entry ${i + 1}`,
                ApprovalLevel: null,
                ApprovedAt: null,
                Status: 'Pending',
            };
        });
        const linesByJe = new Map<string, Array<{ ID: string; JournalEntryID: string; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null }>>();
        const dimsByLine = new Map<string, Array<{ JournalEntryLineID: string; DimensionID: string; DimensionValueID: string }>>();
        for (let i = 0; i < entries.length; i++) {
            const je = entries[i];
            const drId = `10000000-0000-4000-8000-${(i * 2 + 1).toString(16).padStart(12, '0')}`;
            const crId = `10000000-0000-4000-8000-${(i * 2 + 2).toString(16).padStart(12, '0')}`;
            linesByJe.set(je.ID, [
                { ID: drId, JournalEntryID: je.ID, GLAccountID: GL_DEBIT_ID, DebitAmount: 10, CreditAmount: 0 },
                { ID: crId, JournalEntryID: je.ID, GLAccountID: GL_CREDIT_ID, DebitAmount: 0, CreditAmount: 10 },
            ]);
            dimsByLine.set(drId, [{ JournalEntryLineID: drId, DimensionID: DIM_ID, DimensionValueID: DIM_VAL_ID }]);
        }

        const calls: Array<{ EntityName?: string; ExtraFilter?: string; IgnoreMaxRows?: boolean; ResultType?: string }> = [];
        const runView = async (params: { EntityName?: string; ExtraFilter?: string; IgnoreMaxRows?: boolean; ResultType?: string }) => {
            calls.push(params);
            const filter = params.ExtraFilter ?? '';
            if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Types') {
                return {
                    Success: true,
                    Results: filter.includes('IsJournalEntryBatchSummary=1')
                        ? [{ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary', IsJournalEntryBatchSummary: true }]
                        : [{ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary' }, { ID: MANUAL_TYPE_ID, Code: 'Manual' }],
                };
            }
            if (params.EntityName === 'MJ_BizApps_Accounting: Accounting Company Profiles') {
                return { Success: true, Results: [] };
            }
            if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entries') {
                if (filter.startsWith('ID IN (')) {
                    const ids = [...filter.matchAll(/'([^']+)'/g)].map(m => m[1]);
                    expect(ids.length).toBeLessThanOrEqual(500);
                    const idSet = new Set(ids);
                    return { Success: true, Results: entries.filter(e => idSet.has(e.ID)) };
                }
                // Simulate MJ's 1,000-row UserViewMaxRows cap whenever IgnoreMaxRows is not set.
                const cap = params.IgnoreMaxRows ? entries.length : 1000;
                return { Success: true, Results: entries.slice(0, cap) };
            }
            if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Lines') {
                const jeIds = [...filter.matchAll(/'([^']+)'/g)].map(m => m[1]);
                expect(jeIds.length).toBeLessThanOrEqual(500);
                const matched = jeIds.flatMap(id => linesByJe.get(id) ?? []);
                const cap = params.IgnoreMaxRows ? matched.length : 1000;
                return { Success: true, Results: matched.slice(0, cap) };
            }
            if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Line Dimensions') {
                const lineIds = [...filter.matchAll(/'([^']+)'/g)].map(m => m[1]);
                expect(lineIds.length).toBeLessThanOrEqual(500);
                const matched = lineIds.flatMap(id => dimsByLine.get(id) ?? []);
                const cap = params.IgnoreMaxRows ? matched.length : 1000;
                return { Success: true, Results: matched.slice(0, cap) };
            }
            if (params.EntityName === 'MJ_BizApps_Accounting: GL Accounts') {
                return {
                    Success: true,
                    Results: [
                        { ID: GL_DEBIT_ID, Code: '1100', Name: 'AR' },
                        { ID: GL_CREDIT_ID, Code: '4000', Name: 'Revenue' },
                    ],
                };
            }
            return { Success: true, Results: [] };
        };

        const provider = { RunView: runView } as unknown as IMetadataProvider;
        const preview = await previewBatch({ companyIds: [COMPANY_ID], postingDate: '2026-08-31' }, mockUser, provider);

        expect(preview.Candidates).toHaveLength(1200);
        expect(preview.Candidates.every(c => c.Amount === 10)).toBe(true);
        expect(preview.TotalDebits).toBe(12000);
        expect(preview.TotalCredits).toBe(12000);
        expect(preview.GrossDebits).toBe(12000);
        expect(preview.GrossCredits).toBe(12000);

        const rowCalls = calls.filter(c => c.ResultType !== 'count_only' && c.EntityName !== 'MJ_BizApps_Accounting: Journal Entry Types');
        expect(rowCalls.every(c => c.IgnoreMaxRows === true)).toBe(true);
    });
});


import {
    AutoApproveGate,
    buildJournalEntryBatchFromExplicitIds,
    buildJournalEntryBatchFromView,
    JournalEntryBatchPostingDateError,
    resolveExternalDimensions,
    type JournalEntryBatchApprovalGate,
} from '../JournalEntryBatchEngine.js';

/**
 * Every chunked read in the engine, counted (#488). 1,200 ids at 500 per chunk is 3 reads; a loop
 * that stops chunking makes 1 and fails here. The previewBatch case above pins the IN-list size.
 */
describe('JournalEntryBatchEngine — each chunked read splits 1,200 ids into 3 reads (#488)', () => {
    const COMPANY_ID = '11111111-0000-4000-8000-000000000001';
    const GL_CREDIT_ID = 'aaaaaaaa-0000-4000-8000-000000000002';
    const DIM_ID = 'dddddddd-0000-4000-8000-000000000001';
    const mockUser = { ID: 'USER-1' } as UserInfo;
    const STOP = 'stop before writing';
    const SUMMARY_TYPE_ID = 'e9521aa3-f4ef-4ec5-a899-d9dd59f320b7';
    const COUNT = 1200;
    const guid = (prefix: string, i: number) => `${prefix}-0000-4000-8000-${(i + 1).toString(16).padStart(12, '0')}`;

    interface Call { EntityName?: string; ViewID?: string; ExtraFilter?: string; Fields?: string[] }
    interface World { calls: Call[]; provider: IMetadataProvider }

    const entries = Array.from({ length: COUNT }, (_, i) => ({
        ID: guid('00000000', i), EntryNumber: `JE-${String(i + 1).padStart(4, '0')}`, Status: 'Pending',
        CompanyID: COMPANY_ID, EffectiveDate: '2026-08-15', ApprovalLevel: null, ApprovedAt: null,
    }));
    const lineId = (i: number) => guid('10000000', i);
    const glId = (i: number) => guid('aaaaaaaa', i + 10);
    const dimValueId = (i: number) => guid('eeeeeeee', i);

    /** Entries dated after the posting day: one per chunk, in descending date order across chunks. */
    const LATE = new Map<string, string>([[entries[100].ID, '2026-09-03'], [entries[600].ID, '2026-09-01'], [entries[1100].ID, '2026-09-02']]);

    const idsIn = (filter: string) => [...filter.matchAll(/'([0-9a-f-]{36})'/gi)].map(m => m[1].toLowerCase());

    function world(options: { late?: boolean } = {}): World {
        const calls: Call[] = [];
        let dimRowsServed = 0;
        const idsBefore = (params: Call) => (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Line Dimensions' ? dimRowsServed : 0);
        const byId = new Map(entries.map(e => [e.ID, e]));
        const runView = async (params: Call) => {
            calls.push(params);
            const filter = params.ExtraFilter ?? '';
            const ids = idsIn(filter);
            if (params.ViewID) return { Success: true, Results: entries };
            switch (params.EntityName) {
                case 'MJ_BizApps_Accounting: Journal Entry Types':
                    return {
                        Success: true,
                        Results: filter.includes('IsJournalEntryBatchSummary=1')
                            ? [{ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary', IsJournalEntryBatchSummary: true }]
                            : [{ ID: SUMMARY_TYPE_ID, Code: 'JournalEntryBatchSummary' }],
                    };
                case 'MJ_BizApps_Accounting: Journal Entries':
                    if (filter.includes('EffectiveDate >')) {
                        if (!options.late) return { Success: true, Results: [] };
                        return { Success: true, Results: ids.filter(id => LATE.has(id)).map(id => ({ EntryNumber: byId.get(id)!.EntryNumber, EffectiveDate: LATE.get(id)! })) };
                    }
                    return { Success: true, Results: ids.map(id => byId.get(id)).filter(Boolean) };
                case 'MJ_BizApps_Accounting: Journal Entry Lines':
                    return {
                        Success: true,
                        Results: ids.map(id => {
                            const i = entries.findIndex(e => e.ID === id);
                            return { ID: lineId(i), JournalEntryID: id, GLAccountID: glId(i), DebitAmount: 10, CreditAmount: 0 };
                        }),
                    };
                case 'MJ_BizApps_Accounting: Journal Entry Line Dimensions':
                {
                    const rows = ids.map((id, k) => ({ JournalEntryLineID: id, DimensionID: DIM_ID, DimensionValueID: dimValueId(k + idsBefore(params)) }));
                    dimRowsServed += rows.length;
                    return { Success: true, Results: rows };
                }
                case 'MJ_BizApps_Accounting: Dimensions':
                case 'MJ_BizApps_Accounting: Dimension Values':
                case 'MJ_BizApps_Accounting: GL Accounts':
                    return { Success: true, Results: ids.map(id => ({ ID: id, Code: `C-${id.slice(-4)}`, Name: 'Account' })) };
                default:
                    return { Success: true, Results: [] };
            }
        };
        return { calls, provider: { RunView: runView } as unknown as IMetadataProvider };
    }

    const stopGate: JournalEntryBatchApprovalGate = { ...AutoApproveGate, assertCanRaise: async () => { throw new Error(STOP); } };
    const jeIdReads = (calls: Call[], dated: boolean) =>
        calls.filter(c => c.EntityName === 'MJ_BizApps_Accounting: Journal Entries' && (c.ExtraFilter ?? '').startsWith('ID IN (') && (c.ExtraFilter ?? '').includes('EffectiveDate >') === dated);
    const readsOf = (calls: Call[], entityName: string) => calls.filter(c => c.EntityName === entityName && (c.ExtraFilter ?? '').includes(' IN ('));

    it('an explicit build re-reads the ids, checks their dates and reads their lines and dimensions in 3 reads each', async () => {
        const w = world();
        await expect(buildJournalEntryBatchFromExplicitIds(entries.map(e => e.ID), 'BusinessCentral', 'USER-1', mockUser, w.provider, stopGate, '2026-08-31'))
            .rejects.toThrow(STOP);
        expect(jeIdReads(w.calls, false)).toHaveLength(3);
        expect(jeIdReads(w.calls, true)).toHaveLength(3);
        expect(readsOf(w.calls, 'MJ_BizApps_Accounting: Journal Entry Lines')).toHaveLength(3);
        expect(readsOf(w.calls, 'MJ_BizApps_Accounting: Journal Entry Line Dimensions')).toHaveLength(3);
    });

    it('names the late entries in date order, though each chunk returns them separately', async () => {
        const w = world({ late: true });
        const build = buildJournalEntryBatchFromExplicitIds(entries.map(e => e.ID), 'BusinessCentral', 'USER-1', mockUser, w.provider, stopGate, '2026-08-31');
        await expect(build).rejects.toBeInstanceOf(JournalEntryBatchPostingDateError);
        await expect(build).rejects.toThrow(
            'Posting date 2026-08-31 is earlier than 3 selected entries: JE-0601 (2026-09-01), JE-1101 (2026-09-02), JE-0101 (2026-09-03). ' +
            'Choose a posting date on or after 2026-09-03',
        );
    });

    it('a view build with a date window narrows the view in 3 reads before the explicit build', async () => {
        const w = world();
        await expect(buildJournalEntryBatchFromView('view-1', 'BusinessCentral', 'USER-1', mockUser, w.provider, stopGate, { cutoff: '2026-08-31', postingDate: '2026-08-31' }))
            .rejects.toThrow(STOP);
        const windowReads = w.calls.filter(c => c.EntityName === 'MJ_BizApps_Accounting: Journal Entries' && c.Fields?.length === 1 && c.Fields[0] === 'ID' && (c.ExtraFilter ?? '').startsWith('ID IN ('));
        expect(windowReads).toHaveLength(3);
        expect(jeIdReads(w.calls, false).length - windowReads.length).toBe(3);
    });

    it('resolves 1,200 distinct dimension values to codes in 3 reads', async () => {
        const w = world();
        const byLine = await resolveExternalDimensions(entries.map(e => e.ID), mockUser, w.provider);
        expect(byLine.size).toBe(COUNT);
        expect(readsOf(w.calls, 'MJ_BizApps_Accounting: Dimension Values')).toHaveLength(3);
        expect(readsOf(w.calls, 'MJ_BizApps_Accounting: Dimensions')).toHaveLength(1);
    });

    it('a preview names 1,200 affected GL accounts after reading them in 3 reads', async () => {
        const w = world();
        const base = w.provider as unknown as { RunView: (p: Call) => Promise<unknown> };
        const provider = {
            RunView: async (params: Call) => {
                if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entries' && !(params.ExtraFilter ?? '').startsWith('ID IN (')) {
                    w.calls.push(params);
                    return { Success: true, Results: entries.map(e => ({ ...e, EntryTypeID: 'type-1', Description: null })) };
                }
                if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Lines') {
                    const result = await base.RunView(params) as { Results: Array<Record<string, unknown>> };
                    const credits = result.Results.map(l => ({ ...l, ID: `2${String(l.ID).slice(1)}`, GLAccountID: GL_CREDIT_ID, DebitAmount: 0, CreditAmount: 10 }));
                    return { Success: true, Results: [...result.Results, ...credits] };
                }
                if (params.EntityName === 'MJ_BizApps_Accounting: Journal Entry Line Dimensions') return { Success: true, Results: [] };
                return base.RunView(params);
            },
        } as unknown as IMetadataProvider;
        const preview = await previewBatch({ companyIds: [COMPANY_ID], postingDate: '2026-08-31' }, mockUser, provider);
        expect(preview.AffectedAccounts).toHaveLength(COUNT + 1);
        expect(readsOf(w.calls, 'MJ_BizApps_Accounting: GL Accounts')).toHaveLength(3);
    });
});
