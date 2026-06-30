import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import { ColDef, GridOptions, GridReadyEvent, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { ReadModelDashboardBase } from '../shared/read-model-dashboard.base';
import { TrialBalanceRow, AROpenByCustomerRow, ARAgingRow } from '../shared/read-models.client';
import { READ_MODEL_GRID_THEME, READ_MODEL_DEFAULT_COL_DEF, moneyColumn } from '../shared/read-model.shared';

// Register AG Grid community modules once (idempotent across grids in the bundle).
ModuleRegistry.registerModules([AllCommunityModule]);

type TabKey = 'trial-balance' | 'open-ar' | 'aging';

/**
 * Trial Balance & AR — Block-6 read-model dashboard over three views:
 *   - vw_TrialBalance_AR    (per-GL-account Dr/Cr/net over committed JEs)
 *   - vw_AROpenByCustomer   (open AR balance per customer)
 *   - vw_ARAging            (open AR bucketed by age)
 * One company selector drives all three; each tab is an AG Grid. Read-only.
 */
@Component({
  standalone: false,
  selector: 'mj-trial-balance-ar-dashboard',
  templateUrl: './trial-balance-ar-dashboard.component.html',
  styleUrls: ['../shared/read-model-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'TrialBalanceARDashboard')
export class TrialBalanceARDashboardComponent extends ReadModelDashboardBase {
  public ActiveTab: TabKey = 'trial-balance';

  public TrialBalance: TrialBalanceRow[] = [];
  public OpenAR: AROpenByCustomerRow[] = [];
  public Aging: ARAgingRow[] = [];

  public readonly Theme = READ_MODEL_GRID_THEME;
  public readonly DefaultColDef = READ_MODEL_DEFAULT_COL_DEF;
  public readonly GridOptions: GridOptions = {
    animateRows: true, rowHeight: 36, headerHeight: 40, suppressCellFocus: true,
    enableCellTextSelection: true, suppressNoRowsOverlay: true,
  };

  public readonly TrialBalanceCols: ColDef<TrialBalanceRow>[] = [
    { field: 'GLAccountCode', headerName: 'Account', width: 130 },
    { field: 'GLAccountName', headerName: 'Name', flex: 2, minWidth: 200, tooltipField: 'GLAccountName' },
    { field: 'AccountType', headerName: 'Type', width: 140 },
    moneyColumn<TrialBalanceRow>('TotalDebits', 'Debits'),
    moneyColumn<TrialBalanceRow>('TotalCredits', 'Credits'),
    moneyColumn<TrialBalanceRow>('NetBalance', 'Net'),
    { field: 'EntryCount', headerName: 'Entries', width: 100, type: 'numericColumn' },
  ];

  public readonly OpenARCols: ColDef<AROpenByCustomerRow>[] = [
    { field: 'CustomerName', headerName: 'Customer', flex: 2, minWidth: 220, tooltipField: 'CustomerName' },
    moneyColumn<AROpenByCustomerRow>('OpenBalance', 'Open Balance', 150),
    moneyColumn<AROpenByCustomerRow>('TotalCharges', 'Charges'),
    moneyColumn<AROpenByCustomerRow>('TotalPayments', 'Payments'),
    { field: 'EntryCount', headerName: 'Entries', width: 100, type: 'numericColumn' },
  ];

  public readonly AgingCols: ColDef<ARAgingRow>[] = [
    { field: 'CustomerName', headerName: 'Customer', flex: 2, minWidth: 220, tooltipField: 'CustomerName' },
    moneyColumn<ARAgingRow>('Current_0_30', '0–30'),
    moneyColumn<ARAgingRow>('Days_31_60', '31–60'),
    moneyColumn<ARAgingRow>('Days_61_90', '61–90'),
    moneyColumn<ARAgingRow>('Days_Over_90', '90+'),
    moneyColumn<ARAgingRow>('TotalOpen', 'Total Open', 150),
  ];

  get DashboardTitle(): string { return 'Trial Balance & AR'; }

  public SetTab(tab: TabKey): void {
    this.ActiveTab = tab;
    this.cdr.markForCheck();
  }

  /** Total open AR across customers (a non-trivially-derived [meta] metric). */
  public get TotalOpenAR(): number {
    return this.OpenAR.reduce((sum, r) => sum + (r.OpenBalance ?? 0), 0);
  }

  /** Trial balance is "balanced" when total debits equal total credits across all accounts. */
  public get TrialBalanceIsBalanced(): boolean {
    const dr = this.TrialBalance.reduce((s, r) => s + (r.TotalDebits ?? 0), 0);
    const cr = this.TrialBalance.reduce((s, r) => s + (r.TotalCredits ?? 0), 0);
    return Math.abs(dr - cr) < 0.005;
  }

  /** Typed variant for the balanced/out-of-balance badge (strictTemplates needs the union, not a literal). */
  public get BalancedVariant(): MJStatBadgeVariant {
    return this.TrialBalanceIsBalanced ? 'success' : 'error';
  }

  public get BalancedIcon(): string {
    return this.TrialBalanceIsBalanced ? 'fa-solid fa-scale-balanced' : 'fa-solid fa-scale-unbalanced';
  }

  public get BalancedLabel(): string {
    return this.TrialBalanceIsBalanced ? 'Balanced' : 'Out of balance';
  }

  public OnGridReady(_event: GridReadyEvent): void {
    // No imperative API needed — rowData binding drives the grid.
  }

  protected async loadModel(companyID: string): Promise<void> {
    const c = this.client();
    const [tb, ar, aging] = await Promise.all([
      c.TrialBalance(companyID),
      c.AROpenByCustomer(companyID),
      c.ARAging(companyID),
    ]);
    this.TrialBalance = tb;
    this.OpenAR = ar;
    this.Aging = aging;
    this.cdr.markForCheck();
  }

  protected clearModel(): void {
    this.TrialBalance = [];
    this.OpenAR = [];
    this.Aging = [];
  }
}

/** Tree-shaking prevention — referencing the class is enough; called from public-api.ts. */
export function LoadTrialBalanceARDashboard(): void {
  // No-op. Static import + this call keep the @RegisterClass decorator from being shaken out.
}
