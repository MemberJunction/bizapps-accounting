import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, skip } from 'rxjs/operators';
import { CompositeKey, RunView, type RunViewParams, type RunViewResult } from '@memberjunction/core';
import { NavigationService } from '@memberjunction/ng-shared';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { MJAlertComponent, MJButtonDirective } from '@memberjunction/ng-ui-components';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { FormatWindow, PeriodPhrase, PeriodSqlFilter, SameIDs, type PeriodWindow } from '@mj-biz-apps/common-ng';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';
import { CompanyScopeService } from '../shared/company-scope.service';
import { DashboardPeriodService } from '../shared/dashboard-period.service';
import { AccountingDashboardFiltersComponent } from '../shared/dashboard-filters.component';
import { MAX_CHART_MONTHS, MonthBarLabel, MonthsBetween, type ChartMonth } from './overview-months';

interface BatchStageMetric {
    Status: mjBizAppsAccountingJournalEntryBatchEntity['Status'];
    /** Null when the figures could not be read: a dash, never an invented number. */
    Count: number | null;
    TotalAmount: number | null;
    Icon: string;
    Color: string;
}

/** Picked from the generated schema type, not re-declared — see BatchItem in accounting-batches. */
type RecentBatchRow = Pick<
    mjBizAppsAccountingJournalEntryBatchEntity,
    'ID' | 'JournalEntryBatchNumber' | 'Status' | 'TargetSystem' | 'PostingDate' | 'TotalEntries' | 'TotalDebits' | 'TotalCredits' | 'Company'
>;

const RECENT_BATCH_FIELDS: (keyof RecentBatchRow)[] = [
    'ID', 'JournalEntryBatchNumber', 'Status', 'TargetSystem', 'PostingDate', 'TotalEntries', 'TotalDebits', 'TotalCredits', 'Company',
];

/** A one-row journal-entry read: the first or last effective date in the period. */
interface EntryEdgeRow {
    ID: string;
    EffectiveDate: string | Date;
}

/** The rows one batched read can return; each result is narrowed by its shape. */
type OverviewRow = RecentBatchRow | EntryEdgeRow;

function isBatchRow(row: OverviewRow): row is RecentBatchRow {
    return 'JournalEntryBatchNumber' in row;
}

/** How many of the period's batches the ledger table lists. */
const RECENT_BATCH_ROWS = 50;

interface MonthlyVolumeBar {
    Period: string; // e.g. '2025-03'
    Label: string;  // e.g. 'Mar 25'
    Count: number;
    Percentage: number; // 0-100 for height
}

/** Every figure is null until read, and null again when a read fails: the tile shows a dash. */
interface AccountingOverviewKPIs {
    TotalBatches: number | null;
    PendingBatches: number | null;
    PostedBatches: number | null;
    FailedBatches: number | null;
    PendingJournalEntries: number | null;
    TotalVolume: number | null;
    EntriesInPeriod: number | null;
}

const NO_KPIS: AccountingOverviewKPIs = {
    TotalBatches: null,
    PendingBatches: null,
    PostedBatches: null,
    FailedBatches: null,
    PendingJournalEntries: null,
    TotalVolume: null,
    EntriesInPeriod: null,
};

/** The period's batches, every row (not a sample), and the journal-entry reads that frame the chart. */
interface OverviewReads {
    batches: RecentBatchRow[];
    pendingEntries: number;
    entriesInPeriod: number;
    firstEntryDay: string | null;
    lastEntryDay: string | null;
}

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/**
 * World-Class Financial & Accounting Overview Dashboard.
 *
 * Provides real-time visibility into General Ledger posting health,
 * batch dispatch pipelines across ERP target systems, journal entry volume over time,
 * and recent ERP posting batches.
 */
