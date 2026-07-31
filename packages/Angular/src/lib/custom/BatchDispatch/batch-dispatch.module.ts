import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

import { BatchDispatchDashboardComponent } from './batch-dispatch-dashboard.component';
import { BatchDispatchResourceComponent } from './batch-dispatch-resource.component';

/**
 * Feature module for the Block 2 Batch Dispatch dashboard + its Explorer resource shim.
 * Declared (NgModule) rather than standalone to match the existing accounting-ng package pattern.
 */
@NgModule({
  declarations: [BatchDispatchDashboardComponent, BatchDispatchResourceComponent],
  imports: [
    CommonModule,
    FormsModule,
    SharedGenericModule,
    MJButtonDirective,
    MJPageLayoutComponent,
    MJPageHeaderComponent,
    MJPageBodyComponent,
    MJStatBadgeComponent,
    MJRefreshButtonComponent,
    MJEmptyStateComponent,
  ],
  exports: [BatchDispatchDashboardComponent, BatchDispatchResourceComponent],
})
export class BatchDispatchModule {}
