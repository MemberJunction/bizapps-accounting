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

import { ChartOfAccountsDashboardComponent } from './coa-dashboard.component';
import { ChartOfAccountsResourceComponent } from './coa-resource.component';

/**
 * Feature module for the Chart of Accounts dashboard + its Explorer resource shim.
 * NgModule-declared to match the accounting-ng package pattern.
 */
@NgModule({
  declarations: [ChartOfAccountsDashboardComponent, ChartOfAccountsResourceComponent],
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
  exports: [ChartOfAccountsDashboardComponent, ChartOfAccountsResourceComponent],
})
export class ChartOfAccountsModule {}
