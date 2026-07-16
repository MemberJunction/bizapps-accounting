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
  MjSlidePanelComponent,
  MJAlertComponent,
} from '@memberjunction/ng-ui-components';

import { CompanyScopeChipComponent } from '../shared/company-scope-chip.component';
import { WorkspaceTabStripComponent } from '../../transfer-pending/workspace-tabs/workspace-tab-strip.component';

import { BatchDispatchModule } from '../BatchDispatch/batch-dispatch.module';
import { ReadModelsModule } from '../shared/read-models.module';

import { BatchesCategoryComponent } from './batches-category.component';
import { BatchesCategoryResourceComponent } from './batches-category-resource.component';
import { JournalEntriesCategoryComponent } from './journal-entries-category.component';
import { JournalEntriesCategoryResourceComponent } from './journal-entries-category-resource.component';
import { AllJournalEntriesPageComponent } from './pages/all-journal-entries.page';
import { JournalEntryDetailPanelComponent } from './pages/journal-entry-detail-panel.component';
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
    BatchesCategoryComponent,
    BatchesCategoryResourceComponent,
    JournalEntriesCategoryComponent,
    JournalEntriesCategoryResourceComponent,
    AllJournalEntriesPageComponent,
    JournalEntryDetailPanelComponent,
    ShellPagePendingComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedGenericModule,
    EntityViewerModule, // <mj-entity-data-grid> — the house grid
    // The Batches category HOSTS these existing dashboards (now on interior chrome, §6 sweep).
    BatchDispatchModule, // <mj-batch-dispatch-dashboard> — Batch approvals
    ReadModelsModule, // <mj-batch-status-dashboard> — All batches
    MJButtonDirective,
    MJPageLayoutComponent,
    MJPageBodyComponent,
    MJPageHeaderInteriorComponent,
    MJLeftNavComponent,
    MJStatBadgeComponent,
    MJRefreshButtonComponent,
    MJEmptyStateComponent,
    MjSlidePanelComponent,
    MJAlertComponent,
    CompanyScopeChipComponent,
    WorkspaceTabStripComponent,
  ],
  exports: [
    BatchesCategoryComponent,
    BatchesCategoryResourceComponent,
    JournalEntriesCategoryComponent,
    JournalEntriesCategoryResourceComponent,
    AllJournalEntriesPageComponent,
    JournalEntryDetailPanelComponent,
  ],
})
export class AccountingShellModule {}
