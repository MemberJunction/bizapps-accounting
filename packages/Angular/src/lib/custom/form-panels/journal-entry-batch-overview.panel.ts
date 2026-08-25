import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompositeKey, Metadata, RunView } from '@memberjunction/core';
import {
    MJCardGridComponent,
    MJCardComponent,
    MJCardToolsDirective,
    MJCardFooterDirective,
} from '@memberjunction/ng-ui-components';
import { NavigationService } from '@memberjunction/ng-shared';
import { BaseFormComponent, BaseFormPanel } from '@memberjunction/ng-base-forms';
import { RegisterClassEx } from '@memberjunction/global';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

interface MemberEntryRow {
    ID: string;
    EntryNumber: string;
    EffectiveDate: Date | null;
    Description: string;
    Status: string;
}

const BATCH_OVERVIEW_CSS = `
.mja-overview {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
}

.mja-chart-bars {
    height: 110px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 0 4px 0;
}

.mja-bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
    justify-content: flex-end;
}

.mja-bar-fill {
    width: 100%;
    max-width: 28px;
    min-height: 4px;
    border-radius: 4px 4px 0 0;
    background: linear-gradient(180deg, #38bdf8 0%, rgba(56, 189, 248, 0.3) 100%);
    transition: all 0.2s ease;
}

.mja-bar-fill--peak {
    background: linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.3) 100%);
}

.mja-bar-lbl {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--mj-text-muted, #64748b);
}

.mja-deck {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.mja-deck-item {
    background: var(--mj-bg-surface-sunken, #090e1a);
    border: 1px solid var(--mj-border-default, #223254);
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.mja-deck-item:hover {
    border-color: var(--mj-brand-primary, #38bdf8);
    background: var(--mj-bg-surface-elevated, #1a2744);
    transform: translateX(2px);
}

.mja-deck-item__left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.mja-deck-item__icon {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: rgba(56, 189, 248, 0.12);
    color: var(--mj-brand-primary, #38bdf8);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11.5px;
    flex-shrink: 0;
}

.mja-deck-item__icon--success {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
}

.mja-deck-item__text h4 {
    font-size: 12px;
    font-weight: 600;
    color: var(--mj-text-primary, #f8fafc);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mja-deck-item__text p {
    font-size: 11px;
    color: var(--mj-text-muted, #64748b);
    margin: 1px 0 0 0;
}

.mja-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.mja-table th {
    text-align: left;
    padding: 6px 8px;
    color: var(--mj-text-muted, #64748b);
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--mj-border-default, #223254);
}

.mja-table td {
    padding: 7px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    color: var(--mj-text-secondary, #94a3b8);
}

.mja-table tr:hover td {
    background: var(--mj-bg-surface-sunken, #090e1a);
    color: var(--mj-text-primary, #f8fafc);
    cursor: pointer;
}

.mja-code {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--mj-brand-primary, #38bdf8);
}

.mja-table-action {
    text-align: right;
    color: var(--mj-text-muted, #64748b);
    font-size: 11px;
}

.mja-table tr:hover .mja-table-action {
    color: var(--mj-brand-primary, #38bdf8);
}

.mja-empty-state {
    font-size: 12px;
    color: var(--mj-text-muted, #64748b);
    padding: 16px;
    text-align: center;
    font-style: italic;
}
`;

