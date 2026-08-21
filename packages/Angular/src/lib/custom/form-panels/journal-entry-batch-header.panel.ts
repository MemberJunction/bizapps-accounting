import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import { UserInfoEngine } from '@memberjunction/core-entities';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

const BATCH_HERO_CSS = `
.mj-batch-hero {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    background: var(--mj-bg-surface-card, #141f36);
    border: 1px solid var(--mj-border-default, #223254);
    border-radius: var(--mj-radius-lg, 14px);
    transition: all 0.2s ease;
}

.mj-batch-hero--collapsed {
    padding: 12px 16px;
}

.mj-batch-hero__main-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
}

.mj-batch-hero__identity {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}

.mj-batch-hero__avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, #0ea5e9, #0369a1);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
}

.mj-batch-hero--collapsed .mj-batch-hero__avatar {
    width: 30px;
    height: 30px;
    font-size: 12px;
    border-radius: 6px;
}

.mj-batch-hero__copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.mj-batch-hero__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.mj-batch-hero__title {
    font-size: 17px;
    font-weight: 700;
    color: var(--mj-text-primary, #f8fafc);
    margin: 0;
    line-height: 1.25;
}

.mj-batch-hero--collapsed .mj-batch-hero__title {
    font-size: 14px;
}

.mj-batch-hero__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--mj-text-secondary, #94a3b8);
    font-size: 12.5px;
}

.mj-batch-hero__collapse-btn {
    width: 30px;
    height: 30px;
    border-radius: var(--mj-radius-sm, 6px);
    background: var(--mj-bg-surface, #111a2e);
    border: 1px solid var(--mj-border-default, #223254);
    color: var(--mj-text-secondary, #94a3b8);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
}

.mj-batch-hero__collapse-btn:hover {
    color: var(--mj-text-primary, #f8fafc);
    border-color: var(--mj-brand-primary, #38bdf8);
    background: rgba(56, 189, 248, 0.1);
}

.mj-batch-hero__expanded {
    padding-top: 14px;
    border-top: 1px solid var(--mj-border-subtle, rgba(255, 255, 255, 0.06));
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: mjBatchFadeIn 0.2s ease;
}

.mj-batch-hero__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 12px;
}

.mj-batch-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.mj-batch-stat__label {
    font-size: 10px;
    font-weight: 700;
    color: var(--mj-text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.mj-batch-stat__value {
    font-size: 14px;
    font-weight: 700;
    color: var(--mj-text-primary, #f8fafc);
}

.mj-batch-stat__value--accent { color: var(--mj-brand-primary, #38bdf8); }
.mj-batch-stat__value--success { color: var(--mj-status-success, #10b981); }
.mj-batch-stat__value--warn { color: var(--mj-status-warning, #f59e0b); }

.mj-batch-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.mj-batch-badge--blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
.mj-batch-badge--green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
.mj-batch-badge--amber { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
.mj-batch-badge--gray { background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25); }

.mj-batch-code {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--mj-brand-primary, #38bdf8);
}

@keyframes mjBatchFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
}
`;

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:JournalEntryBatches:header',
    metadata: {
        entity: 'MJ_BizApps_Accounting: Journal Entry Batches',
        slot: 'header',
        sortKey: 100,
        contributionKey: 'header',
    },
})
@Component({
    standalone: false,
    selector: 'mja-journal-entry-batch-header-panel',
    template: `
        <div class="mj-batch-hero" [class.mj-batch-hero--collapsed]="IsCollapsed">
            <div class="mj-batch-hero__main-row">
                <div class="mj-batch-hero__identity">
                    <div class="mj-batch-hero__avatar">
                        <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                    </div>
                    <div class="mj-batch-hero__copy">
                        <div class="mj-batch-hero__title-row">
                            <span class="mj-batch-code" style="font-size: 14px;">{{ BatchNumber }}</span>
                            <h1 class="mj-batch-hero__title">{{ TargetSystem }} ERP Batch</h1>
                            <span [class]="StatusBadgeClass">{{ Status }}</span>
                            <span class="mj-batch-badge mj-batch-badge--blue">{{ TargetSystem }}</span>
                        </div>
                        <div class="mj-batch-hero__meta">
                            <span>Posting Date: <strong>{{ PostingDateLabel }}</strong></span>
                            <span>&bull;</span>
                            <span>Total Volume: <strong>\${{ TotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</strong></span>
                            <span>&bull;</span>
                            <span>Entries: <strong>{{ TotalEntries }}</strong></span>
                        </div>
                    </div>
                </div>

                <button class="mj-batch-hero__collapse-btn" (click)="ToggleCollapse()" [title]="IsCollapsed ? 'Expand details' : 'Collapse details'" type="button">
                    <i class="fa-solid" [class.fa-chevron-up]="!IsCollapsed" [class.fa-chevron-down]="IsCollapsed"></i>
                </button>
            </div>

            @if (!IsCollapsed) {
                <div class="mj-batch-hero__expanded">
                    <div class="mj-batch-hero__stats">
                        <div class="mj-batch-stat">
                            <span class="mj-batch-stat__label">Total Volume</span>
                            <span class="mj-batch-stat__value mj-batch-stat__value--success">
                                \${{ TotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                            </span>
                        </div>
                        <div class="mj-batch-stat">
                            <span class="mj-batch-stat__label">Member Entries</span>
                            <span class="mj-batch-stat__value mj-batch-stat__value--accent">{{ TotalEntries }} JEs</span>
                        </div>
                        <div class="mj-batch-stat">
                            <span class="mj-batch-stat__label">Target ERP</span>
                            <span class="mj-batch-stat__value">{{ TargetSystem }}</span>
                        </div>
                        <div class="mj-batch-stat">
                            <span class="mj-batch-stat__label">Transmission Status</span>
                            <span class="mj-batch-stat__value mj-batch-stat__value--warn">{{ Status }}</span>
                        </div>
                    </div>
                </div>
            }
        </div>
    `,
    styles: [BATCH_HERO_CSS]
})
export class JournalEntryBatchHeaderPanel extends BaseFormPanel<mjBizAppsAccountingJournalEntryBatchEntity> implements OnInit {
    private cdr = inject(ChangeDetectorRef);
    public IsCollapsed = false;

