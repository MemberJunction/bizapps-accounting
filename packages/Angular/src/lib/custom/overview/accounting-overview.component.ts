import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompositeKey, RunView } from '@memberjunction/core';
import { NavigationService } from '@memberjunction/ng-shared';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';

interface BatchStageMetric {
    Status: 'Pending' | 'Approved' | 'Sent' | 'Posted' | 'Failed';
    Count: number;
    TotalAmount: number;
    Icon: string;
    Color: string;
}

interface RecentJournalEntryRow {
    ID: string;
    JournalEntryNumber: string;
    EffectiveDate: string;
    Description: string | null;
    Status: string;
    TotalDebits: number;
    TotalCredits: number;
    Company: string | null;
}

interface AccountingOverviewKPIs {
    TotalBatches: number;
    PendingBatches: number;
    PostedBatches: number;
    FailedBatches: number;
    TotalJournalEntries: number;
    TotalVolume: number;
}

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/**
 * World-Class Financial & Accounting Overview Dashboard.
 *
 * Provides real-time visibility into General Ledger posting health,
 * batch dispatch pipelines across ERP target systems, and rapid journal entry actions.
 */
@Component({
    selector: 'mj-accounting-overview-page',
    standalone: true,
    imports: [CommonModule, FormsModule, MJButtonDirective],
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
                            <p class="mja-sub">General Ledger subledger health, ERP batch dispatch pipeline, and real-time posting audit.</p>
                        </div>
                    </div>

                    <div class="mja-actions">
                        <button mjButton variant="secondary" size="sm" type="button" (click)="CreateNewBatch()">
                            <i class="fa-solid fa-layer-group"></i> Build Batch
                        </button>
                        <button mjButton variant="primary" size="sm" type="button" (click)="CreateNewJournalEntry()">
                            <i class="fa-solid fa-plus"></i> New Journal Entry
                        </button>
                    </div>
                </div>

                <!-- Live Financial KPI Strip -->
                <div class="mja-kpi-bar">
                    <div class="mja-kpi-tile">
                        <span class="mja-kpi-label">Active Batches</span>
                        <span class="mja-kpi-val">{{ KPIs.TotalBatches }}</span>
                    </div>
                    <div class="mja-kpi-tile">
                        <span class="mja-kpi-label">Pending Posting</span>
                        <span class="mja-kpi-val mja-val--amber">{{ KPIs.PendingBatches }}</span>
                    </div>
                    <div class="mja-kpi-tile">
                        <span class="mja-kpi-label">Posted &amp; Reconciled</span>
                        <span class="mja-kpi-val mja-val--green">{{ KPIs.PostedBatches }}</span>
                    </div>
                    <div class="mja-kpi-tile">
                        <span class="mja-kpi-label">Out-of-Balance / Errors</span>
                        <span class="mja-kpi-val" [class.mja-val--red]="KPIs.FailedBatches > 0" [class.mja-val--green]="KPIs.FailedBatches === 0">
                            {{ KPIs.FailedBatches }}
                        </span>
                    </div>
                    <div class="mja-kpi-tile">
                        <span class="mja-kpi-label">Total Volume (YTD)</span>
                        <span class="mja-kpi-val mja-val--blue">{{ KPIs.TotalVolume | currency }}</span>
                    </div>
                </div>
            </header>

            <!-- Batch Pipeline Stages Funnel -->
            <section class="mja-pipeline-card">
                <div class="mja-card-header">
                    <div class="mja-card-title-group">
                        <h2 class="mja-card-title"><i class="fa-solid fa-arrows-split-up-and-left"></i> Batch Processing Stages</h2>
                        <span class="mja-card-subtitle">Real-time lifecycle of batches in flight to ERP targets</span>
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
                            <div class="mja-stage-count">{{ stage.Count }}</div>
                            <div class="mja-stage-volume">{{ stage.TotalAmount | currency }}</div>
                        </div>
                    }
                </div>
            </section>

            <!-- Recent Journal Entries Ledger -->
            <section class="mja-ledger-card">
                <div class="mja-card-header">
                    <div class="mja-card-title-group">
                        <h2 class="mja-card-title"><i class="fa-solid fa-book-open"></i> Recent Journal Entries</h2>
                        <span class="mja-card-subtitle">Latest postings and subledger movements</span>
                    </div>
                    <button mjButton variant="flat" size="sm" type="button" (click)="CreateNewJournalEntry()">
                        <i class="fa-solid fa-plus"></i> Add Entry
                    </button>
                </div>

                @if (IsLoading) {
                    <div class="mja-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <span>Loading recent transactions…</span>
                    </div>
                } @else if (RecentEntries.length === 0) {
                    <div class="mja-empty">
                        <i class="fa-solid fa-receipt"></i>
                        <p>No recent journal entries recorded.</p>
                    </div>
                } @else {
                    <div class="mja-table-wrap">
                        <table class="mja-table">
                            <thead>
                                <tr>
                                    <th>Entry №</th>
                                    <th>Effective Date</th>
                                    <th>Description</th>
                                    <th>Company</th>
                                    <th>Status</th>
                                    <th class="mja-th-right">Total Amount</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (entry of RecentEntries; track entry.ID) {
                                    <tr (click)="OpenJournalEntry(entry.ID)">
                                        <td>
                                            <strong class="mja-entry-num">{{ entry.JournalEntryNumber }}</strong>
                                        </td>
                                        <td>{{ entry.EffectiveDate | date:'mediumDate' }}</td>
                                        <td class="mja-td-desc">{{ entry.Description || '—' }}</td>
                                        <td>{{ entry.Company || '—' }}</td>
                                        <td>
                                            <span class="mja-status-pill" [attr.data-status]="entry.Status">
                                                {{ entry.Status }}
                                            </span>
                                        </td>
                                        <td class="mja-td-right">
                                            <strong>{{ entry.TotalDebits | currency }}</strong>
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

        .mja-identity {
            display: flex;
            align-items: center;
            gap: 14px;
        }

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
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
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

        /* 2. Pipeline Stages */
        .mja-pipeline-card, .mja-ledger-card {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: var(--mj-radius-lg, 12px);
            padding: 18px 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            gap: 14px;
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

        .mja-stages-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 12px;
        }

        .mja-stage-tile {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 14px 16px;
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

        .mja-stage-icon { font-size: 16px; }

        .mja-stage-badge {
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2px 7px;
            border-radius: 9999px;
        }

        .mja-stage-count {
            font-size: 24px;
            font-weight: 800;
            font-family: var(--mj-font-mono, monospace);
            color: var(--mj-text-primary, #0f172a);
        }

        .mja-stage-volume {
            font-size: 12px;
            font-weight: 600;
            color: var(--mj-text-muted, #64748b);
            font-family: var(--mj-font-mono, monospace);
        }

        /* 3. Table */
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

        .mja-entry-num {
            color: var(--mj-brand-primary, #0284c7);
            font-family: var(--mj-font-mono, monospace);
        }

        .mja-td-desc {
            max-width: 280px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
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

        .mja-loading, .mja-empty {
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

    public IsLoading = false;
    public RecentEntries: RecentJournalEntryRow[] = [];

    public KPIs: AccountingOverviewKPIs = {
        TotalBatches: 0,
        PendingBatches: 0,
        PostedBatches: 0,
        FailedBatches: 0,
        TotalJournalEntries: 0,
        TotalVolume: 0,
    };

    public Stages: BatchStageMetric[] = [
        { Status: 'Pending', Count: 0, TotalAmount: 0, Icon: 'fa-solid fa-clock', Color: '#d97706' },
        { Status: 'Approved', Count: 0, TotalAmount: 0, Icon: 'fa-solid fa-user-check', Color: '#0284c7' },
        { Status: 'Sent', Count: 0, TotalAmount: 0, Icon: 'fa-solid fa-paper-plane', Color: '#7c3aed' },
        { Status: 'Posted', Count: 0, TotalAmount: 0, Icon: 'fa-solid fa-circle-check', Color: '#16a34a' },
        { Status: 'Failed', Count: 0, TotalAmount: 0, Icon: 'fa-solid fa-triangle-exclamation', Color: '#dc2626' },
    ];

    ngOnInit(): void {
        this.LoadDashboardData();
    }

    public async LoadDashboardData(): Promise<void> {
        this.IsLoading = true;
        this.cdr.markForCheck();

        try {
            const rv = new RunView();
            const [batchesResult, jeResult] = await Promise.all([
                rv.RunView<{
                    ID: string;
                    Status: 'Pending' | 'Approved' | 'Sent' | 'Posted' | 'Failed';
                    TotalDebits: number;
                    TotalCredits: number;
                }>({
                    EntityName: BATCH_ENTITY,
                    ResultType: 'simple',
                    MaxRows: 500,
                }),
                new RunView().RunView<RecentJournalEntryRow>({
                    EntityName: JE_ENTITY,
                    OrderBy: 'EffectiveDate DESC, __mj_CreatedAt DESC',
                    ResultType: 'simple',
                    MaxRows: 15,
                }),
            ]);

            if (batchesResult.Success && batchesResult.Results) {
                this.computeBatchMetrics(batchesResult.Results);
            }

            if (jeResult.Success && jeResult.Results) {
                this.RecentEntries = jeResult.Results;
            }
        } catch {
            // ignore
        } finally {
            this.IsLoading = false;
            this.cdr.markForCheck();
        }
    }

    private computeBatchMetrics(batches: Array<{ Status: string; TotalDebits: number }>): void {
        let pending = 0;
        let approved = 0;
        let sent = 0;
        let posted = 0;
        let failed = 0;

        let pendingAmt = 0;
        let approvedAmt = 0;
        let sentAmt = 0;
        let postedAmt = 0;
        let failedAmt = 0;

        let totalVol = 0;

        for (const b of batches) {
            const amt = Number(b.TotalDebits) || 0;
            totalVol += amt;
            switch (b.Status) {
                case 'Pending':
                    pending++;
                    pendingAmt += amt;
                    break;
                case 'Approved':
                    approved++;
                    approvedAmt += amt;
                    break;
                case 'Sent':
                    sent++;
                    sentAmt += amt;
                    break;
                case 'Posted':
                    posted++;
                    postedAmt += amt;
                    break;
                case 'Failed':
                    failed++;
                    failedAmt += amt;
                    break;
            }
        }

        this.KPIs = {
            TotalBatches: batches.length,
            PendingBatches: pending,
            PostedBatches: posted,
            FailedBatches: failed,
            TotalJournalEntries: this.RecentEntries.length,
            TotalVolume: totalVol,
        };

        this.Stages = [
            { Status: 'Pending', Count: pending, TotalAmount: pendingAmt, Icon: 'fa-solid fa-clock', Color: '#d97706' },
            { Status: 'Approved', Count: approved, TotalAmount: approvedAmt, Icon: 'fa-solid fa-user-check', Color: '#0284c7' },
            { Status: 'Sent', Count: sent, TotalAmount: sentAmt, Icon: 'fa-solid fa-paper-plane', Color: '#7c3aed' },
            { Status: 'Posted', Count: posted, TotalAmount: postedAmt, Icon: 'fa-solid fa-circle-check', Color: '#16a34a' },
            { Status: 'Failed', Count: failed, TotalAmount: failedAmt, Icon: 'fa-solid fa-triangle-exclamation', Color: '#dc2626' },
        ];
    }

    public OpenJournalEntry(id: string): void {
        if (!this.navService) return;
        this.navService.OpenEntityRecord(JE_ENTITY, CompositeKey.FromID(id));
    }

    public CreateNewJournalEntry(): void {
        if (!this.navService) return;
        this.navService.OpenNewEntityRecord(JE_ENTITY);
    }

    public CreateNewBatch(): void {
        if (!this.navService) return;
        this.navService.OpenNewEntityRecord(BATCH_ENTITY);
    }
}