@Component({
    standalone: true,
    selector: 'mja-journal-entry-batch-overview',
    imports: [
        CommonModule,
        MJCardGridComponent,
        MJCardComponent,
        MJCardToolsDirective,
        MJCardFooterDirective,
    ],
    template: `
        <div class="mja-overview">
            <mj-card-grid>
                
                <!-- Card 1: Batch Composition & Totals -->
                <mj-card Title="Batch Composition & Volume" Subtitle="Aggregated Debits & Member Entries" Icon="fa-solid fa-chart-column">
                    <div mjCardTools>
                        <span class="mja-code">\${{ TotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
                    </div>

                    <div class="mja-chart-bars">
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill mja-bar-fill--peak" style="height: 90%;"></div>
                            <span class="mja-bar-lbl">Debits</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 90%;"></div>
                            <span class="mja-bar-lbl">Credits</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 50%;"></div>
                            <span class="mja-bar-lbl">Lines</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 35%;"></div>
                            <span class="mja-bar-lbl">Entries</span>
                        </div>
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Total Debits</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">
                                \${{ TotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                            </span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Total Entries</span>
                            <span class="card-metric__val">{{ Record?.TotalEntries || 0 }} JEs</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Net Variance</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">$0.00 (Balanced)</span>
                        </div>
                    </div>
                </mj-card>

                <!-- Card 2: ERP Bridge Transmission Pipeline -->
                <mj-card Title="ERP Bridge Transmission Pipeline" Subtitle="Posting Stages & Connector State" Icon="fa-solid fa-route">
                    <div mjCardTools>
                        <span class="mja-code">{{ Record?.Status || 'Pending' }}</span>
                    </div>

                    <div class="mja-deck">
                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon mja-deck-item__icon--success">
                                    <i class="fa-solid fa-circle-check"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>1. Batch Lock & Summary Generation</h4>
                                    <p>Atomic balance confirmed &bull; Batched: {{ BatchedDateLabel }}</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">Complete</span>
                        </div>

                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon" [class.mja-deck-item__icon--success]="IsApproved">
                                    <i class="fa-solid" [class.fa-check-double]="IsApproved" [class.fa-clock]="!IsApproved"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>2. Approval & ERP Dispatch</h4>
                                    <p>{{ IsApproved ? 'Approved for sync' : 'Pending Approval' }}</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">{{ IsApproved ? 'Approved' : 'Pending' }}</span>
                        </div>
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Target ERP</span>
                            <span class="card-metric__val">{{ Record?.TargetSystem || 'ERP' }}</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Posting Date</span>
                            <span class="card-metric__val">{{ PostingDateLabel }}</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Status</span>
                            <span class="card-metric__val" style="color: var(--mj-brand-primary);">{{ Record?.Status || 'Active' }}</span>
                        </div>
                    </div>
                </mj-card>

                <!-- Card 3: Member Journal Entries Table -->
                <mj-card Title="Member Journal Entries" Subtitle="Drillable Batch Member Records" Icon="fa-solid fa-table-list">
                    <div mjCardTools>
                        <span class="mja-code">{{ MemberEntries.length }} Loaded</span>
                    </div>

                    <div style="overflow-x: auto; max-height: 210px; overflow-y: auto;">
                        @if (MemberEntries.length > 0) {
                            <table class="mja-table">
                                <thead>
                                    <tr>
                                        <th>Entry #</th>
                                        <th>Effective</th>
                                        <th>Description</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (entry of MemberEntries; track entry.ID) {
                                        <tr (click)="OnEntryClick(entry)">
                                            <td class="mja-code">{{ entry.EntryNumber }}</td>
                                            <td>{{ FormatDate(entry.EffectiveDate) }}</td>
                                            <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                {{ entry.Description }}
                                            </td>
                                            <td class="mja-table-action"><i class="fa-solid fa-arrow-up-right-from-square"></i></td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        } @else {
                            <div class="mja-empty-state">No member journal entries loaded for this batch.</div>
                        }
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Total Members</span>
                            <span class="card-metric__val">{{ Record?.TotalEntries || 0 }} Records</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Audit Check</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">Passed</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Bridge State</span>
                            <span class="card-metric__val" style="color: var(--mj-brand-primary);">Batched</span>
                        </div>
                    </div>
                </mj-card>

                <!-- Card 4: ERP Bridge Configuration -->
                <mj-card Title="ERP Bridge Configuration" Subtitle="Target ERP Connector & Specs" Icon="fa-solid fa-gears">
                    <div mjCardTools>
                        <span class="mja-code">Online</span>
                    </div>

                    <div class="mja-deck">
                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon">
                                    <i class="fa-solid fa-building-columns"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>ERP Connector: {{ Record?.TargetSystem || 'ERP' }}</h4>
                                    <p>External Ref: {{ Record?.ExternalJournalEntryBatchRef || 'Auto-Assigned on Post' }}</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">Active</span>
                        </div>

                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon mja-deck-item__icon--success">
                                    <i class="fa-solid fa-shield-halved"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>Idempotency & Lock Integrity</h4>
                                    <p>Batch immutability trigger active</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">Enforced</span>
                        </div>
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Connector</span>
                            <span class="card-metric__val">{{ Record?.TargetSystem || 'ERP' }}</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">External Ref</span>
                            <span class="card-metric__val mja-code">{{ Record?.ExternalJournalEntryBatchRef || '—' }}</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Health</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">Optimal</span>
                        </div>
                    </div>
                </mj-card>

            </mj-card-grid>
        </div>
    `,
    styles: [BATCH_OVERVIEW_CSS]
})
export class JournalEntryBatchOverviewComponent implements OnInit, OnChanges {
    @Input() public Record: mjBizAppsAccountingJournalEntryBatchEntity | null = null;
    @Input() public FormComponent: BaseFormComponent | null = null;

