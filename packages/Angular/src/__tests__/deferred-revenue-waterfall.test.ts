import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessTimeZoneEngine, FromCalendarDay, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { DeferredRevenueWaterfallComponent } from '../lib/components/deferred-revenue-waterfall/deferred-revenue-waterfall.component';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { entityObject, installStubProvider, stubEntityInfo } from './support/entity-stubs';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

beforeEach(() => {
    installStubProvider([
        stubEntityInfo(JE_ENTITY, ['ID', 'EntryNumber', 'EffectiveDate', 'LinkedRecordID', 'Description', '__mj_CreatedAt']),
        stubEntityInfo(JEL_ENTITY, ['ID', 'JournalEntryID', 'DebitAmount', 'CreditAmount']),
    ]);
});

/**
 * Run `fn` with the machine's zone pinned. Restoring an UNSET `TZ` must `delete` it: assigning
 * `undefined` back stores the string "undefined", which ICU reads as UTC. Same technique as
 * `batch-status-window.test.ts`'s `AT`.
 */
const AT = (tz: string, fn: () => void) => {
    const original = process.env.TZ;
    process.env.TZ = tz;
    try {
        fn();
    } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
    }
};

/** Machine zones either side of Greenwich: a local-getter read shifts a UTC-midnight day in each. */
const MACHINE_ZONES = ['UTC', 'America/Chicago', 'Pacific/Auckland'];

/**
 * A real entity with one credit line: the component takes entities, so the spec hands it entities.
 * `EffectiveDate` is typed non-null and `__mj_CreatedAt` has no setter, so an undated entry leaves
 * `EffectiveDate` unset and the creation instant goes through `Set`.
 */
async function mockEntry(fields: {
    EntryNumber: string;
    EffectiveDate: Date | null;
    CreatedAt?: Date;
    LinkedRecordID: string;
    Description: string;
    CreditAmount: number;
}): Promise<mjBizAppsAccountingJournalEntryEntity> {
    const entry = await entityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY);
    entry.NewRecord();
    entry.EntryNumber = fields.EntryNumber;
    if (fields.EffectiveDate) entry.EffectiveDate = fields.EffectiveDate;
    if (fields.CreatedAt) entry.Set('__mj_CreatedAt', fields.CreatedAt);
    entry.LinkedRecordID = fields.LinkedRecordID;
    entry.Description = fields.Description;

    const line = await entry.Lines.Create();
    line.CreditAmount = fields.CreditAmount;
    return entry;
}

