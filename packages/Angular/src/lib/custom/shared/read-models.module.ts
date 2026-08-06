import { MJACheckDropdownComponent } from './check-dropdown.component';
/**
 * ReadModelsModule — now hosts ONLY the Batch Status dashboard + its Explorer resource shim
 * (embedded by the Batches category shell).
 *
 * Its former siblings — TrialBalanceAR, RevenueTax, IntercompanyFlow — were DELETED 2026-07-29
 * (Amith PR-27 dead-code sweep): their vw_* read-model backends were removed 2026-07-22 ("overdone
 * — revisit if ever needed") and the category shells replaced their nav items. When reporting
 * returns (item f), each report is rebuilt as-needed on RunQuery (four-surface doctrine) — the old
 * dashboards live in git history as reference only. The module name is kept to avoid churning the
 * package surface; fold BatchStatus into another module and delete this one whenever convenient.
 */
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
  MJDialogComponent,
  MJDialogActionsComponent, MJDropdownComponent } from '@memberjunction/ng-ui-components';

import { JournalEntryBatchStatusDashboardComponent } from '../JournalEntryBatchStatus/journal-entry-batch-status-dashboard.component';
import { JournalEntryBatchStatusResourceComponent } from '../JournalEntryBatchStatus/journal-entry-batch-status-resource.component';

@NgModule({
  declarations: [
    JournalEntryBatchStatusDashboardComponent, JournalEntryBatchStatusResourceComponent,
  ],
  imports: [MJDropdownComponent, MJACheckDropdownComponent, 
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
    MJDialogComponent,
    MJDialogActionsComponent,
  ],
  exports: [
    JournalEntryBatchStatusDashboardComponent, JournalEntryBatchStatusResourceComponent,
  ],
})
export class ReadModelsModule {}
