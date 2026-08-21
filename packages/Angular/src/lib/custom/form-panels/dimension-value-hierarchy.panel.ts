import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule, FormNavigationEvent } from '@memberjunction/ng-base-forms';
import { HierarchyTreeComponent, HierarchyTreeConfig } from '@memberjunction/ng-hierarchy-tree';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { mjBizAppsAccountingDimensionValueEntity } from '@mj-biz-apps/accounting-entities';

/**
 * Visual Dimension Value Hierarchy & Taxonomy Tree Panel.
 *
 * Attaches to `MJ_BizApps_Accounting: Dimension Values` and renders an interactive
 * cost center and dimensional breakdown hierarchy powered by `@memberjunction/ng-hierarchy-tree`.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:DimensionValues:hierarchy',
    metadata: {
        entity: 'MJ_BizApps_Accounting: Dimension Values',
        slot: 'after-related',
        sortKey: 40,
        relatedEntity: 'MJ_BizApps_Accounting: Dimension Values',
        relatedJoinField: 'ParentDimensionValueID'
    }
})
@Component({
    selector: 'bizapps-dimension-value-hierarchy-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule, HierarchyTreeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <mj-collapsible-panel
            SectionKey="dimensionValueHierarchy"
            SectionName="Hierarchy"
            Icon="fa-solid fa-cubes"
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
export class DimensionValueHierarchyPanel extends BaseFormPanel<mjBizAppsAccountingDimensionValueEntity> {
    private readonly SETTING_KEY = 'mj.hierarchyTree.zoom.dimension_values';
    private _treeConfig: HierarchyTreeConfig | null = null;
    private _cachedRecordId: string | null = null;
    private _cachedDimensionId: string | null = null;

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
        const dimId = this.Record?.DimensionID || null;
        if (!this._treeConfig || this._cachedRecordId !== recId || this._cachedDimensionId !== dimId) {
            this._cachedRecordId = recId;
            this._cachedDimensionId = dimId;
            const filter = dimId ? `DimensionID = '${dimId}'` : '';
            this._treeConfig = {
                EntityName: 'MJ_BizApps_Accounting: Dimension Values',
                ParentField: 'ParentDimensionValueID',
                SubtitleField: 'Code',
                DefaultIcon: 'fa-solid fa-cube',
                DefaultColor: '#8b5cf6',
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