describe('DeferredRevenueWaterfallComponent', () => {
    it('computes summary statistics for an array of Journal Entries', async () => {
        const comp = new DeferredRevenueWaterfallComponent();

        const entries: mjBizAppsAccountingJournalEntryEntity[] = [];
        for (let i = 1; i <= 12; i++) {
            entries.push(await mockEntry({
                EntryNumber: String(1000 + i),
                // A DATE column round-trips as UTC midnight, never local midnight.
                EffectiveDate: FromCalendarDay(`2026-${String(i).padStart(2, '0')}-01`),
                LinkedRecordID: 'sub-term-1',
                Description: 'Monthly Subscription Rev Rec',
                CreditAmount: 100,
            }));
        }

        comp.JournalEntries = entries;
        comp.ngOnChanges({
            JournalEntries: {
                currentValue: entries,
                previousValue: [],
                firstChange: true,
                isFirstChange: () => true,
            },
        });

        expect(comp.Rows.length).toBe(1);
        expect(comp.Summary.TotalDeferredBeginning).toBe(1200);
        expect(comp.IsSingleItem).toBe(true);
        expect(comp.MonthHeaders.length).toBe(12);
    });

    it('formats money and compact currency correctly', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        expect(comp.FormatMoney(1200)).toBe('$1,200.00');
        expect(comp.FormatCompact(1500)).toBe('$2k');
        expect(comp.FormatCompact(1500000)).toBe('$1.5M');
        expect(comp.FormatCompact(0)).toBe('—');
    });

    it('handles empty entries gracefully', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        comp.JournalEntries = [];
        comp.ngOnChanges({
            JournalEntries: {
                currentValue: [],
                previousValue: [],
                firstChange: true,
                isFirstChange: () => true,
            },
        });
        expect(comp.Rows.length).toBe(0);
        expect(comp.Summary.TotalDeferredBeginning).toBe(0);
    });

    describe('month bucketing on the calendar day, not the machine zone', () => {
        // The engine is a singleton; set its loaded state directly (as `batch-status-window.test.ts`
        // does) and restore it so the stub cannot leak into other tests sharing this worker.
        const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
        const original = { rows: engine._configurations, loaded: engine._loaded };

        afterEach(() => {
            engine._configurations = original.rows;
            engine._loaded = original.loaded;
            vi.useRealTimers();
        });

        function useChicagoBusinessZone(now: string): void {
            engine._configurations = [
                { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
            ];
            engine._loaded = true;
            vi.useFakeTimers();
            vi.setSystemTime(new Date(now));
        }

        async function monthlySchedule(): Promise<mjBizAppsAccountingJournalEntryEntity[]> {
            const entries: mjBizAppsAccountingJournalEntryEntity[] = [];
            for (let i = 1; i <= 12; i++) {
                entries.push(await mockEntry({
                    EntryNumber: String(1000 + i),
                    EffectiveDate: FromCalendarDay(`2026-${String(i).padStart(2, '0')}-01`),
                    LinkedRecordID: 'sub-term-1',
                    Description: 'Monthly Subscription Rev Rec',
                    CreditAmount: 100 * i,
                }));
            }
            return entries;
        }

        function render(entries: mjBizAppsAccountingJournalEntryEntity[]): DeferredRevenueWaterfallComponent {
            const comp = new DeferredRevenueWaterfallComponent();
            comp.JournalEntries = entries;
            comp.ngOnChanges({
                JournalEntries: { currentValue: entries, previousValue: [], firstChange: true, isFirstChange: () => true },
            });
            return comp;
        }

        for (const zone of MACHINE_ZONES) {
            it(`puts each EffectiveDate in its own month with the machine in ${zone}`, async () => {
                useChicagoBusinessZone('2026-06-15T17:00:00.000Z');
                const schedule = await monthlySchedule();
                AT(zone, () => {
                    const comp = render(schedule);
                    expect(comp.MonthHeaders.map((h) => h.Key)).toEqual([
                        '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
                        '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
                    ]);
                    expect(comp.MonthHeaders[0].Label).toBe("Jan '26");
                    const cells = comp.Rows[0].MonthlyCells;
                    expect(cells.find((c) => c.MonthKey === '2026-01')?.Amount).toBe(100);
                    expect(cells.find((c) => c.MonthKey === '2026-12')?.Amount).toBe(1200);
                    expect(cells[0].MonthShort).toBe('Jan');
                });
            });

            it(`recognizes to date through the business month with the machine in ${zone}`, async () => {
                // 2026-02-01T03:00Z is still 31 January (21:00 CST) in the Chicago business zone,
                // so only January has been recognized.
                useChicagoBusinessZone('2026-02-01T03:00:00.000Z');
                const schedule = await monthlySchedule();
                AT(zone, () => {
                    const comp = render(schedule);
                    expect(comp.Rows[0].RecognizedToDate).toBe(100);
                    expect(comp.Summary.TotalRecognizedYTD).toBe(100);
                    expect(comp.Summary.MonthlyTotals.filter((m) => m.IsPastOrCurrent).map((m) => m.MonthKey)).toEqual(['2026-01']);
                });
            });

            it(`places an undated entry by its creation instant on the business calendar with the machine in ${zone}`, async () => {
                // 2026-03-01T02:00Z is 20:00 CST on 28 February in the business zone.
                useChicagoBusinessZone('2026-06-15T17:00:00.000Z');
                const undated = await mockEntry({
                    EntryNumber: '2000',
                    EffectiveDate: null,
                    CreatedAt: new Date('2026-03-01T02:00:00.000Z'),
                    LinkedRecordID: 'sub-term-1',
                    Description: 'Monthly Subscription Rev Rec',
                    CreditAmount: 500,
                });
                AT(zone, () => {
                    const comp = render([undated]);
                    expect(comp.MonthHeaders[0].Key).toBe('2026-02');
                    expect(comp.Rows[0].MonthlyCells.find((c) => c.MonthKey === '2026-02')?.Amount).toBe(500);
                });
            });
        }
    });
});
