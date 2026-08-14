import { describe, it, expect } from 'vitest';
import type { SimpleChange } from '@angular/core';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { DeferredRevenueWaterfallComponent } from '../lib/components/deferred-revenue-waterfall/deferred-revenue-waterfall.component';

describe('DeferredRevenueWaterfallComponent', () => {
    it('initializes with default state', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        expect(comp.Rows.length).toBe(0);
        expect(comp.Summary.TotalDeferredBeginning).toBe(0);
        expect(comp.Summary.TotalRecognizedYTD).toBe(0);
    });

    it('aggregates and buckets revenue recognition journal entries accurately', () => {
        const comp = new DeferredRevenueWaterfallComponent();

        const today = new Date();
        const curYear = today.getFullYear();
        const curMonth = today.getMonth();

        const m0Date = new Date(curYear, curMonth, 15);
        const m1Date = new Date(curYear, curMonth + 1, 15);
        const m2Date = new Date(curYear, curMonth + 2, 15);

        const mockJEs: mjBizAppsAccountingJournalEntryEntity[] = [
            {
                ID: 'je-1',
                LinkedRecordID: 'sub-term-1',
                EffectiveDate: m0Date,
                TotalCredits: 100,
                Description: 'Monthly SaaS Rev-Rec M0',
            } as unknown as mjBizAppsAccountingJournalEntryEntity,
            {
                ID: 'je-2',
                LinkedRecordID: 'sub-term-1',
                EffectiveDate: m1Date,
                TotalCredits: 100,
                Description: 'Monthly SaaS Rev-Rec M1',
            } as unknown as mjBizAppsAccountingJournalEntryEntity,
            {
                ID: 'je-3',
                LinkedRecordID: 'sub-term-1',
                EffectiveDate: m2Date,
                TotalCredits: 100,
                Description: 'Monthly SaaS Rev-Rec M2',
            } as unknown as mjBizAppsAccountingJournalEntryEntity,
        ];

        comp.JournalEntries = mockJEs;
        comp.ngOnChanges({
            JournalEntries: {
                currentValue: mockJEs,
                previousValue: [],
                firstChange: true,
                isFirstChange: () => true,
            } as SimpleChange,
        });

        expect(comp.Rows.length).toBe(1);
        const row = comp.Rows[0];
        expect(row.OriginID).toBe('sub-term-1');
        expect(row.ContractValue).toBe(300);

        // Adaptive Single-Row Mode activates when only 1 item exists
        expect(comp.IsSingleItem).toBe(true);

        // First month is current month -> recognized; subsequent months -> unearned
        expect(row.RecognizedToDate).toBe(100);
        expect(row.RemainingUnearned).toBe(200);
        expect(comp.Summary.TotalRemainingUnearned).toBe(200);
        expect(comp.Summary.TotalRecognizedYTD).toBe(100);
    });

    it('emits JournalEntrySelected on cell click', () => {
        const comp = new DeferredRevenueWaterfallComponent();
        let selectedJE: mjBizAppsAccountingJournalEntryEntity | null = null;
        comp.JournalEntrySelected.subscribe((je: mjBizAppsAccountingJournalEntryEntity) => {
            selectedJE = je;
        });

        const mockJE = { ID: 'je-test-1', Description: 'Test JE' } as unknown as mjBizAppsAccountingJournalEntryEntity;
        comp.OnCellClick({
            MonthKey: '2026-08',
            MonthLabel: 'Aug 26',
            Amount: 100,
            IsPastOrCurrent: true,
            JournalEntry: mockJE,
        });

        expect(selectedJE).toBe(mockJE);
    });
});
