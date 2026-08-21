import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import { UserInfoEngine, MJCompanyEntity } from '@memberjunction/core-entities';
import { RunView } from '@memberjunction/core';

const COMPANY_ACCOUNTING_HERO_CSS = `
.mja-comp-hero {
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

.mja-comp-hero--collapsed {
    padding: 12px 16px;
}

.mja-comp-hero__main-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
}

.mja-comp-hero__identity {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}

.mja-comp-hero__avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, #10b981, #047857);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
}

.mja-comp-hero--collapsed .mja-comp-hero__avatar {
    width: 30px;
    height: 30px;
    font-size: 12px;
    border-radius: 6px;
}

.mja-comp-hero__copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.mja-comp-hero__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.mja-comp-hero__title {
    font-size: 17px;
    font-weight: 700;
    color: var(--mj-text-primary, #f8fafc);
    margin: 0;
    line-height: 1.25;
}

.mja-comp-hero--collapsed .mja-comp-hero__title {
    font-size: 14px;
}

.mja-comp-hero__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--mj-text-secondary, #94a3b8);
    font-size: 12.5px;
}

.mja-comp-hero__collapse-btn {
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

.mja-comp-hero__collapse-btn:hover {
    color: var(--mj-text-primary, #f8fafc);
    border-color: var(--mj-brand-primary, #38bdf8);
    background: rgba(56, 189, 248, 0.1);
}

.mja-comp-hero__expanded {
    padding-top: 14px;
    border-top: 1px solid var(--mj-border-subtle, rgba(255, 255, 255, 0.06));
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: mjaCompFadeIn 0.2s ease;
}

.mja-comp-hero__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 12px;
}

.mja-comp-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.mja-comp-stat__label {
    font-size: 10px;
    font-weight: 700;
    color: var(--mj-text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.mja-comp-stat__value {
    font-size: 14px;
    font-weight: 700;
    color: var(--mj-text-primary, #f8fafc);
}

.mja-comp-stat__value--accent { color: var(--mj-brand-primary, #38bdf8); }
.mja-comp-stat__value--success { color: var(--mj-status-success, #10b981); }

.mja-comp-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.mja-comp-badge--emerald { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
.mja-comp-badge--blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }

.mja-comp-code {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--mj-brand-primary, #38bdf8);
}

@keyframes mjaCompFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
}
`;

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:Companies:accounting-header',
    metadata: {
        entity: 'MJ: Companies',
        slot: 'header',
        sortKey: 20,
        contributionKey: 'header',
    },
})
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:AccountingCompanyProfiles:header',
    metadata: {
        entity: 'MJ_BizApps_Accounting: Accounting Company Profiles',
        slot: 'header',
        sortKey: 100,
        contributionKey: 'header',
    },
})
@Component({
    standalone: false,
    selector: 'mja-company-accounting-header-panel',
    template: `
        <div class="mja-comp-hero" [class.mja-comp-hero--collapsed]="IsCollapsed">
            <div class="mja-comp-hero__main-row">
                <div class="mja-comp-hero__identity">
                    <div class="mja-comp-hero__avatar">
                        <i class="fa-solid fa-landmark" aria-hidden="true"></i>
                    </div>
                    <div class="mja-comp-hero__copy">
                        <div class="mja-comp-hero__title-row">
                            @if (CompanyCode) {
                                <span class="mja-comp-code" style="font-size: 14px;">{{ CompanyCode }}</span>
                            }
                            <h1 class="mja-comp-hero__title">{{ DisplayName }}</h1>
                            <span class="mja-comp-badge mja-comp-badge--emerald">{{ LegalStructure }}</span>
                            <span class="mja-comp-badge mja-comp-badge--blue">{{ CurrencyCode }}</span>
                        </div>
                        <div class="mja-comp-hero__meta">
                            <span>Functional Currency: <strong>{{ CurrencyCode }}</strong></span>
                            <span>&bull;</span>
                            <span>Jurisdiction: <strong>{{ Jurisdiction }}</strong></span>
                            @if (TaxID) {
                                <span>&bull;</span>
                                <span>Tax ID: <strong>{{ TaxID }}</strong></span>
                            }
                        </div>
                    </div>
                </div>

                <button class="mja-comp-hero__collapse-btn" (click)="ToggleCollapse()" [title]="IsCollapsed ? 'Expand details' : 'Collapse details'" type="button">
                    <i class="fa-solid" [class.fa-chevron-up]="!IsCollapsed" [class.fa-chevron-down]="IsCollapsed"></i>
                </button>
            </div>

            @if (!IsCollapsed) {
                <div class="mja-comp-hero__expanded">
                    <div class="mja-comp-hero__stats">
                        <div class="mja-comp-stat">
                            <span class="mja-comp-stat__label">Legal Structure</span>
                            <span class="mja-comp-stat__value mj-batch-stat__value--success">{{ LegalStructure }}</span>
                        </div>
                        <div class="mja-comp-stat">
                            <span class="mja-comp-stat__label">Currency</span>
                            <span class="mja-comp-stat__value mja-comp-stat__value--accent">{{ CurrencyCode }}</span>
                        </div>
                        <div class="mja-comp-stat">
                            <span class="mja-comp-stat__label">Operating Timezone</span>
                            <span class="mja-comp-stat__value">{{ TimeZone }}</span>
                        </div>
                        <div class="mja-comp-stat">
                            <span class="mja-comp-stat__label">Fiscal Year Start</span>
                            <span class="mja-comp-stat__value">{{ FiscalYearStart }}</span>
                        </div>
                    </div>
                </div>
            }
        </div>
    `,
    styles: [COMPANY_ACCOUNTING_HERO_CSS]
})
export class CompanyAccountingHeaderPanel extends BaseFormPanel<MJCompanyEntity> implements OnInit {
    private cdr = inject(ChangeDetectorRef);
    public IsCollapsed = false;

