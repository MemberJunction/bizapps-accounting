import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import type { mjBizAppsAccountingJournalEntryEntity, mjBizAppsAccountingJournalEntryLineEntity } from '@mj-biz-apps/accounting-entities';

/** A single month's release cell in the waterfall */
export interface WaterfallMonthCell {
    MonthKey: string; // e.g. "2026-01"
    MonthLabel: string; // e.g. "Jan '26"
    MonthShort: string; // e.g. "Jan"
    Year: string; // e.g. "2026"
    Amount: number;
    IsPastOrCurrent: boolean;
    JournalEntry?: mjBizAppsAccountingJournalEntryEntity;
    TermLabel?: string;
    TermIndex?: number;
}

/** Group of monthly cells by calendar year */
export interface WaterfallYearGroup {
    Year: string;
    TotalAmount: number;
    ReleasedAmount: number;
    Months: WaterfallMonthCell[];
}

/** One row in the waterfall matrix (representing a contract, subscription term, or cohort) */
export interface WaterfallRow {
    OriginID: string;
    OriginLabel: string;
    TermNumber?: number;
    TermIndex: number;
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
 * 1. Multi-Cohort Waterfall Matrix: 12-month+ forward rollforward matrix.
 * 2. Multi-Term Color-Coding: Assigns distinct color accents to each term.
 * 3. Year Groupings & Timelines: Cleanly partitions multi-year schedules with year headers.
 * 4. Adaptive Single-Item Mode: Progressive cards with term indicators & JE drill-downs.
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
    @Input() public TermLookup: { [termId: string]: { TermNumber: number; Label?: string } } = {};

    @Output() public JournalEntrySelected = new EventEmitter<mjBizAppsAccountingJournalEntryEntity>();

    public Rows: WaterfallRow[] = [];
    public YearGroups: WaterfallYearGroup[] = [];
    public DistinctTerms: { ID: string; Label: string; TermNumber: number; TermIndex: number; ColorClass: string }[] = [];

