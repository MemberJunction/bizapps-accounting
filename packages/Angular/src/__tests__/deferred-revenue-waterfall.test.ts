import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FromCalendarDay } from '@mj-biz-apps/common-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import type { mjBizAppsAccountingAccountingCompanyProfileEntity } from '@mj-biz-apps/accounting-entities';
import { DeferredRevenueWaterfallComponent } from '../lib/components/deferred-revenue-waterfall/deferred-revenue-waterfall.component';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { useBusinessClock } from './support/business-clock';
import { entityObject, installStubProvider, stubEntityInfo } from './support/entity-stubs';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

beforeEach(() => {
    installStubProvider([
        stubEntityInfo(JE_ENTITY, [
            'ID', 'CompanyID', 'EntryNumber', 'EffectiveDate', 'LinkedRecordID', 'Description', '__mj_CreatedAt',
            'ReversesJournalEntryID', 'ReversedByJournalEntryID',
        ]),
        stubEntityInfo(JEL_ENTITY, ['ID', 'JournalEntryID', 'DebitAmount', 'CreditAmount']),
    ]);
    useCompanyProfiles([]);
});

afterEach(() => {
    vi.restoreAllMocks();
});

/**
 * Holds `AccountingEngineBase` as loaded with the given profiles' fiscal-year starts, so year-to-date
 * reads them with no IMetadataProvider. Returns the `Config` spy.
 */