@Component({
    selector: 'mj-accounting-overview-page',
    standalone: true,
    imports: [CommonModule, SharedGenericModule, MJButtonDirective, MJAlertComponent, AccountingDashboardFiltersComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="mja-overview">
            <!-- Header Toolbar -->
            <header class="mja-head-card">
                <div class="mja-head-top">
                    <div class="mja-identity">
                        <div class="mja-avatar">
                            <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
                        </div>
                        <div class="mja-titles">
                            <h1 class="mja-title">Accounting &amp; Financial Overview</h1>
                            <p class="mja-sub">General Ledger subledger health, ERP batch dispatch pipeline, and posting volume trends.</p>
                        </div>
                    </div>

                    <div class="mja-actions">
                        <button mjButton variant="flat" size="sm" type="button" [disabled]="IsLoading" (click)="LoadDashboardData()" title="Re-read batches and journal entries">
                            <i class="fa-solid fa-rotate" [class.fa-spin]="IsLoading"></i> Refresh
                        </button>
                        <button mjButton variant="secondary" size="sm" type="button" (click)="CreateNewJournalEntry()">
                            <i class="fa-solid fa-plus"></i> New Journal Entry
                        </button>
                        <button mjButton variant="primary" size="sm" type="button" (click)="CreateNewBatch()">
                            <i class="fa-solid fa-layer-group"></i> Build Batch
                        </button>
                    </div>
                </div>

                <!-- Company + period. The company picker is the app-wide scope; the period is shared with
                     the other accounting dashboards. Every figure below reads both. -->
                <mj-accounting-dashboard-filters class="mja-filters"></mj-accounting-dashboard-filters>

                @if (LoadError) {
                    <mj-alert Variant="error" [Message]="LoadError"></mj-alert>
                }

                <!-- KPI strip. A dash is a figure that could not be read, never a zero. -->
                <div class="mja-kpi-bar">
                    <div class="mja-kpi-tile" [title]="'Journal entry batches posting in ' + PeriodText + '.'">
                        <span class="mja-kpi-label">Batches</span>
                        <span class="mja-kpi-val" data-testid="overview-kpi-batches">{{ Figure(KPIs.TotalBatches) }}</span>
                    </div>
                    <div class="mja-kpi-tile" title="Journal entries not yet batched. Every effective date, not only the selected period: an entry still waiting is counted however old it is.">
                        <span class="mja-kpi-label">Pending Entries</span>
                        <span class="mja-kpi-val mja-val--amber" data-testid="overview-kpi-pending-entries">{{ Figure(KPIs.PendingJournalEntries) }}</span>
                    </div>
                    <div class="mja-kpi-tile" [title]="'Pending journal entry batches posting in ' + PeriodText + '.'">
                        <span class="mja-kpi-label">Batches in Flight</span>
                        <span class="mja-kpi-val mja-val--blue">{{ Figure(KPIs.PendingBatches) }}</span>
                    </div>
                    <div class="mja-kpi-tile" [title]="'Posted journal entry batches posting in ' + PeriodText + '.'">
                        <span class="mja-kpi-label">Posted &amp; Reconciled</span>
                        <span class="mja-kpi-val mja-val--green">{{ Figure(KPIs.PostedBatches) }}</span>
                    </div>
                    <div class="mja-kpi-tile" [title]="'Failed journal entry batches posting in ' + PeriodText + '.'">
                        <span class="mja-kpi-label">Out-of-Balance / Errors</span>
                        <span class="mja-kpi-val" [class.mja-val--red]="(KPIs.FailedBatches ?? 0) > 0" [class.mja-val--green]="KPIs.FailedBatches === 0">
                            {{ Figure(KPIs.FailedBatches) }}
                        </span>
                    </div>
                    <div class="mja-kpi-tile" [title]="'Total debits of the journal entry batches posting in ' + PeriodText + '.'">
                        <span class="mja-kpi-label">Total Subledger Volume</span>
                        <span class="mja-kpi-val mja-val--blue" data-testid="overview-kpi-volume">
                            @if (KPIs.TotalVolume === null) { — } @else { {{ KPIs.TotalVolume | currency }} }
                        </span>
                    </div>
                </div>
            </header>

            <!-- 2-Column Grid: Batch Stages Funnel + JE Volume Chart -->
            <div class="mja-two-col">
                <!-- Batch Pipeline Stages Funnel -->
                <section class="mja-card mja-card--flex">
                    <div class="mja-card-header">
                        <div class="mja-card-title-group">
                            <h2 class="mja-card-title"><i class="fa-solid fa-arrows-split-up-and-left"></i> Batch Processing Stages</h2>
                            <span class="mja-card-subtitle">Journal entry batches posting in {{ PeriodText }}, by status</span>
                        </div>
                    </div>

                    <div class="mja-stages-grid">
                        @for (stage of Stages; track stage.Status) {
                            <div class="mja-stage-tile" [attr.data-status]="stage.Status">
                                <div class="mja-stage-top">
                                    <div class="mja-stage-icon" [style.color]="stage.Color">
                                        <i [class]="stage.Icon"></i>
                                    </div>
                                    <span class="mja-stage-badge" [style.background-color]="stage.Color + '20'" [style.color]="stage.Color">
                                        {{ stage.Status }}
                                    </span>
                                </div>
                                <div class="mja-stage-count">{{ Figure(stage.Count) }}</div>
                                <div class="mja-stage-volume">
                                    @if (stage.TotalAmount === null) { — } @else { {{ stage.TotalAmount | currency }} }
                                </div>
                            </div>
                        }
                    </div>
                </section>

                <!-- Journal Entry Volume Over Time Chart -->
                <section class="mja-card mja-card--flex">
                    <div class="mja-card-header">
                        <div class="mja-card-title-group">
                            <h2 class="mja-card-title"><i class="fa-solid fa-chart-column"></i> Journal Entry Volume Over Time</h2>
                            <span class="mja-card-subtitle">Journal entries by effective month, {{ PeriodText }}{{ ChartClipped ? ' (latest ' + MaxChartMonths + ' months shown)' : '' }}</span>
                        </div>
                        <div class="mja-chart-badge" title="Journal entries with an effective date in the period.">
                            <strong data-testid="overview-entries-in-period">{{ Figure(KPIs.EntriesInPeriod) }}</strong> entries
                        </div>
                    </div>

                    @if (IsLoading) {
                        <mj-loading text="Loading posting history…"></mj-loading>
                    } @else if (MonthlyBars.length === 0) {
                        <div class="mja-loading-chart">
                            <span>{{ LoadError ? 'Posting history could not be loaded.' : 'No journal entries in this period.' }}</span>
                        </div>
                    } @else {
                        <div class="mja-chart-container">
                            <div class="mja-chart-bars">
                                @for (bar of MonthlyBars; track bar.Period) {
                                    <div class="mja-bar-col" [title]="bar.Period + ': ' + bar.Count + ' entries'">
                                        <div class="mja-bar-track">
                                            @if (bar.Count > 0) {
                                                <div
                                                    class="mja-bar-fill"
                                                    [style.height.%]="bar.Percentage">
                                                    <span class="mja-bar-tooltip">{{ bar.Count }}</span>
                                                </div>
                                            }
                                        </div>
                                        <span class="mja-bar-label">{{ bar.Label }}</span>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                </section>
            </div>

            <!-- Recent Batches Ledger -->
            <section class="mja-card">
                <div class="mja-card-header">
                    <div class="mja-card-title-group">
                        <h2 class="mja-card-title"><i class="fa-solid fa-layer-group"></i> Recent Journal Entry Batches</h2>
                        <span class="mja-card-subtitle">Latest batches posting in {{ PeriodText }}</span>
                    </div>
                    <button mjButton variant="primary" size="sm" type="button" (click)="CreateNewBatch()">
                        <i class="fa-solid fa-plus"></i> Build Batch
                    </button>
                </div>

                @if (IsLoading) {
                    <mj-loading text="Loading recent batches…"></mj-loading>
                } @else if (LoadError) {
                    <p class="mja-error-note">Recent batches could not be loaded.</p>
                } @else if (RecentBatches.length === 0) {
                    <div class="mja-empty-box">
                        <div class="mja-empty-box-icon">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        <div class="mja-empty-box-text">
                            <h4>No Batches in This Period</h4>
                            <p>There are <strong>{{ Figure(KPIs.PendingJournalEntries) }} Pending Journal Entries</strong> in the subledger ready to be consolidated into posting batches.</p>
                        </div>
                        <button mjButton variant="primary" size="sm" type="button" (click)="CreateNewBatch()">
                            <i class="fa-solid fa-plus"></i> Build Batch Now
                        </button>
                    </div>
                } @else {
                    <div class="mja-table-wrap">
                        <table class="mja-table">
                            <thead>
                                <tr>
                                    <th>Batch №</th>
                                    <th>Target System</th>
                                    <th>Posting Date</th>
                                    <th>Company</th>
                                    <th>Status</th>
                                    <th class="mja-th-right">Entries</th>
                                    <th class="mja-th-right">Total Volume</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (batch of RecentBatches; track batch.ID) {
                                    <tr (click)="OpenBatch(batch.ID)">
                                        <td>
                                            <strong class="mja-batch-num">{{ batch.JournalEntryBatchNumber }}</strong>
                                        </td>
                                        <td>
                                            <span class="mja-target-pill">
                                                <i class="fa-solid fa-server"></i> {{ batch.TargetSystem }}
                                            </span>
                                        </td>
                                        <td>{{ batch.PostingDate | date:'mediumDate':'UTC' }}</td>
                                        <td>{{ batch.Company || '—' }}</td>
                                        <td>
                                            <span class="mja-status-pill" [attr.data-status]="batch.Status">
                                                {{ batch.Status }}
                                            </span>
                                        </td>
                                        <td class="mja-td-right">{{ batch.TotalEntries }}</td>
                                        <td class="mja-td-right">
                                            <strong>{{ batch.TotalDebits | currency }}</strong>
                                        </td>
                                        <td class="mja-td-action">
                                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                }
            </section>
        </div>
    `,
    styles: [`
        :host { display: block; width: 100%; height: 100%; box-sizing: border-box; }

        .mja-overview {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 20px 24px;
            min-height: 100%;
            background: var(--mj-bg-surface-sunken, #f8fafc);
            box-sizing: border-box;
        }

        /* 1. Header Card */
        .mja-head-card {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: var(--mj-radius-lg, 12px);
            padding: 16px 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .mja-head-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
        }

        .mja-identity { display: flex; align-items: center; gap: 14px; }
        .mja-avatar {
            width: 48px;
            height: 48px;
            border-radius: var(--mj-radius-md, 8px);
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);
            flex-shrink: 0;
        }

        .mja-titles { display: flex; flex-direction: column; gap: 2px; }
        .mja-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--mj-text-primary, #0f172a); }
        .mja-sub { margin: 0; font-size: 12px; color: var(--mj-text-muted, #64748b); }

        .mja-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        /* KPI Bar */
        .mja-kpi-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--mj-border-default, #e2e8f0);
        }

        .mja-kpi-tile { display: flex; flex-direction: column; gap: 2px; }
        .mja-kpi-label { font-size: 11px; font-weight: 600; color: var(--mj-text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.04em; }
        .mja-kpi-val { font-size: 16px; font-weight: 700; font-family: var(--mj-font-mono, monospace); color: var(--mj-text-primary, #0f172a); }
        .mja-val--blue { color: #0284c7; }
        .mja-val--green { color: #16a34a; }
        .mja-val--amber { color: #d97706; }
        .mja-val--red { color: #dc2626; }

        /* 2-Column Section */
        .mja-two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        @media (max-width: 1024px) {
            .mja-two-col {
                grid-template-columns: 1fr;
            }
        }

        .mja-card {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: var(--mj-radius-lg, 12px);
            padding: 18px 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .mja-card--flex {
            justify-content: space-between;
        }

        .mja-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .mja-card-title-group { display: flex; flex-direction: column; gap: 2px; }
        .mja-card-title {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: var(--mj-text-primary, #0f172a);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .mja-card-subtitle { font-size: 12px; color: var(--mj-text-muted, #64748b); }

        .mja-chart-badge {
            font-size: 12px;
            color: var(--mj-text-muted, #64748b);
            background: #f1f5f9;
            padding: 3px 8px;
            border-radius: 6px;
        }

        /* Stages Grid */
        .mja-stages-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 10px;
        }

        .mja-stage-tile {
            display: flex;
            flex-direction: column;
            gap: 5px;
            padding: 12px 14px;
            border-radius: var(--mj-radius-md, 8px);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            background: var(--mj-bg-surface, #ffffff);
            transition: all 0.15s ease;
        }

        .mja-stage-tile:hover {
            border-color: var(--mj-brand-primary, #0284c7);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .mja-stage-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        .mja-stage-icon { font-size: 14px; }

        .mja-stage-badge {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2px 6px;
            border-radius: 9999px;
        }

        .mja-stage-count {
            font-size: 20px;
            font-weight: 800;
            font-family: var(--mj-font-mono, monospace);
            color: var(--mj-text-primary, #0f172a);
        }

        .mja-stage-volume {
            font-size: 11px;
            font-weight: 600;
            color: var(--mj-text-muted, #64748b);
            font-family: var(--mj-font-mono, monospace);
        }

        /* Chart Styling */
        .mja-chart-container {
            width: 100%;
            height: 140px;
            display: flex;
            align-items: flex-end;
            padding-top: 10px;
        }

        .mja-chart-bars {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            width: 100%;
            height: 100%;
            overflow-x: auto;
            padding-bottom: 20px;
            position: relative;
        }

        .mja-bar-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
            min-width: 24px;
            height: 100%;
            position: relative;
        }

        .mja-bar-track {
            width: 100%;
            max-width: 28px;
            height: 100%;
            background: #f1f5f9;
            border-radius: 4px 4px 0 0;
            display: flex;
            align-items: flex-end;
            position: relative;
        }

        .mja-bar-fill {
            width: 100%;
            background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%);
            border-radius: 4px 4px 0 0;
            min-height: 4px;
            transition: height 0.4s ease;
            position: relative;
            cursor: pointer;
        }

        .mja-bar-fill:hover {
            background: linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%);
        }

        .mja-bar-tooltip {
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            font-weight: 700;
            font-family: var(--mj-font-mono, monospace);
            color: #0284c7;
            opacity: 0;
            transition: opacity 0.15s ease;
            pointer-events: none;
            white-space: nowrap;
        }

        .mja-bar-col:hover .mja-bar-tooltip {
            opacity: 1;
        }

        .mja-bar-label {
            position: absolute;
            bottom: -18px;
            font-size: 9.5px;
            font-weight: 600;
            color: var(--mj-text-muted, #94a3b8);
            white-space: nowrap;
        }

        /* Table */
        .mja-table-wrap {
            overflow-x: auto;
            border-radius: 8px;
            border: 1px solid var(--mj-border-default, #e2e8f0);
        }

        .mja-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }

        .mja-table th {
            padding: 10px 14px;
            font-size: 11.5px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--mj-text-muted, #64748b);
            background: var(--mj-bg-surface-sunken, #f8fafc);
            border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
        }

        .mja-table td {
            padding: 11px 14px;
            border-bottom: 1px solid var(--mj-border-subtle, #f1f5f9);
            color: var(--mj-text-primary, #0f172a);
        }

        .mja-table tr {
            cursor: pointer;
            transition: background 0.1s ease;
        }

        .mja-table tr:hover {
            background: var(--mj-bg-surface-hover, #f8fafc);
        }

        .mja-batch-num {
            color: var(--mj-brand-primary, #0284c7);
            font-family: var(--mj-font-mono, monospace);
        }

        .mja-target-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            background: #f1f5f9;
            color: #334155;
        }

        .mja-th-right, .mja-td-right { text-align: right; }
        .mja-td-action {
            text-align: right;
            color: var(--mj-text-muted, #94a3b8);
            font-size: 12px;
        }

        .mja-status-pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: capitalize;
            background: #f1f5f9;
            color: #475569;
        }

        .mja-status-pill[data-status="Posted"] { background: #dcfce7; color: #166534; }
        .mja-status-pill[data-status="Approved"] { background: #e0f2fe; color: #0369a1; }
        .mja-status-pill[data-status="Pending"] { background: #fef3c7; color: #92400e; }
        .mja-status-pill[data-status="Failed"] { background: #fee2e2; color: #991b1b; }

        .mja-empty-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 24px;
            border-radius: 8px;
            border: 1px dashed var(--mj-border-default, #cbd5e1);
            background: var(--mj-bg-surface-sunken, #f8fafc);
            flex-wrap: wrap;
        }

        .mja-empty-box-icon {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #e0f2fe;
            color: #0284c7;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
        }

        .mja-empty-box-text {
            flex: 1;
            min-width: 240px;
        }

        .mja-empty-box-text h4 {
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: 700;
            color: var(--mj-text-primary, #0f172a);
        }

        .mja-empty-box-text p {
            margin: 0;
            font-size: 12.5px;
            color: var(--mj-text-muted, #64748b);
        }

        .mja-filters { padding-top: 12px; border-top: 1px solid var(--mj-border-default, #e2e8f0); }

        .mja-error-note { margin: 0; font-size: 13px; color: var(--mj-text-muted, #64748b); }

        .mja-loading, .mja-loading-chart {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 40px;
            color: var(--mj-text-muted, #64748b);
            font-size: 13px;
        }
    `]
})
export class AccountingOverviewPageComponent implements OnInit {
    private cdr = inject(ChangeDetectorRef);
    private navService = inject(NavigationService, { optional: true });
    private destroyRef = inject(DestroyRef);
    private scope = inject(CompanyScopeService);
    private periods = inject(DashboardPeriodService);
    private loadSeq = 0;

    public IsLoading = false;
    /** Why the figures could not be read. The figures then show dashes; nothing is made up. */
    public LoadError: string | null = null;
    public RecentBatches: RecentBatchRow[] = [];
    public MonthlyBars: MonthlyVolumeBar[] = [];
    /** True when the period has more months than the chart draws. */
    public ChartClipped = false;
    public readonly MaxChartMonths = MAX_CHART_MONTHS;

    public KPIs: AccountingOverviewKPIs = { ...NO_KPIS };

    /**
     * The stage row, and the ONLY place a batch status is enumerated on this page. The tally in
     * computeBatchMetrics walks this list, so adding a status (Archived, golive #214) is a single
     * line here — it used to take a local counter, a local amount, a switch case and a literal in
     * the rebuilt array, which is exactly how Archived came to be missing from this card.
     */
    private static readonly STAGE_DEFS: ReadonlyArray<Omit<BatchStageMetric, 'Count' | 'TotalAmount'>> = [
        { Status: 'Pending', Icon: 'fa-solid fa-clock', Color: '#d97706' },
        { Status: 'Approved', Icon: 'fa-solid fa-user-check', Color: '#0284c7' },
        { Status: 'Sent', Icon: 'fa-solid fa-paper-plane', Color: '#7c3aed' },
        { Status: 'Posted', Icon: 'fa-solid fa-circle-check', Color: '#16a34a' },
        { Status: 'Failed', Icon: 'fa-solid fa-triangle-exclamation', Color: '#dc2626' },
        { Status: 'Archived', Icon: 'fa-solid fa-box-archive', Color: '#475569' },
    ];

    public Stages: BatchStageMetric[] = AccountingOverviewPageComponent.unreadStages();

    async ngOnInit(): Promise<void> {
        try {
            // The scope and the saved period first, so the first read uses them. Both are idempotent:
            // a shell that already loaded them makes these no-ops.
            await Promise.all([this.scope.Load(), this.periods.Load()]);
        } catch (e) {
            this.showError(e);
            return;
        }
        this.reloadOnFilterChange();
        await this.LoadDashboardData();
    }

    /** The selected period's bounds for the companies in scope. */
    public get Window(): PeriodWindow {
        return this.periods.WindowFor(this.scope.SelectedIDs);
    }

    /** "this quarter (Jul 1, 2026 – Sep 30, 2026)", "all time", or a custom range's dates. */
    public get PeriodText(): string {
        const w = this.Window;
        const phrase = PeriodPhrase(w);
        return w.Key === 'alltime' || w.Key === 'custom' ? phrase : `${phrase} (${FormatWindow(w)})`;
    }

    /** A figure for display: a dash when it could not be read. */
    public Figure(value: number | null): string {
        return value === null ? '—' : String(value);
    }

    public async LoadDashboardData(): Promise<void> {
        const seq = ++this.loadSeq;
        this.IsLoading = true;
        this.LoadError = null;
        this.cdr.markForCheck();
        try {
            const window = this.Window;
            const reads = await this.readFigures(window);
            const months = await this.readMonthlyCounts(window, reads);
            if (seq !== this.loadSeq) return;
            this.applyFigures(reads, months);
        } catch (e) {
            if (seq !== this.loadSeq) return;
            this.showError(e);
        } finally {
            if (seq === this.loadSeq) {
                this.IsLoading = false;
                this.cdr.markForCheck();
            }
        }
    }

    /** Re-reads when the company scope or the period changes, from this bar or from the rail chip. */
    private reloadOnFilterChange(): void {
        const sub = combineLatest([this.scope.SelectedIDs$.pipe(distinctUntilChanged(SameIDs)), this.periods.State$])
            .pipe(skip(1))
            .subscribe(() => void this.LoadDashboardData());
        this.destroyRef.onDestroy(() => sub.unsubscribe());
    }

    /** The company scope and the window's clause over the DATE `column`, ANDed. Empty when neither narrows. */
    private filterFor(column: string, window: PeriodWindow): string {
        return this.scope.ComposeFilter(PeriodSqlFilter(column, window));
    }

    /**
     * One round trip. The batches are every batch posting in the period, not a capped sample, so the
     * stage counts and amounts are exact; a host makes at most a few batches per company per day.
     * The journal-entry figures are server counts (`MaxRows: 1` + `TotalRowCount`); the first and
     * last effective dates frame the chart when the period is open on a side.
     */
    private async readFigures(window: PeriodWindow): Promise<OverviewReads> {
        const inPeriod = this.filterFor('EffectiveDate', window);
        const entryEdge = (orderBy: string): RunViewParams => ({
            EntityName: JE_ENTITY, ExtraFilter: inPeriod, Fields: ['ID', 'EffectiveDate'], OrderBy: orderBy, MaxRows: 1, ResultType: 'simple',
        });
        const [batches, pending, first, last] = await new RunView().RunViews<OverviewRow>([
            {
                EntityName: BATCH_ENTITY,
                ExtraFilter: this.filterFor('PostingDate', window),
                Fields: RECENT_BATCH_FIELDS,
                OrderBy: 'PostingDate DESC, JournalEntryBatchNumber DESC',
                ResultType: 'simple',
            },
            { EntityName: JE_ENTITY, ExtraFilter: this.scope.ComposeFilter(`Status='Pending'`), Fields: ['ID'], MaxRows: 1, ResultType: 'simple' },
            entryEdge('EffectiveDate ASC'),
            entryEdge('EffectiveDate DESC'),
        ]);
        return {
            batches: AccountingOverviewPageComponent.rowsOf(batches, 'journal entry batches').filter(isBatchRow),
            pendingEntries: AccountingOverviewPageComponent.totalOf(pending, 'pending journal entries'),
            entriesInPeriod: AccountingOverviewPageComponent.totalOf(first, 'journal entries'),
            firstEntryDay: AccountingOverviewPageComponent.edgeDay(first),
            lastEntryDay: AccountingOverviewPageComponent.edgeDay(last),
        };
    }

    /**
     * One count per month the chart draws, in one round trip. The months are the period's, framed
     * by the first and last entry where the period is open on a side.
     */
    private async readMonthlyCounts(window: PeriodWindow, reads: OverviewReads): Promise<{ months: ChartMonth[]; counts: number[]; clipped: boolean }> {
        const start = window.Start ?? reads.firstEntryDay;
        const end = window.End ?? reads.lastEntryDay;
        if (!start || !end || reads.entriesInPeriod === 0) return { months: [], counts: [], clipped: false };
        const all = MonthsBetween(start, end, Number.MAX_SAFE_INTEGER);
        const months = all.slice(-MAX_CHART_MONTHS);
        const results = await new RunView().RunViews<{ ID: string }>(
            months.map((m): RunViewParams => ({
                EntityName: JE_ENTITY,
                ExtraFilter: this.filterFor('EffectiveDate', { Key: 'custom', Label: '', Start: m.Start, End: m.End }),
                Fields: ['ID'],
                MaxRows: 1,
                ResultType: 'simple',
            })),
        );
        return { months, counts: results.map((r) => AccountingOverviewPageComponent.totalOf(r, 'monthly entry counts')), clipped: all.length > months.length };
    }

    private applyFigures(reads: OverviewReads, chart: { months: ChartMonth[]; counts: number[]; clipped: boolean }): void {
        this.RecentBatches = reads.batches.slice(0, RECENT_BATCH_ROWS);
        this.computeBatchMetrics(reads.batches);
        this.KPIs = { ...this.KPIs, PendingJournalEntries: reads.pendingEntries, EntriesInPeriod: reads.entriesInPeriod };
        this.MonthlyBars = AccountingOverviewPageComponent.toBars(chart.months, chart.counts);
        this.ChartClipped = chart.clipped;
    }

    /** A failed read: say why, and show dashes rather than numbers nobody read. */
    private showError(e: unknown): void {
        this.LoadError = e instanceof Error ? e.message : String(e);
        this.KPIs = { ...NO_KPIS };
        this.Stages = AccountingOverviewPageComponent.unreadStages();
        this.RecentBatches = [];
        this.MonthlyBars = [];
        this.ChartClipped = false;
        this.cdr.markForCheck();
    }

    private static unreadStages(): BatchStageMetric[] {
        return AccountingOverviewPageComponent.STAGE_DEFS.map((d) => ({ ...d, Count: null, TotalAmount: null }));
    }

    private static rowsOf<T>(result: RunViewResult<T>, what: string): T[] {
        if (!result.Success) throw new Error(result.ErrorMessage || `Could not load the ${what}. Refresh the page to try again.`);
        return result.Results ?? [];
    }

    private static totalOf<T>(result: RunViewResult<T>, what: string): number {
        if (!result.Success) throw new Error(result.ErrorMessage || `Could not count the ${what}. Refresh the page to try again.`);
        return result.TotalRowCount ?? result.Results?.length ?? 0;
    }

    /** The EffectiveDate of a one-row edge read, as the stored calendar day. */
    private static edgeDay(result: RunViewResult<OverviewRow>): string | null {
        const row = result.Results?.[0];
        return row && 'EffectiveDate' in row ? ToCalendarDay(row.EffectiveDate) : null;
    }

    private static toBars(months: ChartMonth[], counts: number[]): MonthlyVolumeBar[] {
        const max = Math.max(1, ...counts);
        return months.map((m, i) => ({
            Period: m.Period,
            Label: MonthBarLabel(m.Period),
            Count: counts[i],
            Percentage: counts[i] === 0 ? 0 : Math.max(10, Math.round((counts[i] / max) * 100)),
        }));
    }

    private computeBatchMetrics(batches: RecentBatchRow[]): void {
        // Tally straight into the stage definitions — no per-status locals, so a status added to
        // STAGE_DEFS is counted here automatically instead of being silently dropped.
        const tally = new Map<string, { Count: number; TotalAmount: number }>(
            AccountingOverviewPageComponent.STAGE_DEFS.map(d => [d.Status, { Count: 0, TotalAmount: 0 }]),
        );
        let totalVol = 0;

        for (const b of batches) {
            const amt = Number(b.TotalDebits) || 0;
            totalVol += amt;
            const bucket = tally.get(b.Status);
            if (!bucket) continue;   // a status the UI does not show yet — counted in TotalBatches only
            bucket.Count++;
            bucket.TotalAmount += amt;
        }

        const countOf = (status: string) => tally.get(status)?.Count ?? 0;

        this.KPIs = {
            ...this.KPIs,
            TotalBatches: batches.length,
            PendingBatches: countOf('Pending'),
            PostedBatches: countOf('Posted'),
            FailedBatches: countOf('Failed'),
            TotalVolume: totalVol,
        };

        this.Stages = AccountingOverviewPageComponent.STAGE_DEFS.map(d => ({
            ...d,
            Count: tally.get(d.Status)?.Count ?? 0,
            TotalAmount: tally.get(d.Status)?.TotalAmount ?? 0,
        }));
    }

    public OpenBatch(id: string): void {
        if (!this.navService) return;
        this.navService.OpenEntityRecord(BATCH_ENTITY, CompositeKey.FromID(id));
    }

    public CreateNewJournalEntry(): void {
        if (!this.navService) return;
        this.navService.OpenNewEntityRecord(JE_ENTITY);
    }

    /**
     * Open the Batches workspace, where the real build flow lives (candidate preview, cutoff,
     * target ERP, then Accounting.BuildJournalEntryBatch).
     *
     * This used to call OpenNewEntityRecord(BATCH_ENTITY), which opened an EMPTY batch record
     * form: the button said "Build Batch" and did "New Batch". Nothing was ever swept and no
     * journal entry was ever locked — it just left stray empty Pending batches behind. Measured
     * 2026-09-12 with 4 pending entries in the subledger: two clicks, two batches, TotalEntries 0,
     * every entry still unbatched.
     */
    public async CreateNewBatch(): Promise<void> {
        if (!this.navService) return;
        await this.navService.OpenNavItemByName('Batches');
    }
}