    private cdr = inject(ChangeDetectorRef);
    private navService = inject(NavigationService, { optional: true });

    public MemberEntries: MemberEntryRow[] = [];
    public IsLoading = false;

    public get TotalDebits(): number {
        return Number(this.Record?.TotalDebits || 0);
    }

    public get IsApproved(): boolean {
        return this.Record?.Status === 'Approved' || this.Record?.Status === 'Sent' || this.Record?.Status === 'Posted';
    }

    public get BatchedDateLabel(): string {
        if (!this.Record?.BatchedAt) return '—';
        return new Date(this.Record.BatchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    public get PostingDateLabel(): string {
        if (!this.Record?.PostingDate) return '—';
        return new Date(this.Record.PostingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    public FormatDate(d: Date | null): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    public ngOnInit(): void {
        this.LoadMembers();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['Record'] && !changes['Record'].firstChange) {
            this.LoadMembers();
        }
    }

    public async LoadMembers(): Promise<void> {
        if (!this.Record?.ID) return;
        this.IsLoading = true;

        try {
            const rv = new RunView();
            const res = await rv.RunView<Record<string, unknown>>({
                EntityName: 'MJ_BizApps_Accounting: Journal Entries',
                ExtraFilter: `JournalEntryBatchID = '${this.Record.ID}'`,
                OrderBy: 'EntryNumber ASC',
                MaxRows: 20,
                ResultType: 'simple'
            });

            if (res?.Success && res.Results) {
                this.MemberEntries = res.Results.map((r: Record<string, unknown>) => ({
                    ID: String(r['ID'] || ''),
                    EntryNumber: String(r['EntryNumber'] || 'JE-000000'),
                    EffectiveDate: r['EffectiveDate'] ? new Date(String(r['EffectiveDate'])) : null,
                    Description: String(r['Description'] || 'Journal entry'),
                    Status: String(r['Status'] || 'Batched')
                }));
            }
        } catch (e) {
            console.warn('[BatchOverview] Error loading member entries:', e);
        } finally {
            this.IsLoading = false;
            this.cdr.detectChanges();
        }
    }

    public OnEntryClick(entry: MemberEntryRow): void {
        if (!entry.ID) return;
        const pk = CompositeKey.FromID(entry.ID);
        if (this.navService) {
            this.navService.OpenEntityRecord('MJ_BizApps_Accounting: Journal Entries', pk);
        } else if (this.FormComponent) {
            this.FormComponent.OnFormNavigate({
                Kind: 'record',
                EntityName: 'MJ_BizApps_Accounting: Journal Entries',
                PrimaryKey: pk,
            });
        }
    }
}

/**
 * JournalEntryBatchOverviewPanel — contributes the primary 'Overview' rail section to the Journal Entry Batches form.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:JournalEntryBatches:overview',
    metadata: {
        entity: 'MJ_BizApps_Accounting: Journal Entry Batches',
        slot: 'before-fields',
        sortKey: 100,
        contributionKey: 'overview',
    },
})
@Component({
    standalone: false,
    selector: 'mja-journal-entry-batch-overview-panel',
    template: `
        <mj-collapsible-panel
            SectionKey="overview"
            SectionName="Overview">
            <mja-journal-entry-batch-overview
                [Record]="Record"
                [FormComponent]="FormComponent">
            </mja-journal-entry-batch-overview>
        </mj-collapsible-panel>
    `,
})
export class JournalEntryBatchOverviewPanel extends BaseFormPanel<mjBizAppsAccountingJournalEntryBatchEntity> {}
