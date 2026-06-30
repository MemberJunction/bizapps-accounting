import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { ColDef, GridOptions, GridReadyEvent, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { ReadModelDashboardBase } from '../shared/read-model-dashboard.base';
import { BatchDispatchStatusRow } from '../shared/read-models.client';
import { READ_MODEL_GRID_THEME, READ_MODEL_DEFAULT_COL_DEF, moneyColumn, utcDateFormatter } from '../shared/read-model.shared';

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Batch Status — read-only Block-6 summary over vw_BatchDispatchStatus (batch lifecycle +
 * control totals + summary-line count per company). This overlaps the stage-1 Batch Dispatch
 * dashboard, but that one is the action surface (build/approve/dispatch); this is the read-only
 * reporting roll-up driven by the view. Summary cards by status + an AG Grid of every batch.
 */
@Component({
  standalone: false,
  selector: 'mj-batch-status-dashboard',
  templateUrl: './batch-status-dashboard.component.html',
  styleUrls: ['../shared/read-model-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'BatchStatusDashboard')
export class BatchStatusDashboardComponent extends ReadModelDashboardBase {
  public Batches: BatchDispatchStatusRow[] = [];

  public readonly Theme = READ_MODEL_GRID_THEME;
  public readonly DefaultColDef = READ_MODEL_DEFAULT_COL_DEF;
  public readonly GridOptions: GridOptions = {
    animateRows: true, rowHeight: 36, headerHeight: 40, suppressCellFocus: true,
    enableCellTextSelection: true, suppressNoRowsOverlay: true,
  };

  public readonly BatchCols: ColDef<BatchDispatchStatusRow>[] = [
    { field: 'BatchNumber', headerName: 'Batch', flex: 1, minWidth: 180, tooltipField: 'BatchNumber' },
    { field: 'TargetSystem', headerName: 'Target', width: 150 },
    { field: 'Status', headerName: 'Status', width: 140 },
    { field: 'FiscalYear', headerName: 'FY', width: 90, type: 'numericColumn' },
    { field: 'TotalEntries', headerName: 'JEs', width: 90, type: 'numericColumn' },
    { field: 'SummaryLineCount', headerName: 'Lines', width: 90, type: 'numericColumn' },
    moneyColumn<BatchDispatchStatusRow>('TotalDebits', 'Debits'),
    moneyColumn<BatchDispatchStatusRow>('TotalCredits', 'Credits'),
    { field: 'ExternalBatchRef', headerName: 'ERP Ref', width: 150 },
    { field: 'BatchedAt', headerName: 'Batched', width: 130, valueFormatter: utcDateFormatter, sort: 'desc' },
  ];

  get DashboardTitle(): string { return 'Batch Status'; }

  public get TotalBatches(): number { return this.Batches.length; }
  public get PendingCount(): number { return this.Batches.filter(b => b.Status === 'Pending').length; }
  public get SentCount(): number { return this.Batches.filter(b => b.Status === 'Sent').length; }
  public get AcknowledgedCount(): number { return this.Batches.filter(b => b.Status === 'Acknowledged').length; }
  public get FailedCount(): number { return this.Batches.filter(b => b.Status === 'Failed').length; }

  public OnGridReady(_event: GridReadyEvent): void { /* rowData binding drives the grid. */ }

  protected async loadModel(companyID: string): Promise<void> {
    this.Batches = await this.client().BatchDispatchStatus(companyID);
    this.cdr.markForCheck();
  }

  protected clearModel(): void {
    this.Batches = [];
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadBatchStatusDashboard(): void {
  // No-op.
}
