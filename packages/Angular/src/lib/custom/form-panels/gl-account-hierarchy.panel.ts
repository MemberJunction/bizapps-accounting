import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule, FormNavigationEvent } from '@memberjunction/ng-base-forms';
import { HierarchyTreeComponent, HierarchyTreeConfig } from '@memberjunction/ng-hierarchy-tree';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { mjBizAppsAccountingGLAccountEntity } from '@mj-biz-apps/accounting-entities';

/**
 * Visual GL Account Chart of Accounts & Hierarchy Tree Panel.
 *
 * Attaches to `MJ_BizApps_Accounting: GL Accounts` and renders an interactive
 * chart of accounts hierarchy visualizer powered by `@memberjunction/ng-hierarchy-tree`.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:GLAccounts:hierarchy',
    metadata: {
        entity: 'MJ_BizApps_Accounting: GL Accounts',
        slot: 'after-related',
        sortKey: 40,
        relatedEntity: 'MJ_BizApps_Accounting: GL Accounts',
        relatedJoinField: 'ParentGLAccountID'
    }
})
@Component({
    selector: 'bizapps-gl-account-hierarchy-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule, HierarchyTreeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <mj-collapsible-panel
            SectionKey="glAccountHierarchy"
            SectionName="Hierarchy"
            Icon="fa-solid fa-sitemap"
            Variant="related-entity"
            [Form]="FormComponent"
            [FormContext]="FormContext"
            [DefaultExpanded]="true">
            @if (Record.IsSaved) {
                <mj-hierarchy-tree
                    [Config]="treeConfig"
                    [ZoomLevel]="persistedZoomLevel"
                    (ZoomChange)="onZoomChange($event)"
                    (Navigate)="onNavigate($event)">
                </mj-hierarchy-tree>
            }
        </mj-collapsible-panel>
    `,
    styles: [`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            min-height: 640px;
            min-height: calc(100vh - 280px);
            flex: 1;
            margin-bottom: 20px;
        }
    `]
})
export class GLAccountHierarchyPanel extends BaseFormPanel<mjBizAppsAccountingGLAccountEntity> {
    private readonly SETTING_KEY = 'mj.hierarchyTree.zoom.gl_accounts';
    private _treeConfig: HierarchyTreeConfig | null = null;
    private _cachedRecordId: string | null = null;
    private _cachedCompanyId: string | null = null;

    public get persistedZoomLevel(): number | undefined {
        const raw = UserInfoEngine.Instance.GetSetting(this.SETTING_KEY);
        return raw ? parseFloat(raw) : undefined;
    }

    public onZoomChange(zoom: number): void {
        UserInfoEngine.Instance.SetSettingDebounced(this.SETTING_KEY, zoom.toFixed(2));
    }

    public onNavigate(event: FormNavigationEvent): void {
        if (this.FormComponent?.OnFormNavigate) {
            this.FormComponent.OnFormNavigate(event);
        }
    }

    public get treeConfig(): HierarchyTreeConfig {
        const recId = this.Record?.ID || null;
        const compId = this.Record?.CompanyID || null;
        if (!this._treeConfig || this._cachedRecordId !== recId || this._cachedCompanyId !== compId) {
            this._cachedRecordId = recId;
            this._cachedCompanyId = compId;
            const filter = compId ? `CompanyID = '${compId}'` : '';
            this._treeConfig = {
                EntityName: 'MJ_BizApps_Accounting: GL Accounts',
                ParentField: 'ParentGLAccountID',
                SubtitleField: 'AccountType',
                DefaultIcon: 'fa-solid fa-book',
                DefaultColor: '#3b82f6',
                ActiveRecordID: recId || undefined,
                ExtraFilter: filter,
                Height: '100%',
                MinHeight: '640px',
                ShowSearch: true,
                ShowToolbar: true,
                Orientation: 'top-to-bottom'
            };
        }
        return this._treeConfig;
    }
}
