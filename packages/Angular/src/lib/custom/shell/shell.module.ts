import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { EntityViewerModule } from '@memberjunction/ng-entity-viewer';
import {
  MJButtonDirective,
  MJPageLayoutComponent,
  MJPageBodyComponent,
  MJPageHeaderInteriorComponent,
  MJLeftNavComponent,
  MJStatBadgeComponent,
  MJRefreshButtonComponent,
  MJEmptyStateComponent,
} from '@memberjunction/ng-ui-components';

import { CompanyScopeChipComponent } from '../shared/company-scope-chip.component';
import { WorkspaceTabStripComponent } from '../../transfer-pending/workspace-tabs/workspace-tab-strip.component';

import { JournalEntriesCategoryComponent } from './journal-entries-category.component';
import { JournalEntriesCategoryResourceComponent } from './journal-entries-category-resource.component';
import { AllJournalEntriesPageComponent } from './pages/all-journal-entries.page';
import { ShellPagePendingComponent } from './pages/shell-page-pending.component';

/**
 * The app shell (UI plan §8.0): the category shells + their pages.
 *
 * NgModule-declared to match this package's existing pattern (mirrors ReadModelsModule /
 * BatchDispatchModule). The standalone pieces we own (scope chip, tab strip) and MJ's standalone
 * chrome are imported, not declared.
 */
@NgModule({
  declarations: [
    JournalEntriesCategoryComponent,
    JournalEntriesCategoryResourceComponent,
    AllJournalEntriesPageComponent,
    ShellPagePendingComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedGenericModule,
    EntityViewerModule, // <mj-entity-data-grid> — the house grid
    MJButtonDirective,
    MJPageLayoutComponent,
    MJPageBodyComponent,
    MJPageHeaderInteriorComponent,
    MJLeftNavComponent,
    MJStatBadgeComponent,
    MJRefreshButtonComponent,
    MJEmptyStateComponent,
    CompanyScopeChipComponent,
    WorkspaceTabStripComponent,
  ],
  exports: [
    JournalEntriesCategoryComponent,
    JournalEntriesCategoryResourceComponent,
    AllJournalEntriesPageComponent,
  ],
})
export class AccountingShellModule {}
