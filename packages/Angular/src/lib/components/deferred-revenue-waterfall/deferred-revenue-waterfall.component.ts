import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';

/** A single month's release cell in the waterfall */
export interface WaterfallMonthCell {
    MonthKey: string; // e.g. "2026-01"
    MonthLabel: string; // e.g. "Jan '26"
    Amount: number;
    IsPastOrCurrent: boolean;
    JournalEntry?: mjBizAppsAccountingJournalEntryEntity;
}

/** One row in the waterfall matrix (representing a contract, subscription term, or cohort) */
export interface WaterfallRow {
    OriginID: string;
    OriginLabel: string;
    ContractValue: number;
    DeferredBeginning: number;
    RecognizedToDate: number;
    RemainingUnearned: number;
    MonthlyCells: WaterfallMonthCell[];
}

/** Summary statistics for the entire waterfall */
export interface WaterfallSummary {
    TotalDeferredBeginning: number;
    TotalRecognizedYTD: number;
    TotalRemainingUnearned: number;
    MonthlyRunRate: number;
    PercentRecognized: number;
    MonthlyTotals: WaterfallMonthCell[];
}

/**
 * Reusable Deferred Revenue Waterfall Component.
 *
 * Visualizes ASC 606 revenue recognition rollforwards from an array of
 * JournalEntry entity records.
 *
 * Capabilities:
 * 1. Multi-Cohort Waterfall Matrix: 12-month forward rollforward matrix.
 * 2. Adaptive Single-Item Mode: When rendering for a single subscription term,
 *    automatically expands into an interactive timeline progress card with
 *    monthly release chips.
 * 3. Journal Entry Drill-Down: Emits (JournalEntrySelected) with the clicked JE record.
 */
@Component({
    standalone: false,
    selector: 'mj-deferred-revenue-waterfall',
    templateUrl: './deferred-revenue-waterfall.component.html',
    styleUrls: ['./deferred-revenue-waterfall.component.css'],
})
export class DeferredRevenueWaterfallComponent implements OnChanges {
    @Input() public JournalEntries: mjBizAppsAccountingJournalEntryEntity[] = [];
    @Input() public Title: string = 'Deferred Revenue & Rev-Rec Schedule';
    @Input() public Currency: string = 'USD';
    @Input() public ForceSingleItemMode = false;

    @Output() public JournalEntrySelected = new EventEmitter<mjBizAppsAccountingJournalEntryEntity>();