    public Summary: WaterfallSummary = {
        TotalDeferredBeginning: 0,
        TotalRecognizedYTD: 0,
        TotalRemainingUnearned: 0,
        MonthlyRunRate: 0,
        PercentRecognized: 0,
        MonthlyTotals: [],
    };
    public MonthHeaders: { Key: string; Label: string; Year: string }[] = [];

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['JournalEntries'] || changes['TermLookup']) {
            this.recalculateWaterfall();
        }
    }

    public get IsSingleItem(): boolean {
        return this.ForceSingleItemMode || this.Rows.length <= 1;
    }

    public get HasMultipleTerms(): boolean {
        return this.DistinctTerms.length > 1;
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

    public GetTermBadgeClass(termIndex: number): string {
        const mod = (termIndex % 5) + 1;
        return `mja-term-badge--t${mod}`;
    }

    private resolveEntryAmount(je: mjBizAppsAccountingJournalEntryEntity): number {
        // 1. If Lines collection is loaded (array or RelatedRecordCollection), sum credit or debit lines
        const lines = (je as unknown as { Lines?: { Items?: mjBizAppsAccountingJournalEntryLineEntity[] } | mjBizAppsAccountingJournalEntryLineEntity[] }).Lines;
        const lineItems: mjBizAppsAccountingJournalEntryLineEntity[] = Array.isArray(lines)
            ? lines
            : (lines && Array.isArray(lines.Items) ? lines.Items : []);

        if (lineItems.length > 0) {
            let crSum = 0;
            let drSum = 0;
            for (const line of lineItems) {
                if (line.CreditAmount != null && line.CreditAmount > 0) {
                    crSum += Number(line.CreditAmount);
                }
                if (line.DebitAmount != null && line.DebitAmount > 0) {
                    drSum += Number(line.DebitAmount);
                }
            }
            if (crSum > 0) return crSum;
            if (drSum > 0) return drSum;
        }

        // 2. Check dynamic projection or attached values
        const rawAny = je as unknown as { TotalCredits?: number; TotalDebits?: number; Amount?: number; ReleaseAmount?: number };
        if (rawAny.Amount != null && rawAny.Amount > 0) return Number(rawAny.Amount);
        if (rawAny.ReleaseAmount != null && rawAny.ReleaseAmount > 0) return Number(rawAny.ReleaseAmount);
        if (rawAny.TotalCredits != null && rawAny.TotalCredits > 0) return Number(rawAny.TotalCredits);
        if (rawAny.TotalDebits != null && rawAny.TotalDebits > 0) return Number(rawAny.TotalDebits);
        return 0;
    }

    private recalculateWaterfall(): void {
        if (!this.JournalEntries || this.JournalEntries.length === 0) {
            this.Rows = [];
            this.YearGroups = [];
            this.DistinctTerms = [];
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

        // Filter for revenue recognition entries (if booking entries are also present, prefer recognition entries)
        const hasRecognitionEntries = this.JournalEntries.some(je => {
            const desc = (je.Description || '').toLowerCase();
            const typeStr = (je.EntryType || '').toLowerCase();
            return desc.includes('recognize') || typeStr.includes('recognition');
        });

        const activeEntries = hasRecognitionEntries
            ? this.JournalEntries.filter(je => {
                const desc = (je.Description || '').toLowerCase();
                const typeStr = (je.EntryType || '').toLowerCase();
                return desc.includes('recognize') || typeStr.includes('recognition');
            })
            : this.JournalEntries;

        // Build distinct terms list
        const termOriginKeys = new Set<string>();
        for (const je of activeEntries) {
            if (je.LinkedRecordID) termOriginKeys.add(String(je.LinkedRecordID));
        }

        const sortedTermOrigins = Array.from(termOriginKeys);
        this.DistinctTerms = sortedTermOrigins.map((termId, idx) => {
            const lookup = this.TermLookup[termId.toLowerCase()] || this.TermLookup[termId.toUpperCase()];
            const termNumber = lookup?.TermNumber ?? (idx + 1);
            const label = lookup?.Label || `Term ${termNumber}`;
            return {
                ID: termId,
                Label: label,
                TermNumber: termNumber,
                TermIndex: idx,
                ColorClass: this.GetTermBadgeClass(idx),
            };
        });

        // Determine date range across active entries
        const dates: Date[] = [];
        for (const je of activeEntries) {
            const dateVal = je.EffectiveDate || je.__mj_CreatedAt;
            if (dateVal) {
                dates.push(new Date(dateVal));
            }
        }

        const now = new Date();
        const sortedDates = dates.length > 0 ? [...dates].sort((a, b) => a.getTime() - b.getTime()) : [now];
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];

        // Generate rolling month headers starting from minDate month, for at least 12 months
        const startMonthDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const endMonthDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

        let totalMonths = (endMonthDate.getFullYear() - startMonthDate.getFullYear()) * 12 + (endMonthDate.getMonth() - startMonthDate.getMonth()) + 1;
        if (totalMonths < 12) totalMonths = 12;

        this.MonthHeaders = [];
        for (let i = 0; i < totalMonths; i++) {
            const d = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const key = `${y}-${String(m).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short' }) + ` '${String(y).slice(2)}`;
            this.MonthHeaders.push({ Key: key, Label: label, Year: String(y) });
        }

        // Group entries by Origin (SubscriptionTerm ID or Description)
        const groups = new Map<string, { label: string; termNumber?: number; termIndex: number; entries: mjBizAppsAccountingJournalEntryEntity[] }>();
        for (const je of activeEntries) {
            const originKey = String(je.LinkedRecordID || je.ID || 'default');
            const termMeta = this.DistinctTerms.find(t => t.ID.toLowerCase() === originKey.toLowerCase());
            const termIndex = termMeta ? termMeta.TermIndex : groups.size;
            const originLabel = termMeta?.Label || je.Description || (je.EntryNumber ? `Entry #${je.EntryNumber}` : 'Revenue Recognition Schedule');
            
            const existing = groups.get(originKey);
            if (existing) {
                existing.entries.push(je);
            } else {
                groups.set(originKey, {
                    label: originLabel,
                    termNumber: termMeta?.TermNumber,
                    termIndex: termIndex,
                    entries: [je],
                });
            }
        }

        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const rows: WaterfallRow[] = [];

        let grandDeferred = 0;
        let grandRecognized = 0;
        let grandUnearned = 0;

        const monthTotalsMap = new Map<string, number>();
        this.MonthHeaders.forEach(mh => monthTotalsMap.set(mh.Key, 0));

        // Combined monthly cells across all terms for timeline / year grouping
        const aggregatedMonthlyCells: WaterfallMonthCell[] = this.MonthHeaders.map(mh => {
            const [y, mStr] = mh.Key.split('-');
            const d = new Date(Number(y), Number(mStr) - 1, 1);
            return {
                MonthKey: mh.Key,
                MonthLabel: mh.Label,
                MonthShort: d.toLocaleDateString('en-US', { month: 'short' }),
                Year: y,
                Amount: 0,
                IsPastOrCurrent: mh.Key <= todayKey,
                JournalEntry: undefined,
            };
        });

        for (const [originId, group] of groups.entries()) {
            const monthlyCells: WaterfallMonthCell[] = this.MonthHeaders.map(mh => {
                const [y, mStr] = mh.Key.split('-');
                const d = new Date(Number(y), Number(mStr) - 1, 1);
                return {
                    MonthKey: mh.Key,
                    MonthLabel: mh.Label,
                    MonthShort: d.toLocaleDateString('en-US', { month: 'short' }),
                    Year: y,
                    Amount: 0,
                    IsPastOrCurrent: mh.Key <= todayKey,
                    JournalEntry: undefined,
                    TermLabel: group.label,
                    TermIndex: group.termIndex,
                };
            });

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

                // Update aggregated timeline cells
                const aggCell = aggregatedMonthlyCells.find(c => c.MonthKey === mKey);
                if (aggCell) {
                    aggCell.Amount += amt;
                    aggCell.JournalEntry = je;
                    aggCell.TermLabel = group.label;
                    aggCell.TermIndex = group.termIndex;
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
                TermNumber: group.termNumber,
                TermIndex: group.termIndex,
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

        // Partition into Year Groups for clean multi-year display
        const yearMap = new Map<string, WaterfallMonthCell[]>();
        for (const cell of aggregatedMonthlyCells) {
            const list = yearMap.get(cell.Year) ?? [];
            list.push(cell);
            yearMap.set(cell.Year, list);
        }

        this.YearGroups = Array.from(yearMap.entries()).map(([year, months]) => {
            const totalAmt = months.reduce((sum, m) => sum + m.Amount, 0);
            const releasedAmt = months.filter(m => m.IsPastOrCurrent).reduce((sum, m) => sum + m.Amount, 0);
            return {
                Year: year,
                TotalAmount: totalAmt,
                ReleasedAmount: releasedAmt,
                Months: months,
            };
        });

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
                MonthShort: mh.Label.split(' ')[0],
                Year: mh.Year,
                Amount: monthTotalsMap.get(mh.Key) || 0,
                IsPastOrCurrent: mh.Key <= todayKey,
            })),
        };
    }
}
