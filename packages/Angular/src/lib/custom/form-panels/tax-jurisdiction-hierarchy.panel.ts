import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule, FormNavigationEvent } from '@memberjunction/ng-base-forms';
import { HierarchyTreeComponent, HierarchyTreeConfig } from '@memberjunction/ng-hierarchy-tree';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { mjBizAppsAccountingTaxJurisdictionEntity } from '@mj-biz-apps/accounting-entities';

/**
 * Visual Tax Jurisdiction Hierarchy Tree Panel.
 *
 * Attaches to `MJ_BizApps_Accounting: Tax Jurisdictions` and renders an interactive
 * federal/state/county/city jurisdiction hierarchy powered by `@memberjunction/ng-hierarchy-tree`.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:TaxJurisdictions:hierarchy',
    metadata: {
        entity: 'MJ_BizApps_Accounting: Tax Jurisdictions',
        slot: 'after-related',
        sortKey: 40,
        relatedEntity: 'MJ_BizApps_Accounting: Tax Jurisdictions',
        relatedJoinField: 'ParentTaxJurisdictionID'
    }
})
@Component({
    selector: 'bizapps-tax-jurisdiction-hierarchy-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule, HierarchyTreeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <mj-collapsible-panel
            SectionKey="taxJurisdictionHierarchy"
            SectionName="Hierarchy"
            Icon="fa-solid fa-landmark"
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
export class TaxJurisdictionHierarchyPanel extends BaseFormPanel<mjBizAppsAccountingTaxJurisdictionEntity> {
    private readonly SETTING_KEY = 'mj.hierarchyTree.zoom.tax_jurisdictions';
    private _treeConfig: HierarchyTreeConfig | null = null;
    private _cachedRecordId: string | null = null;

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
        if (!this._treeConfig || this._cachedRecordId !== recId) {
            this._cachedRecordId = recId;
            this._treeConfig = {
                EntityName: 'MJ_BizApps_Accounting: Tax Jurisdictions',
                ParentField: 'ParentTaxJurisdictionID',
                SubtitleField: 'JurisdictionType',
                DefaultIcon: 'fa-solid fa-landmark',
                DefaultColor: '#f59e0b',
                ActiveRecordID: recId || undefined,
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
