import { describe, expect, it, beforeEach } from 'vitest';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { entityObject, installStubProvider, stubEntityInfo } from './support/entity-stubs';
import { DeferredRevenueWaterfallComponent } from '../lib/components/deferred-revenue-waterfall/deferred-revenue-waterfall.component';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

beforeEach(() => {
    installStubProvider([
        stubEntityInfo(JE_ENTITY, ['ID', 'EntryNumber', 'EffectiveDate', 'LinkedRecordID', 'Description']),
        stubEntityInfo(JEL_ENTITY, ['ID', 'JournalEntryID', 'DebitAmount', 'CreditAmount']),
    ]);
});

/** A real entity with one credit line: the component takes entities, so the spec hands it entities. */
async function mockEntry(fields: {
    EntryNumber: string;
    EffectiveDate: Date;
    LinkedRecordID: string;
    Description: string;
    CreditAmount: number;
}): Promise<mjBizAppsAccountingJournalEntryEntity> {
    const entry = await entityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY);
    entry.NewRecord();
    entry.EntryNumber = fields.EntryNumber;
    entry.EffectiveDate = fields.EffectiveDate;
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
                EffectiveDate: new Date(2026, i - 1, 1),
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
});
