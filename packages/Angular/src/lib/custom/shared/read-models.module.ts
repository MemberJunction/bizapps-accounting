import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';

// Loading indicator (mj-loading is NgModule-declared, not standalone — import its module).
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';

// Standalone chrome + UI primitives.
import {
  MJButtonDirective,
  MJPageLayoutComponent,
  MJPageHeaderComponent,
  MJPageBodyComponent,
  MJStatBadgeComponent,
  MJRefreshButtonComponent,
  MJEmptyStateComponent,
} from '@memberjunction/ng-ui-components';

import { TrialBalanceARDashboardComponent } from '../TrialBalanceAR/trial-balance-ar-dashboard.component';
import { TrialBalanceARResourceComponent } from '../TrialBalanceAR/trial-balance-ar-resource.component';
import { RevenueTaxDashboardComponent } from '../RevenueTax/revenue-tax-dashboard.component';
import { RevenueTaxResourceComponent } from '../RevenueTax/revenue-tax-resource.component';
import { BatchStatusDashboardComponent } from '../BatchStatus/batch-status-dashboard.component';
import { BatchStatusResourceComponent } from '../BatchStatus/batch-status-resource.component';
import { IntercompanyFlowDashboardComponent } from '../Intercompany/intercompany-flow-dashboard.component';
import { IntercompanyFlowResourceComponent } from '../Intercompany/intercompany-flow-resource.component';

/**
 * Feature module for the four Stage-2 read-model dashboards (Trial Balance & AR, Revenue & Tax,
 * Batch Status, Intercompany Flow) + their Explorer resource shims. Declared (NgModule) rather
 * than standalone to match the existing accounting-ng package pattern (mirrors BatchDispatchModule).
 */
@NgModule({
  declarations: [
    TrialBalanceARDashboardComponent, TrialBalanceARResourceComponent,
    RevenueTaxDashboardComponent, RevenueTaxResourceComponent,
    BatchStatusDashboardComponent, BatchStatusResourceComponent,
    IntercompanyFlowDashboardComponent, IntercompanyFlowResourceComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    SharedGenericModule,
    MJButtonDirective,
    MJPageLayoutComponent,
    MJPageHeaderComponent,
    MJPageBodyComponent,
    MJStatBadgeComponent,
    MJRefreshButtonComponent,
    MJEmptyStateComponent,
  ],
  exports: [
    TrialBalanceARDashboardComponent, TrialBalanceARResourceComponent,
    RevenueTaxDashboardComponent, RevenueTaxResourceComponent,
    BatchStatusDashboardComponent, BatchStatusResourceComponent,
    IntercompanyFlowDashboardComponent, IntercompanyFlowResourceComponent,
  ],
})
export class ReadModelsModule {}