    private get StorageKey(): string {
        const id = this.Record?.ID ? String(this.Record.ID).toLowerCase() : 'new';
        return `mj.batchHero.collapsed.${id}`;
    }

    public ngOnInit(): void {
        const raw = UserInfoEngine.Instance.GetSetting(this.StorageKey);
        if (raw) {
            try {
                this.IsCollapsed = JSON.parse(raw) === true;
            } catch {
                this.IsCollapsed = false;
            }
        }
    }

    public ToggleCollapse(): void {
        this.IsCollapsed = !this.IsCollapsed;
        UserInfoEngine.Instance.SetSettingDebounced(this.StorageKey, JSON.stringify(this.IsCollapsed));
        this.cdr.detectChanges();
    }

    public get BatchNumber(): string {
        return this.Record?.JournalEntryBatchNumber || 'BAT-PENDING';
    }

    public get TargetSystem(): string {
        return this.Record?.TargetSystem || 'ERP';
    }

    public get Status(): string {
        return this.Record?.Status || 'Pending';
    }

    public get TotalEntries(): number {
        return this.Record?.TotalEntries || 0;
    }

    public get TotalDebits(): number {
        return Number(this.Record?.TotalDebits || 0);
    }

    public get PostingDateLabel(): string {
        if (!this.Record?.PostingDate) return 'Pending Date';
        return new Date(this.Record.PostingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    public get StatusBadgeClass(): string {
        switch (this.Status) {
            case 'Posted': return 'mj-batch-badge mj-batch-badge--green';
            case 'Approved': return 'mj-batch-badge mj-batch-badge--blue';
            case 'Sent': return 'mj-batch-badge mj-batch-badge--amber';
            case 'Failed': return 'mj-batch-badge mj-batch-badge--amber';
            default: return 'mj-batch-badge mj-batch-badge--gray';
        }
    }
}