function useCompanyProfiles(
    profiles: Array<{ ID: string; FiscalYearStartMonth: number; FiscalYearStartDay: number }>,
    loaded = true,
) {
    const engine = AccountingEngineBase.Instance;
    vi.spyOn(engine, 'Loaded', 'get').mockReturnValue(loaded);
    vi.spyOn(engine, 'CompanyProfiles', 'get').mockReturnValue(
        profiles as unknown as mjBizAppsAccountingAccountingCompanyProfileEntity[],
    );
    return vi.spyOn(engine, 'Config').mockResolvedValue(undefined);
}

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
    CompanyID?: string;
    ReversesJournalEntryID?: string;
    ReversedByJournalEntryID?: string;
}): Promise<mjBizAppsAccountingJournalEntryEntity> {
    const entry = await entityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY);
    entry.NewRecord();
    if (fields.CompanyID) entry.CompanyID = fields.CompanyID;
    entry.EntryNumber = fields.EntryNumber;
    if (fields.EffectiveDate) entry.EffectiveDate = fields.EffectiveDate;
    if (fields.CreatedAt) entry.Set('__mj_CreatedAt', fields.CreatedAt);
    entry.LinkedRecordID = fields.LinkedRecordID;
    entry.Description = fields.Description;
    if (fields.ReversesJournalEntryID) entry.ReversesJournalEntryID = fields.ReversesJournalEntryID;
    if (fields.ReversedByJournalEntryID) entry.ReversedByJournalEntryID = fields.ReversedByJournalEntryID;

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

    it('formats money correctly', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        expect(comp.FormatMoney(1200)).toBe('$1,200.00');
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
                    expect(comp.Summary.TotalRecognizedToDate).toBe(100);
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

                it('recognizes an entry on its day, not from the start of its month', async () => {
                    // The business day is 31 January: the 31st is recognized, a February entry is not.
                    const comp = render([
                        await mockEntry({
                            EntryNumber: '3001',
                            EffectiveDate: FromCalendarDay('2026-01-31'),
                            LinkedRecordID: 'sub-term-1',
                            Description: 'Monthly Subscription Rev Rec',
                            CreditAmount: 100,
                        }),
                        await mockEntry({
                            EntryNumber: '3002',
                            EffectiveDate: FromCalendarDay('2026-02-28'),
                            LinkedRecordID: 'sub-term-1',
                            Description: 'Monthly Subscription Rev Rec',
                            CreditAmount: 200,
                        }),
                    ]);
                    expect(comp.Rows[0].RecognizedToDate).toBe(100);
                    expect(comp.Rows[0].RemainingUnearned).toBe(200);
                });
            });
        }
    });

    describe('recognition by day within the current month', () => {
        useBusinessClock({
            BusinessZone: 'America/Chicago',
            BusinessSqlZone: 'Central Standard Time',
            MachineZone: 'America/Los_Angeles',
            // 18:00 CST on 15 January.
            Instant: new Date('2026-01-16T00:00:00.000Z'),
        });

        it('holds a forward-dated entry in the current month until its day', async () => {
            const entries = [
                await mockEntry({
                    EntryNumber: '4001',
                    EffectiveDate: FromCalendarDay('2026-01-15'),
                    LinkedRecordID: 'sub-term-1',
                    Description: 'Monthly Subscription Rev Rec',
                    CreditAmount: 100,
                }),
                await mockEntry({
                    EntryNumber: '4002',
                    EffectiveDate: FromCalendarDay('2026-01-30'),
                    LinkedRecordID: 'sub-term-2',
                    Description: 'Monthly Subscription Rev Rec',
                    CreditAmount: 250,
                }),
            ];
            const comp = new DeferredRevenueWaterfallComponent();
            comp.JournalEntries = entries;
            comp.ngOnChanges({
                JournalEntries: { currentValue: entries, previousValue: [], firstChange: true, isFirstChange: () => true },
            });

            expect(comp.Summary.TotalRecognizedToDate).toBe(100);
            expect(comp.Summary.TotalRemainingUnearned).toBe(250);
            const january = comp.YearGroups[0].Months.find((m) => m.MonthKey === '2026-01');
            expect(january?.Amount).toBe(350);
            expect(january?.RecognizedAmount).toBe(100);
            expect(comp.YearGroups[0].ReleasedAmount).toBe(100);
        });
    });

    describe('reversals', () => {
        useBusinessClock({
            BusinessZone: 'America/Chicago',
            BusinessSqlZone: 'Central Standard Time',
            MachineZone: 'America/Los_Angeles',
            Instant: LAST_BUSINESS_DAY_OF_JANUARY,
        });

        function render(entries: mjBizAppsAccountingJournalEntryEntity[]): DeferredRevenueWaterfallComponent {
            const comp = new DeferredRevenueWaterfallComponent();
            comp.JournalEntries = entries;
            comp.ngOnChanges({
                JournalEntries: { currentValue: entries, previousValue: [], firstChange: true, isFirstChange: () => true },
            });
            return comp;
        }

        async function standing(): Promise<mjBizAppsAccountingJournalEntryEntity> {
            return mockEntry({
                EntryNumber: '5001',
                EffectiveDate: FromCalendarDay('2026-01-01'),
                LinkedRecordID: 'sub-term-1',
                Description: 'Monthly Subscription Rev Rec',
                CreditAmount: 100,
            });
        }

        it('leaves out an entry that has been reversed', async () => {
            const comp = render([
                await standing(),
                await mockEntry({
                    EntryNumber: '5002',
                    EffectiveDate: FromCalendarDay('2026-01-01'),
                    LinkedRecordID: 'sub-term-1',
                    Description: 'Monthly Subscription Rev Rec',
                    CreditAmount: 400,
                    ReversedByJournalEntryID: 'reversal-1',
                }),
            ]);
            expect(comp.Summary.TotalDeferredBeginning).toBe(100);
            expect(comp.Summary.TotalRecognizedToDate).toBe(100);
        });

        it('leaves out a reversal entry passed in with its original', async () => {
            const comp = render([
                await standing(),
                await mockEntry({
                    EntryNumber: '5003',
                    EffectiveDate: FromCalendarDay('2026-01-10'),
                    LinkedRecordID: 'sub-term-1',
                    Description: 'Reversal of 5001: recognize in error',
                    CreditAmount: 100,
                    ReversesJournalEntryID: 'original-1',
                }),
            ]);
            expect(comp.Summary.TotalDeferredBeginning).toBe(100);
            expect(comp.Summary.TotalRecognizedToDate).toBe(100);
        });
    });

    describe('recognized year to date', () => {
        // The business day is 31 January 2026 (see LAST_BUSINESS_DAY_OF_JANUARY).
        useBusinessClock({
            BusinessZone: 'America/Chicago',
            BusinessSqlZone: 'Central Standard Time',
            MachineZone: 'America/Los_Angeles',
            Instant: LAST_BUSINESS_DAY_OF_JANUARY,
        });

        const JULY_START_COMPANY = 'company-july-start';
        const NO_PROFILE_COMPANY = 'company-no-profile';

        function render(entries: mjBizAppsAccountingJournalEntryEntity[]): DeferredRevenueWaterfallComponent {
            const comp = new DeferredRevenueWaterfallComponent();
            comp.JournalEntries = entries;
            comp.ngOnChanges({
                JournalEntries: { currentValue: entries, previousValue: [], firstChange: true, isFirstChange: () => true },
            });
            return comp;
        }

        async function entry(day: string, amount: number, companyId: string, term = 'sub-term-1') {
            return mockEntry({
                EntryNumber: `${day}-${amount}`,
                EffectiveDate: FromCalendarDay(day),
                LinkedRecordID: term,
                Description: 'Monthly Subscription Rev Rec',
                CreditAmount: amount,
                CompanyID: companyId,
            });
        }

        it('counts from 1 January through today when the company has no profile', async () => {
            const comp = render([
                await entry('2025-12-31', 1, NO_PROFILE_COMPANY),
                await entry('2026-01-01', 10, NO_PROFILE_COMPANY),
                await entry('2026-01-31', 100, NO_PROFILE_COMPANY),
                await entry('2026-02-01', 1000, NO_PROFILE_COMPANY),
            ]);
            expect(comp.Summary.TotalRecognizedToDate).toBe(111);
            expect(comp.Summary.TotalRecognizedYTD).toBe(110);
            expect(comp.Rows[0].RecognizedYTD).toBe(110);
        });

        it("starts at the company's fiscal-year start, not 1 January", async () => {
            useCompanyProfiles([{ ID: JULY_START_COMPANY, FiscalYearStartMonth: 7, FiscalYearStartDay: 1 }]);
            const comp = render([
                await entry('2025-06-30', 1, JULY_START_COMPANY),
                await entry('2025-07-01', 10, JULY_START_COMPANY),
                await entry('2026-01-15', 100, JULY_START_COMPANY),
                await entry('2026-02-15', 1000, JULY_START_COMPANY),
            ]);
            expect(comp.Summary.TotalRecognizedToDate).toBe(111);
            expect(comp.Summary.TotalRecognizedYTD).toBe(110);
        });

        it("applies each entry's own company's start", async () => {
            useCompanyProfiles([{ ID: JULY_START_COMPANY, FiscalYearStartMonth: 7, FiscalYearStartDay: 1 }]);
            const comp = render([
                await entry('2025-08-01', 10, JULY_START_COMPANY, 'sub-term-1'),
                await entry('2025-08-01', 100, NO_PROFILE_COMPANY, 'sub-term-2'),
            ]);
            expect(comp.Rows.map((r) => r.RecognizedYTD)).toEqual([10, 0]);
            expect(comp.Summary.TotalRecognizedYTD).toBe(10);
        });

        it('loads the engine once and recomputes when it has not loaded yet', async () => {
            const config = useCompanyProfiles([], false);
            const comp = render([await entry('2026-01-10', 10, NO_PROFILE_COMPANY)]);
            expect(config).toHaveBeenCalledTimes(1);
            await config.mock.results[0].value;
            await Promise.resolve();
            expect(comp.Summary.TotalRecognizedYTD).toBe(10);
            expect(config).toHaveBeenCalledTimes(1);
        });
    });
});
