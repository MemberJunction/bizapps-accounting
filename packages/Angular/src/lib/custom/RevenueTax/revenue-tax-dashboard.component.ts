import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import { ColDef, GridOptions, GridReadyEvent, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { ReadModelDashboardBase } from '../shared/read-model-dashboard.base';
import { DefRevRollforwardRow, SalesTaxLiabilityRow } from '../shared/read-models.client';
import { READ_MODEL_GRID_THEME, READ_MODEL_DEFAULT_COL_DEF, moneyColumn, utcDateFormatter } from '../shared/read-model.shared';

ModuleRegistry.registerModules([AllCommunityModule]);

type TabKey = 'deferred-revenue' | 'sales-tax';

/**
 * Revenue & Tax — Block-6 read-model dashboard over two views:
 *   - vw_DefRevRollforward  (deferred-revenue opening/additions/releases/closing per period)
 *   - vw_SalesTaxLiability  (accrued vs remitted sales-tax liability per authority/jurisdiction/period)
 * One company selector drives both; each tab is an AG Grid. Read-only.
 */
@Component({
  standalone: false,
  selector: 'mj-revenue-tax-dashboard',
  templateUrl: './revenue-tax-dashboard.component.html',
  styleUrls: ['../shared/read-model-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'RevenueTaxDashboard')
export class RevenueTaxDashboardComponent extends ReadModelDashboardBase {
  public ActiveTab: TabKey = 'deferred-revenue';

  public DeferredRevenue: DefRevRollforwardRow[] = [];
  public SalesTax: SalesTaxLiabilityRow[] = [];

  public readonly Theme = READ_MODEL_GRID_THEME;
  public readonly DefaultColDef = READ_MODEL_DEFAULT_COL_DEF;
  public readonly GridOptions: GridOptions = {
    animateRows: true, rowHeight: 36, headerHeight: 40, suppressCellFocus: true,
    enableCellTextSelection: true, suppressNoRowsOverlay: true,
  };

  public readonly DeferredRevenueCols: ColDef<DefRevRollforwardRow>[] = [
    { field: 'FiscalYear', headerName: 'FY', width: 90, type: 'numericColumn' },
    { field: 'PeriodType', headerName: 'Period', width: 110 },
    { field: 'PeriodStart', headerName: 'Start', width: 130, valueFormatter: utcDateFormatter },
    moneyColumn<DefRevRollforwardRow>('OpeningBalance', 'Opening', 140),
    moneyColumn<DefRevRollforwardRow>('Additions', 'Additions'),
    moneyColumn<DefRevRollforwardRow>('Releases', 'Releases'),
    moneyColumn<DefRevRollforwardRow>('NetChange', 'Net Change'),
    moneyColumn<DefRevRollforwardRow>('ClosingBalance', 'Closing', 140),
  ];

  public readonly SalesTaxCols: ColDef<SalesTaxLiabilityRow>[] = [
    { field: 'AuthorityName', headerName: 'Authority', flex: 1, minWidth: 160, tooltipField: 'AuthorityName' },
    { field: 'JurisdictionName', headerName: 'Jurisdiction', flex: 1, minWidth: 160, tooltipField: 'JurisdictionName' },
    { field: 'FiscalYear', headerName: 'FY', width: 90, type: 'numericColumn' },
    { field: 'PeriodType', headerName: 'Period', width: 110 },
    moneyColumn<SalesTaxLiabilityRow>('AccruedAmount', 'Accrued'),
    moneyColumn<SalesTaxLiabilityRow>('RemittedAmount', 'Remitted'),
    moneyColumn<SalesTaxLiabilityRow>('OutstandingLiability', 'Outstanding', 150),
    { field: 'Status', headerName: 'Status', width: 120 },
    { field: 'DueDate', headerName: 'Due', width: 130, valueFormatter: utcDateFormatter },
  ];

  get DashboardTitle(): string { return 'Revenue & Tax'; }

  public SetTab(tab: TabKey): void {
    this.ActiveTab = tab;
    this.cdr.markForCheck();
  }

  /** Total outstanding sales-tax liability across authorities (a derived [meta] metric). */
  public get TotalOutstandingTax(): number {
    return this.SalesTax.reduce((s, r) => s + (r.OutstandingLiability ?? 0), 0);
  }

  /** Latest period's deferred-revenue closing balance (the headline rollforward number). */
  public get LatestDeferredClosing(): number {
    return this.DeferredRevenue.length ? (this.DeferredRevenue[this.DeferredRevenue.length - 1].ClosingBalance ?? 0) : 0;
  }

  /** Typed badge variant for outstanding tax (warning when any is owed, else success). */
  public get OutstandingTaxVariant(): MJStatBadgeVariant {
    return this.TotalOutstandingTax > 0 ? 'warning' : 'success';
  }

  public OnGridReady(_event: GridReadyEvent): void { /* rowData binding drives the grid. */ }

  protected async loadModel(companyID: string): Promise<void> {
    const c = this.client();
    const [defrev, tax] = await Promise.all([
      c.DefRevRollforward(companyID),
      c.SalesTaxLiability(companyID),
    ]);
    this.DeferredRevenue = defrev;
    this.SalesTax = tax;
    this.cdr.markForCheck();
  }

  protected clearModel(): void {
    this.DeferredRevenue = [];
    this.SalesTax = [];
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadRevenueTaxDashboard(): void {
  // No-op.
}
