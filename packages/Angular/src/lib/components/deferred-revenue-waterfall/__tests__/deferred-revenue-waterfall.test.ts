import { describe, expect, it } from 'vitest';
import { DeferredRevenueWaterfallComponent } from '../deferred-revenue-waterfall.component';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';

describe('DeferredRevenueWaterfallComponent', () => {
    it('computes summary statistics for an array of Journal Entries', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        
        // Mock 12 months of JEs for a $1,200 annual subscription
        const entries: mjBizAppsAccountingJournalEntryEntity[] = [];
        for (let i = 1; i <= 12; i++) {
            entries.push({
                ID: `je-${i}`,
                EntryNumber: String(1000 + i),
                EffectiveDate: new Date(2026, i - 1, 1),
                TotalCredits: 100,
                TotalDebits: 100,
                LinkedRecordID: 'sub-term-1',
                Description: 'Monthly Subscription Rev Rec',
            } as unknown as mjBizAppsAccountingJournalEntryEntity);
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