    public CompanyCode = '';
    public CurrencyCode = 'USD';
    public LegalStructure = 'Legal Entity';
    public Jurisdiction = 'United States';
    public TaxID = '';
    public TimeZone = 'America/New_York';
    public FiscalYearStart = 'Jan 1';

    private get StorageKey(): string {
        const id = this.Record?.ID ? String(this.Record.ID).toLowerCase() : 'new';
        return `mj.companyAccountingHero.collapsed.${id}`;
    }

    public async ngOnInit(): Promise<void> {
        const raw = UserInfoEngine.Instance.GetSetting(this.StorageKey);
        if (raw) {
            try {
                this.IsCollapsed = JSON.parse(raw) === true;
            } catch {
                this.IsCollapsed = false;
            }
        }

        await this.LoadProfile();
    }

    public async LoadProfile(): Promise<void> {
        if (!this.Record?.ID) return;

        try {
            const rv = new RunView();
            const res = await rv.RunView<Record<string, unknown>>({
                EntityName: 'MJ_BizApps_Accounting: Accounting Company Profiles',
                ExtraFilter: `ID = '${this.Record.ID}'`,
                ResultType: 'simple'
            });

            if (res?.Success && res.Results?.[0]) {
                const p = res.Results[0];
                this.CompanyCode = String(p['CompanyCode'] || '');
                this.CurrencyCode = String(p['FunctionalCurrencyCode'] || 'USD');
                this.LegalStructure = String(p['LegalStructureType'] || p['EntityType'] || 'Corporation');
                this.Jurisdiction = String(p['JurisdictionCountry'] || 'US');
                this.TaxID = String(p['FederalTaxID'] || '');
                this.TimeZone = String(p['OperatingTimeZone'] || 'America/New_York');
                const m = Number(p['FiscalYearStartMonth'] || 1);
                const d = Number(p['FiscalYearStartDay'] || 1);
                const date = new Date(2026, m - 1, d);
                this.FiscalYearStart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                this.cdr.detectChanges();
            }
        } catch (e) {
            console.warn('[CompanyAccountingHeader] Error loading profile:', e);
        }
    }

    public ToggleCollapse(): void {
        this.IsCollapsed = !this.IsCollapsed;
        UserInfoEngine.Instance.SetSettingDebounced(this.StorageKey, JSON.stringify(this.IsCollapsed));
        this.cdr.detectChanges();
    }

    public get DisplayName(): string {
        return this.Record?.Name || 'Accounting Company';
    }
}
