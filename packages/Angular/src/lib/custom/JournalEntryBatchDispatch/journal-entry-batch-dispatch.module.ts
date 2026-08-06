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

import { JournalEntryBatchDispatchDashboardComponent } from './journal-entry-batch-dispatch-dashboard.component';
import { JournalEntryBatchDispatchResourceComponent } from './journal-entry-batch-dispatch-resource.component';

/**
 * Feature module for the Block 2 Batch Dispatch dashboard + its Explorer resource shim.
 * Declared (NgModule) rather than standalone to match the existing accounting-ng package pattern.
 */
@NgModule({
  declarations: [JournalEntryBatchDispatchDashboardComponent, JournalEntryBatchDispatchResourceComponent],
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
  exports: [JournalEntryBatchDispatchDashboardComponent, JournalEntryBatchDispatchResourceComponent],
})
export class JournalEntryBatchDispatchModule {}
