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

import { JournalEntryConsoleDashboardComponent } from './je-console-dashboard.component';
import { JournalEntryConsoleResourceComponent } from './je-console-resource.component';

/**
 * Feature module for the Journal Entries Console dashboard + its Explorer resource shim.
 * NgModule-declared to match the accounting-ng package pattern.
 */
@NgModule({
  declarations: [JournalEntryConsoleDashboardComponent, JournalEntryConsoleResourceComponent],
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
  exports: [JournalEntryConsoleDashboardComponent, JournalEntryConsoleResourceComponent],
})
export class JournalEntryConsoleModule {}