    public Rows: WaterfallRow[] = [];
    public Summary: WaterfallSummary = {
        TotalDeferredBeginning: 0,
        TotalRecognizedYTD: 0,
        TotalRemainingUnearned: 0,
        MonthlyRunRate: 0,
        PercentRecognized: 0,
        MonthlyTotals: [],
    };
    public MonthHeaders: { Key: string; Label: string }[] = [];

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['JournalEntries']) {
            this.recalculateWaterfall();
        }
    }

    public get IsSingleItem(): boolean {
        return this.ForceSingleItemMode || this.Rows.length <= 1;
    }

    public OnCellClick(cell: WaterfallMonthCell): void {
        if (cell.JournalEntry) {
            this.JournalEntrySelected.emit(cell.JournalEntry);
        }
    }

    public FormatMoney(amount: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: this.Currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    public FormatCompact(amount: number): string {
        if (amount === 0) return '—';
        if (Math.abs(amount) >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        }
        if (Math.abs(amount) >= 1000) {
            return `$${(amount / 1000).toFixed(0)}k`;
        }
        return `$${amount.toFixed(0)}`;
    }

    private resolveEntryAmount(je: mjBizAppsAccountingJournalEntryEntity): number {
        // If Lines collection is loaded, sum credit lines (revenue credits)
        if (je.Lines && je.Lines.length > 0) {
            let crSum = 0;
            for (const line of je.Lines) {
                if (line.CreditAmount != null && line.CreditAmount > 0) {
                    crSum += Number(line.CreditAmount);
                }
            }
            if (crSum > 0) return crSum;
        }

        // Check if TotalCredits or Amount is attached dynamically via view projection
        const rawAny = je as unknown as { TotalCredits?: number; TotalDebits?: number; Amount?: number };
        if (rawAny.TotalCredits != null) return Number(rawAny.TotalCredits);
        if (rawAny.Amount != null) return Number(rawAny.Amount);
        if (rawAny.TotalDebits != null) return Number(rawAny.TotalDebits);
        return 0;
    }

    private recalculateWaterfall(): void {
        if (!this.JournalEntries || this.JournalEntries.length === 0) {
            this.Rows = [];
            this.Summary = {
                TotalDeferredBeginning: 0,
                TotalRecognizedYTD: 0,
                TotalRemainingUnearned: 0,
                MonthlyRunRate: 0,
                PercentRecognized: 0,
                MonthlyTotals: [],
            };
            this.MonthHeaders = [];
            return;
        }

        // Determine date range across entries
        const dates: Date[] = [];
        for (const je of this.JournalEntries) {
            const dateVal = je.EffectiveDate || je.__mj_CreatedAt;
            if (dateVal) {
                dates.push(new Date(dateVal));
            }
        }

        const now = new Date();
        const startYear = dates.length ? Math.min(...dates.map(d => d.getFullYear())) : now.getFullYear();
        
        // Generate 12 standard month buckets for the active schedule year
        this.MonthHeaders = [];
        for (let m = 0; m < 12; m++) {
            const d = new Date(startYear, m, 1);
            const key = `${startYear}-${String(m + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short' }) + ` '${String(startYear).slice(2)}`;
            this.MonthHeaders.push({ Key: key, Label: label });
        }

        // Group entries by Origin (LinkedRecordID or Description)
        const groups = new Map<string, { label: string; entries: mjBizAppsAccountingJournalEntryEntity[] }>();
        for (const je of this.JournalEntries) {
            const originKey = String(je.LinkedRecordID || je.ID || 'default');
            const originLabel = je.Description || (je.EntryNumber ? `Entry #${je.EntryNumber}` : 'Revenue Recognition Schedule');
            const existing = groups.get(originKey);
            if (existing) {
                existing.entries.push(je);
            } else {
                groups.set(originKey, { label: originLabel, entries: [je] });
            }
        }

        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const rows: WaterfallRow[] = [];

        let grandDeferred = 0;
        let grandRecognized = 0;
        let grandUnearned = 0;

        const monthTotalsMap = new Map<string, number>();
        this.MonthHeaders.forEach(mh => monthTotalsMap.set(mh.Key, 0));

        for (const [originId, group] of groups.entries()) {
            const monthlyCells: WaterfallMonthCell[] = this.MonthHeaders.map(mh => ({
                MonthKey: mh.Key,
                MonthLabel: mh.Label,
                Amount: 0,
                IsPastOrCurrent: mh.Key <= todayKey,
                JournalEntry: undefined,
            }));

            let rowContractVal = 0;
            let rowRecognized = 0;

            for (const je of group.entries) {
                const dateVal = je.EffectiveDate || je.__mj_CreatedAt;
                const d = dateVal ? new Date(dateVal) : now;
                const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                
                // Calculate release amount
                const amt = this.resolveEntryAmount(je);
                rowContractVal += amt;

                const cell = monthlyCells.find(c => c.MonthKey === mKey);
                if (cell) {
                    cell.Amount += amt;
                    cell.JournalEntry = je;
                }

                if (mKey <= todayKey) {
                    rowRecognized += amt;
                }

                const currentMTotal = monthTotalsMap.get(mKey) || 0;
                monthTotalsMap.set(mKey, currentMTotal + amt);
            }

            const rowUnearned = Math.max(0, rowContractVal - rowRecognized);

            rows.push({
                OriginID: originId,
                OriginLabel: group.label,
                ContractValue: rowContractVal,
                DeferredBeginning: rowContractVal,
                RecognizedToDate: rowRecognized,
                RemainingUnearned: rowUnearned,
                MonthlyCells: monthlyCells,
            });

            grandDeferred += rowContractVal;
            grandRecognized += rowRecognized;
            grandUnearned += rowUnearned;
        }

        this.Rows = rows;
        const totalMonthsWithAmt = Array.from(monthTotalsMap.values()).filter(v => v > 0).length || 1;
        const monthlyRunRate = grandDeferred / totalMonthsWithAmt;

        this.Summary = {
            TotalDeferredBeginning: grandDeferred,
            TotalRecognizedYTD: grandRecognized,
            TotalRemainingUnearned: grandUnearned,
            MonthlyRunRate: monthlyRunRate,
            PercentRecognized: grandDeferred > 0 ? (grandRecognized / grandDeferred) * 100 : 0,
            MonthlyTotals: this.MonthHeaders.map(mh => ({
                MonthKey: mh.Key,
                MonthLabel: mh.Label,
                Amount: monthTotalsMap.get(mh.Key) || 0,
                IsPastOrCurrent: mh.Key <= todayKey,
            })),
        };
    }
}
