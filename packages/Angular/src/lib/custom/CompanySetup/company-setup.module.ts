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
  MJEmptyStateComponent, MJDropdownComponent } from '@memberjunction/ng-ui-components';

import { CompanySetupDashboardComponent } from './company-setup-dashboard.component';
import { CompanySetupResourceComponent } from './company-setup-resource.component';

/**
 * Feature module for the Company Setup dashboard + its Explorer resource shim.
 * NgModule-declared to match the accounting-ng package pattern.
 */
@NgModule({
  declarations: [CompanySetupDashboardComponent, CompanySetupResourceComponent],
  imports: [MJDropdownComponent, 
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
  exports: [CompanySetupDashboardComponent, CompanySetupResourceComponent],
})
export class CompanySetupModule {}
