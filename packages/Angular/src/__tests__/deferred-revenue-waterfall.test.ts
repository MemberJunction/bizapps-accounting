import { beforeEach, describe, expect, it } from 'vitest';
import { FromCalendarDay } from '@mj-biz-apps/common-entities';
import { DeferredRevenueWaterfallComponent } from '../lib/components/deferred-revenue-waterfall/deferred-revenue-waterfall.component';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { useBusinessClock } from './support/business-clock';
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
 * Business zone Chicago at 2026-02-01T03:00Z: 21:00 CST on 31 January, so the business month is
 * January while UTC is already in February. Each machine zone catches a different regression:
 * - Los Angeles is west of Greenwich, so a local-getter read of a UTC-midnight `EffectiveDate`
 *   falls into the previous month there. East of Greenwich it does not.
 * - Tokyo is already in February, so a browser-local "today" fails there. A UTC "today"
 *   (`toISOString`) fails under both.
 */
const MACHINE_ZONES = ['America/Los_Angeles', 'Asia/Tokyo'];
const LAST_BUSINESS_DAY_OF_JANUARY = new Date('2026-02-01T03:00:00.000Z');

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
            describe(`with the machine in ${zone}`, () => {
                useBusinessClock({
                    BusinessZone: 'America/Chicago',
                    BusinessSqlZone: 'Central Standard Time',
                    MachineZone: zone,
                    Instant: LAST_BUSINESS_DAY_OF_JANUARY,
                });

                it('puts each EffectiveDate in its own month', async () => {
                    const comp = render(await monthlySchedule());
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

                it('recognizes and releases through the business month, inclusive', async () => {
                    const comp = render(await monthlySchedule());
                    expect(comp.Rows[0].RecognizedToDate).toBe(100);
                    expect(comp.Summary.TotalRecognizedYTD).toBe(100);
                    expect(comp.Summary.MonthlyTotals.filter((m) => m.IsPastOrCurrent).map((m) => m.MonthKey)).toEqual(['2026-01']);
                    // What the template renders: each cell's IsPastOrCurrent and the year's ReleasedAmount.
                    expect(comp.YearGroups[0].Months.filter((m) => m.IsPastOrCurrent).map((m) => m.MonthKey)).toEqual(['2026-01']);
                    expect(comp.YearGroups[0].ReleasedAmount).toBe(100);
                });

                it('places an undated entry by its creation instant on the business calendar', async () => {
                    // 2026-03-01T02:00Z is 20:00 CST on 28 February in the business zone.
                    const comp = render([
                        await mockEntry({
                            EntryNumber: '2000',
                            EffectiveDate: null,
                            CreatedAt: new Date('2026-03-01T02:00:00.000Z'),
                            LinkedRecordID: 'sub-term-1',
                            Description: 'Monthly Subscription Rev Rec',
                            CreditAmount: 500,
                        }),
                    ]);
                    expect(comp.MonthHeaders[0].Key).toBe('2026-02');
                    expect(comp.Rows[0].MonthlyCells.find((c) => c.MonthKey === '2026-02')?.Amount).toBe(500);
                });
            });
        }
    });
});
