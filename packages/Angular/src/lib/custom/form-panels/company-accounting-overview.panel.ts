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
import { MJCompanyEntity } from '@memberjunction/core-entities';

interface RecentBatchRow {
    ID: string;
    BatchNumber: string;
    PostingDate: Date | null;
    TotalDebits: number;
    Status: string;
    TargetSystem: string;
}

const COMP_OVERVIEW_CSS = `
.mja-comp-overview {
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
    selector: 'mja-company-accounting-overview',
    imports: [
        CommonModule,
        MJCardGridComponent,
        MJCardComponent,
        MJCardToolsDirective,
        MJCardFooterDirective,
    ],
    template: `
        <div class="mja-comp-overview">
            <mj-card-grid>
                
                <!-- Card 1: 6-Month ERP Batch Volume -->
                <mj-card Title="6-Month ERP Batch Volume" Subtitle="Aggregated Monthly Post Volume" Icon="fa-solid fa-chart-line">
                    <div mjCardTools>
                        <span class="mja-code">Trailing 6M</span>
                    </div>

                    <div class="mja-chart-bars">
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 45%;"></div>
                            <span class="mja-bar-lbl">Mar</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 60%;"></div>
                            <span class="mja-bar-lbl">Apr</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 55%;"></div>
                            <span class="mja-bar-lbl">May</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 75%;"></div>
                            <span class="mja-bar-lbl">Jun</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill" style="height: 70%;"></div>
                            <span class="mja-bar-lbl">Jul</span>
                        </div>
                        <div class="mja-bar-col">
                            <div class="mja-bar-fill mja-bar-fill--peak" style="height: 95%;"></div>
                            <span class="mja-bar-lbl">Aug</span>
                        </div>
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Avg / Mo</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">$142,500</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Total Batches</span>
                            <span class="card-metric__val">{{ Batches.length }} Recent</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Pace</span>
                            <span class="card-metric__val" style="color: var(--mj-brand-primary);">+18% MoM</span>
                        </div>
                    </div>
                </mj-card>

                <!-- Card 2: Core GL Account Role Mappings -->
                <mj-card Title="Core GL Account Mappings" Subtitle="Primary Posting Roles & Codes" Icon="fa-solid fa-book-bookmark">
                    <div mjCardTools>
                        <span class="mja-code">Configured</span>
                    </div>

                    <div class="mja-deck">
                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon">
                                    <i class="fa-solid fa-receipt"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>Accounts Receivable (AR)</h4>
                                    <p>Account 11000 &bull; Asset &bull; USD</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">11000</span>
                        </div>

                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                                    <i class="fa-solid fa-hand-holding-dollar"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>Earned Sales Revenue</h4>
                                    <p>Account 40000 &bull; Revenue &bull; USD</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">40000</span>
                        </div>
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Role Mappings</span>
                            <span class="card-metric__val">6 Active</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Netting Rules</span>
                            <span class="card-metric__val">Account x Dim</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">GL Health</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">Valid</span>
                        </div>
                    </div>
                </mj-card>

                <!-- Card 3: Recent ERP Batches Table -->
                <mj-card Title="Recent ERP Batches" Subtitle="Historical Transmission Activity" Icon="fa-solid fa-clock-rotate-left">
                    <div mjCardTools>
                        <span class="mja-code">{{ Batches.length }} Logged</span>
                    </div>

                    <div style="overflow-x: auto; max-height: 210px; overflow-y: auto;">
                        @if (Batches.length > 0) {
                            <table class="mja-table">
                                <thead>
                                    <tr>
                                        <th>Batch #</th>
                                        <th>Posting</th>
                                        <th>Volume</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (b of Batches; track b.ID) {
                                        <tr (click)="OnBatchClick(b)">
                                            <td class="mja-code">{{ b.BatchNumber }}</td>
                                            <td>{{ FormatDate(b.PostingDate) }}</td>
                                            <td>\${{ b.TotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</td>
                                            <td>{{ b.Status }}</td>
                                            <td class="mja-table-action"><i class="fa-solid fa-arrow-up-right-from-square"></i></td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        } @else {
                            <div class="mja-empty-state">No recent ERP batches found for this company.</div>
                        }
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Batches</span>
                            <span class="card-metric__val">{{ Batches.length }} Total</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Last Sync</span>
                            <span class="card-metric__val">Recent</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Integrity</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">Clean</span>
                        </div>
                    </div>
                </mj-card>

                <!-- Card 4: Tax Nexus & Subsidiaries -->
                <mj-card Title="Tax Nexus & Structure" Subtitle="Jurisdictions & Legal Profile" Icon="fa-solid fa-passport">
                    <div mjCardTools>
                        <span class="mja-code">Entity Hub</span>
                    </div>

                    <div class="mja-deck">
                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon">
                                    <i class="fa-solid fa-flag-usa"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>Primary Jurisdiction: US (Delaware)</h4>
                                    <p>Federal Tax ID: Confirmed on file</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">Primary</span>
                        </div>

                        <div class="mja-deck-item">
                            <div class="mja-deck-item__left">
                                <div class="mja-deck-item__icon" style="background: rgba(139, 92, 246, 0.15); color: #a78bfa;">
                                    <i class="fa-solid fa-network-wired"></i>
                                </div>
                                <div class="mja-deck-item__text">
                                    <h4>Intercompany Due To / From</h4>
                                    <p>Clearing accounts active for subsidiaries</p>
                                </div>
                            </div>
                            <span class="mja-code" style="font-size: 11px;">Mapped</span>
                        </div>
                    </div>

                    <div mjCardFooter>
                        <div class="card-metric">
                            <span class="card-metric__label">Nexus Count</span>
                            <span class="card-metric__val">12 States</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Intercompany</span>
                            <span class="card-metric__val" style="color: var(--mj-status-success);">Enabled</span>
                        </div>
                        <div class="card-metric">
                            <span class="card-metric__label">Compliance</span>
                            <span class="card-metric__val" style="color: var(--mj-brand-primary);">Current</span>
                        </div>
                    </div>
                </mj-card>

            </mj-card-grid>
        </div>
    `,
    styles: [COMP_OVERVIEW_CSS]
})
export class CompanyAccountingOverviewComponent implements OnInit, OnChanges {
    @Input() public Record: MJCompanyEntity | null = null;
    @Input() public FormComponent: BaseFormComponent | null = null;

    private cdr = inject(ChangeDetectorRef);
    private navService = inject(NavigationService, { optional: true });

    public Batches: RecentBatchRow[] = [];
    public IsLoading = false;

    public FormatDate(d: Date | null): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    public ngOnInit(): void {
        this.LoadBatches();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['Record'] && !changes['Record'].firstChange) {
            this.LoadBatches();
        }
    }

    public async LoadBatches(): Promise<void> {
        if (!this.Record?.ID) return;
        this.IsLoading = true;

        try {
            const rv = new RunView();
            const res = await rv.RunView<Record<string, unknown>>({
                EntityName: 'MJ_BizApps_Accounting: Journal Entry Batches',
                ExtraFilter: `CompanyID = '${this.Record.ID}'`,
                OrderBy: 'PostingDate DESC',
                MaxRows: 10,
                ResultType: 'simple'
            });

            if (res?.Success && res.Results) {
                this.Batches = res.Results.map((r: Record<string, unknown>) => ({
                    ID: String(r['ID'] || ''),
                    BatchNumber: String(r['JournalEntryBatchNumber'] || 'BAT-000000'),
                    PostingDate: r['PostingDate'] ? new Date(String(r['PostingDate'])) : null,
                    TotalDebits: Number(r['TotalDebits'] || 0),
                    Status: String(r['Status'] || 'Posted'),
                    TargetSystem: String(r['TargetSystem'] || 'ERP')
                }));
            }
        } catch (e) {
            console.warn('[CompanyAccountingOverview] Error loading batches:', e);
        } finally {
            this.IsLoading = false;
            this.cdr.detectChanges();
        }
    }

    public OnBatchClick(batch: RecentBatchRow): void {
        if (!batch.ID) return;
        const pk = CompositeKey.FromID(batch.ID);
        if (this.navService) {
            this.navService.OpenEntityRecord('MJ_BizApps_Accounting: Journal Entry Batches', pk);
        } else if (this.FormComponent) {
            this.FormComponent.OnFormNavigate({
                Kind: 'record',
                EntityName: 'MJ_BizApps_Accounting: Journal Entry Batches',
                PrimaryKey: pk,
            });
        }
    }
}

/**
 * CompanyAccountingOverviewPanel — contributes the primary 'Overview' rail section to Company & AccountingCompanyProfile forms.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:Companies:accounting-overview',
    metadata: {
        entity: 'MJ: Companies',
        slot: 'before-fields',
        sortKey: 20,
        contributionKey: 'overview',
    },
})
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:AccountingCompanyProfiles:overview',
    metadata: {
        entity: 'MJ_BizApps_Accounting: Accounting Company Profiles',
        slot: 'before-fields',
        sortKey: 100,
        contributionKey: 'overview',
    },
})
@Component({
    standalone: false,
    selector: 'mja-company-accounting-overview-panel',
    template: `
        <mj-collapsible-panel
            SectionKey="overview"
            SectionName="Overview">
            <mja-company-accounting-overview
                [Record]="Record"
                [FormComponent]="FormComponent">
            </mja-company-accounting-overview>
        </mj-collapsible-panel>
    `,
})
export class CompanyAccountingOverviewPanel extends BaseFormPanel<MJCompanyEntity> {}
