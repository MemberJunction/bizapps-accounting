import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedGenericModule } from '@memberjunction/ng-shared-generic';

import {
  MJButtonDirective,
  MJPageLayoutComponent,
  MJPageHeaderComponent,
  MJPageBodyComponent,
  MJStatBadgeComponent,
  MJRefreshButtonComponent,
  MJEmptyStateComponent,
} from '@memberjunction/ng-ui-components';

import { BatchApprovalsDashboardComponent } from './batch-approvals-dashboard.component';
import { BatchApprovalsResourceComponent } from './batch-approvals-resource.component';

/**
 * Feature module for the Batch Approvals inbox dashboard + its Explorer resource shim.
 * NgModule-declared to match the accounting-ng package pattern.
 */
@NgModule({
  declarations: [BatchApprovalsDashboardComponent, BatchApprovalsResourceComponent],
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
  exports: [BatchApprovalsDashboardComponent, BatchApprovalsResourceComponent],
})
export class BatchApprovalsModule {}
