import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ColDef, GridOptions, GridReadyEvent, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { ReadModelDashboardBase } from '../shared/read-model-dashboard.base';
import { IntercompanyFlowRow } from '../shared/read-models.client';
import { READ_MODEL_GRID_THEME, READ_MODEL_DEFAULT_COL_DEF, moneyColumn, utcDateFormatter } from '../shared/read-model.shared';

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Intercompany Flow — Block-6 read-model dashboard over vw_IntercompanyFlow (every leg of an
 * intercompany flow, reassembled by JournalEntry.IntercompanyFlowID). The grid is sorted by
 * flow so each multi-leg flow reads as a contiguous block (row grouping is an AG Grid Enterprise
 * feature, not in the community bundle, so we keep a flat, flow-sorted grid). Read-only.
 */
@Component({
  standalone: false,
  selector: 'mj-intercompany-flow-dashboard',
  templateUrl: './intercompany-flow-dashboard.component.html',
  styleUrls: ['../shared/read-model-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'IntercompanyFlowDashboard')
export class IntercompanyFlowDashboardComponent extends ReadModelDashboardBase {
  public Legs: IntercompanyFlowRow[] = [];

  public readonly Theme = READ_MODEL_GRID_THEME;
  public readonly DefaultColDef = READ_MODEL_DEFAULT_COL_DEF;
  public readonly GridOptions: GridOptions<IntercompanyFlowRow> = {
    animateRows: true, rowHeight: 36, headerHeight: 40, suppressCellFocus: true,
    enableCellTextSelection: true, suppressNoRowsOverlay: true,
  };

  public readonly LegCols: ColDef<IntercompanyFlowRow>[] = [
    { field: 'EntryNumber', headerName: 'Entry', width: 180, tooltipField: 'EntryNumber', sort: 'asc' },
    { field: 'CompanyName', headerName: 'Company', flex: 1, minWidth: 150, tooltipField: 'CompanyName' },
    { field: 'CounterpartyName', headerName: 'Counterparty', flex: 1, minWidth: 150, tooltipField: 'CounterpartyName' },
    { field: 'LineNumber', headerName: 'Line', width: 80, type: 'numericColumn' },
    { field: 'GLAccountCode', headerName: 'Account', width: 120 },
    { field: 'AccountType', headerName: 'Type', width: 130 },
    moneyColumn<IntercompanyFlowRow>('DebitAmount', 'Debit'),
    moneyColumn<IntercompanyFlowRow>('CreditAmount', 'Credit'),
    { field: 'Status', headerName: 'Status', width: 120 },
    { field: 'EffectiveDate', headerName: 'Effective', width: 130, valueFormatter: utcDateFormatter },
  ];

  get DashboardTitle(): string { return 'Intercompany Flow'; }

  /** Distinct intercompany flows in view (a derived [meta] metric, not a row count). */
  public get FlowCount(): number {
    return new Set(this.Legs.map(l => l.IntercompanyFlowID).filter(Boolean)).size;
  }

  public OnGridReady(_event: GridReadyEvent): void { /* rowData binding drives the grid. */ }

  protected async loadModel(companyID: string): Promise<void> {
    this.Legs = await this.client().IntercompanyFlow(companyID);
    this.cdr.markForCheck();
  }

  protected clearModel(): void {
    this.Legs = [];
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadIntercompanyFlowDashboard(): void {
  // No-op.
}
