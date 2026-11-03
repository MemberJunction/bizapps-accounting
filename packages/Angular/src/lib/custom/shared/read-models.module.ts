import { MJACheckDropdownComponent } from './check-dropdown.component';
/**
 * ReadModelsModule — retained as an empty NgModule shell so external consumers importing
 * `ReadModelsModule` from `@mj-biz-apps/accounting-ng-bootstrap` do not break when the legacy
 * read-model and batch-status dashboards were retired in favour of the category shell pages.
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

@NgModule({
  declarations: [],
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
  exports: [],
})
export class ReadModelsModule {}
