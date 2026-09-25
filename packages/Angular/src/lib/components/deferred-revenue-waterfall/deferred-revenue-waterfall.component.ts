import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import type {
    mjBizAppsAccountingJournalEntryEntity,
    mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import { BusinessTimeZoneEngine, CalendarDayIn, ToCalendarDay } from '@mj-biz-apps/common-entities';

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

export interface WaterfallTermChip {
    ID: string;
    Label: string;
    TermNumber: number;
    TermIndex: number;
    ColorClass: string;
}

interface OriginGroup {
    label: string;
    termNumber?: number;
    termIndex: number;
    entries: mjBizAppsAccountingJournalEntryEntity[];
}

interface MonthHeader {
    Key: string;
    Label: string;
    Year: string;
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
    public DistinctTerms: WaterfallTermChip[] = [];

    public Summary: WaterfallSummary = emptySummary();
    public MonthHeaders: MonthHeader[] = [];

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

    private recalculateWaterfall(): void {
        if (!this.JournalEntries || this.JournalEntries.length === 0) {
            this.resetEmpty();
            return;
        }

        const activeEntries = selectActiveEntries(this.JournalEntries);
        this.DistinctTerms = this.buildDistinctTerms(activeEntries);
        const todayKey = currentMonthKey();
        this.MonthHeaders = buildMonthHeaders(collectMonthKeys(activeEntries), todayKey);

        const groups = this.groupEntriesByOrigin(activeEntries);
        const aggregated = this.emptyMonthlyCells(todayKey);
        const monthTotalsMap = new Map<string, number>();
        this.MonthHeaders.forEach((mh) => monthTotalsMap.set(mh.Key, 0));

        this.Rows = this.buildRows(groups, aggregated, monthTotalsMap, todayKey);
        this.YearGroups = buildYearGroups(aggregated);
        this.Summary = buildSummary(this.Rows, this.MonthHeaders, monthTotalsMap, todayKey);
    }

    private resetEmpty(): void {
        this.Rows = [];
        this.YearGroups = [];
        this.DistinctTerms = [];
        this.Summary = emptySummary();
        this.MonthHeaders = [];
    }

    private buildDistinctTerms(entries: mjBizAppsAccountingJournalEntryEntity[]): WaterfallTermChip[] {
        const termOriginKeys = new Set<string>();
        for (const je of entries) {
            if (je.LinkedRecordID) termOriginKeys.add(String(je.LinkedRecordID));
        }

        return Array.from(termOriginKeys).map((termId, idx) => {
            const lookup = this.TermLookup[termId.toLowerCase()] || this.TermLookup[termId.toUpperCase()];
            const termNumber = lookup?.TermNumber ?? idx + 1;
            return {
                ID: termId,
                Label: lookup?.Label || `Term ${termNumber}`,
                TermNumber: termNumber,
                TermIndex: idx,
                ColorClass: this.GetTermBadgeClass(idx),
            };
        });
    }

    private groupEntriesByOrigin(entries: mjBizAppsAccountingJournalEntryEntity[]): Map<string, OriginGroup> {
        const groups = new Map<string, OriginGroup>();
        for (const je of entries) {
            const originKey = String(je.LinkedRecordID || je.ID || 'default');
            const termMeta = this.DistinctTerms.find((t) => t.ID.toLowerCase() === originKey.toLowerCase());
            const existing = groups.get(originKey);
            if (existing) {
                existing.entries.push(je);
                continue;
            }
            groups.set(originKey, {
                label:
                    termMeta?.Label ||
                    je.Description ||
                    (je.EntryNumber ? `Entry #${je.EntryNumber}` : 'Revenue Recognition Schedule'),
                termNumber: termMeta?.TermNumber,
                termIndex: termMeta ? termMeta.TermIndex : groups.size,
                entries: [je],
            });
        }
        return groups;
    }

    private emptyMonthlyCells(todayKey: string, group?: OriginGroup): WaterfallMonthCell[] {
        return this.MonthHeaders.map((mh) => {
            return {
                MonthKey: mh.Key,
                MonthLabel: mh.Label,
                MonthShort: monthShort(mh.Key),
                Year: mh.Year,
                Amount: 0,
                IsPastOrCurrent: mh.Key <= todayKey,
                JournalEntry: undefined,
                TermLabel: group?.label,
                TermIndex: group?.termIndex,
            };
        });
    }

    private buildRows(
        groups: Map<string, OriginGroup>,
        aggregated: WaterfallMonthCell[],
        monthTotalsMap: Map<string, number>,
        todayKey: string,
    ): WaterfallRow[] {
        const rows: WaterfallRow[] = [];
        for (const [originId, group] of groups.entries()) {
            rows.push(this.buildRow(originId, group, aggregated, monthTotalsMap, todayKey));
        }
        return rows;
    }

    private buildRow(
        originId: string,
        group: OriginGroup,
        aggregated: WaterfallMonthCell[],
        monthTotalsMap: Map<string, number>,
        todayKey: string,
    ): WaterfallRow {
        const monthlyCells = this.emptyMonthlyCells(todayKey, group);
        let rowContractVal = 0;
        let rowRecognized = 0;

        for (const je of group.entries) {
            const mKey = entryMonthKey(je) ?? todayKey;
            const amt = resolveEntryAmount(je);
            rowContractVal += amt;
            addAmountToCell(monthlyCells.find((c) => c.MonthKey === mKey), amt, je);
            addAmountToCell(aggregated.find((c) => c.MonthKey === mKey), amt, je, group);
            if (mKey <= todayKey) {
                rowRecognized += amt;
            }
            monthTotalsMap.set(mKey, (monthTotalsMap.get(mKey) || 0) + amt);
        }

        return {
            OriginID: originId,
            OriginLabel: group.label,
            TermNumber: group.termNumber,
            TermIndex: group.termIndex,
            ContractValue: rowContractVal,
            DeferredBeginning: rowContractVal,
            RecognizedToDate: rowRecognized,
            RemainingUnearned: Math.max(0, rowContractVal - rowRecognized),
            MonthlyCells: monthlyCells,
        };
    }
}

function emptySummary(): WaterfallSummary {
    return {
        TotalDeferredBeginning: 0,
        TotalRecognizedYTD: 0,
        TotalRemainingUnearned: 0,
        MonthlyRunRate: 0,
        PercentRecognized: 0,
        MonthlyTotals: [],
    };
}

/** The business month it is now (`YYYY-MM`), in the instance's business zone — never the browser's. */
function currentMonthKey(): string {
    return BusinessTimeZoneEngine.Instance.Today().slice(0, 7);
}

/**
 * The month (`YYYY-MM`) an entry recognizes in, or null when it carries no date.
 *
 * `EffectiveDate` is a `DATE` column: a calendar day held as UTC midnight, so it is read from its UTC
 * parts. The `__mj_CreatedAt` fallback is an instant, so it is placed on the business zone's calendar.
 */
function entryMonthKey(je: mjBizAppsAccountingJournalEntryEntity): string | null {
    const effectiveDay = ToCalendarDay(je.EffectiveDate);
    if (effectiveDay !== null) return effectiveDay.slice(0, 7);
    if (!je.__mj_CreatedAt) return null;
    const createdAt = new Date(je.__mj_CreatedAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return CalendarDayIn(createdAt, BusinessTimeZoneEngine.Instance.Zone).slice(0, 7);
}

function isRecognitionEntry(je: mjBizAppsAccountingJournalEntryEntity): boolean {
    const desc = (je.Description || '').toLowerCase();
    const typeStr = (je.EntryType || '').toLowerCase();
    return desc.includes('recognize') || typeStr.includes('recognition');
}

function selectActiveEntries(
    entries: mjBizAppsAccountingJournalEntryEntity[],
): mjBizAppsAccountingJournalEntryEntity[] {
    return entries.some(isRecognitionEntry) ? entries.filter(isRecognitionEntry) : entries;
}

function collectMonthKeys(entries: mjBizAppsAccountingJournalEntryEntity[]): string[] {
    const keys: string[] = [];
    for (const je of entries) {
        const key = entryMonthKey(je);
        if (key !== null) keys.push(key);
    }
    return keys;
}

/** A `YYYY-MM` key as a count of months, so ranges are integer arithmetic with no Date involved. */
function monthIndex(key: string): number {
    const [y, m] = key.split('-');
    return Number(y) * 12 + (Number(m) - 1);
}

function monthKeyFromIndex(index: number): string {
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

/** "Jan" for "2026-01". Formatted in UTC from UTC midnight, so the machine zone cannot move the month. */
function monthShort(key: string): string {
    const [y, m] = key.split('-');
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
    });
}

function buildMonthHeaders(monthKeys: string[], todayKey: string): MonthHeader[] {
    // Fixed-width `YYYY-MM` keys sort lexically in chronological order.
    const sortedKeys = monthKeys.length > 0 ? [...monthKeys].sort() : [todayKey];
    const startIndex = monthIndex(sortedKeys[0]);
    const endIndex = monthIndex(sortedKeys[sortedKeys.length - 1]);
    const totalMonths = Math.max(12, endIndex - startIndex + 1);

    const headers: MonthHeader[] = [];
    for (let i = 0; i < totalMonths; i++) {
        const key = monthKeyFromIndex(startIndex + i);
        const year = key.slice(0, 4);
        headers.push({ Key: key, Label: `${monthShort(key)} '${year.slice(2)}`, Year: year });
    }
    return headers;
}

function addAmountToCell(
    cell: WaterfallMonthCell | undefined,
    amt: number,
    je: mjBizAppsAccountingJournalEntryEntity,
    group?: OriginGroup,
): void {
    if (!cell) return;
    cell.Amount += amt;
    cell.JournalEntry = je;
    if (group) {
        cell.TermLabel = group.label;
        cell.TermIndex = group.termIndex;
    }
}

function buildYearGroups(aggregated: WaterfallMonthCell[]): WaterfallYearGroup[] {
    const yearMap = new Map<string, WaterfallMonthCell[]>();
    for (const cell of aggregated) {
        const list = yearMap.get(cell.Year) ?? [];
        list.push(cell);
        yearMap.set(cell.Year, list);
    }
    return Array.from(yearMap.entries()).map(([year, months]) => ({
        Year: year,
        TotalAmount: months.reduce((sum, m) => sum + m.Amount, 0),
        ReleasedAmount: months.filter((m) => m.IsPastOrCurrent).reduce((sum, m) => sum + m.Amount, 0),
        Months: months,
    }));
}

function buildSummary(
    rows: WaterfallRow[],
    monthHeaders: MonthHeader[],
    monthTotalsMap: Map<string, number>,
    todayKey: string,
): WaterfallSummary {
    const grandDeferred = rows.reduce((sum, r) => sum + r.DeferredBeginning, 0);
    const grandRecognized = rows.reduce((sum, r) => sum + r.RecognizedToDate, 0);
    const grandUnearned = rows.reduce((sum, r) => sum + r.RemainingUnearned, 0);
    const totalMonthsWithAmt = Array.from(monthTotalsMap.values()).filter((v) => v > 0).length || 1;
    return {
        TotalDeferredBeginning: grandDeferred,
        TotalRecognizedYTD: grandRecognized,
        TotalRemainingUnearned: grandUnearned,
        MonthlyRunRate: grandDeferred / totalMonthsWithAmt,
        PercentRecognized: grandDeferred > 0 ? (grandRecognized / grandDeferred) * 100 : 0,
        MonthlyTotals: monthHeaders.map((mh) => ({
            MonthKey: mh.Key,
            MonthLabel: mh.Label,
            MonthShort: mh.Label.split(' ')[0],
            Year: mh.Year,
            Amount: monthTotalsMap.get(mh.Key) || 0,
            IsPastOrCurrent: mh.Key <= todayKey,
        })),
    };
}

function lineItemsOf(je: mjBizAppsAccountingJournalEntryEntity): mjBizAppsAccountingJournalEntryLineEntity[] {
    const lines = je.Lines;
    if (lines == null || !lines.IsAvailable) {
        return [];
    }
    return [...lines.Items];
}

function lineSideSum(je: mjBizAppsAccountingJournalEntryEntity): number {
    let crSum = 0;
    let drSum = 0;
    for (const line of lineItemsOf(je)) {
        if (line.CreditAmount != null && line.CreditAmount > 0) {
            crSum += Number(line.CreditAmount);
        }
        if (line.DebitAmount != null && line.DebitAmount > 0) {
            drSum += Number(line.DebitAmount);
        }
    }
    if (crSum > 0) return crSum;
    if (drSum > 0) return drSum;
    return 0;
}

function resolveEntryAmount(je: mjBizAppsAccountingJournalEntryEntity): number {
    return lineSideSum(je);
}
