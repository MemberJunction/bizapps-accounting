import { MJACheckDropdownComponent } from '../shared/check-dropdown.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { EntityViewerModule } from '@memberjunction/ng-entity-viewer';
import {
  MJButtonDirective,
  MJPageLayoutComponent,
  MJPageHeaderComponent,
  MJPageBodyComponent,
  MJPageBodyInteriorComponent,
  MJPageHeaderInteriorComponent,
  MJLeftNavComponent,
  MJLeftNavContentComponent,
  MJStatBadgeComponent,
  MJRefreshButtonComponent,
  MJEmptyStateComponent,
  MjSlidePanelComponent,
  MJAlertComponent, MJDropdownComponent } from '@memberjunction/ng-ui-components';

import { CompanyScopeChipComponent } from '../shared/company-scope-chip.component';
import { PageRefreshService } from '../../transfer-pending/shell-refresh/page-refresh.service';
import { GlResolutionPreviewComponent } from '../shared/gl-resolution-preview.component';
import { WorkspaceTabStripComponent } from '../../transfer-pending/workspace-tabs/workspace-tab-strip.component';
import { WorkspaceCardComponent } from '../../transfer-pending/workspace-tabs/workspace-card.component';
import { WorkspaceTipDirective } from '../../transfer-pending/workspace-tabs/workspace-tip.directive';

import { JournalEntryBatchDispatchModule } from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.module';
import { ChartOfAccountsModule } from '../ChartOfAccounts/chart-of-accounts.module';
import { CompanySetupModule } from '../CompanySetup/company-setup.module';
import { ReadModelsModule } from '../shared/read-models.module';

import { AccountsCategoryComponent } from './accounts-category.component';
import { AccountsCategoryResourceComponent } from './accounts-category-resource.component';
import { BatchesCategoryComponent } from './batches-category.component';
import { BatchesCategoryResourceComponent } from './batches-category-resource.component';
import { ConfigurationCategoryComponent } from './configuration-category.component';
import { ConfigurationCategoryResourceComponent } from './configuration-category-resource.component';
import { ReportsCategoryComponent } from './reports-category.component';
import { ReportsCategoryResourceComponent } from './reports-category-resource.component';
import { JournalEntriesCategoryComponent } from './journal-entries-category.component';
import { JournalEntriesCategoryResourceComponent } from './journal-entries-category-resource.component';
import { AllJournalEntriesPageComponent } from './pages/all-journal-entries.page';
import { AllBatchesPageComponent } from './pages/all-batches.page';
import { BatchDetailPanelComponent } from './pages/batch-detail-panel.component';
import { JEApprovalsPageComponent } from './pages/je-approvals.page';
import { JournalEntryBatchWorkspacePageComponent } from './pages/journal-entry-batch-workspace.page';
import { DispatchStatusPageComponent } from './pages/dispatch-status.page';
import { JeDashboardPageComponent } from './pages/je-dashboard.page';
import { JournalEntryBatchesDashboardPageComponent } from './pages/journal-entry-batches-dashboard.page';
import { DimensionsPageComponent } from './pages/dimensions.page';
import { AccountLinksPageComponent } from './pages/account-links.page';
import { GLAccountsPageComponent } from './pages/gl-accounts.page';
import { JournalEntryDetailPanelComponent } from './pages/journal-entry-detail-panel.component';
import { ShellRailComponent } from './shell-rail.component';
import { ShellPagePendingComponent } from './pages/shell-page-pending.component';
import { MJASummaryStripComponent } from '../shared/summary-strip.component';
import { MJAListToolbarComponent } from '../shared/list-toolbar.component';

/**
 * The app shell (UI plan §8.0): the category shells + their pages.
 *
 * NgModule-declared to match this package's existing pattern (mirrors ReadModelsModule /
 * JournalEntryBatchDispatchModule). The standalone pieces we own (scope chip, tab strip) and MJ's standalone
 * chrome are imported, not declared.
 */
@NgModule({
  declarations: [
    AllBatchesPageComponent,
    BatchDetailPanelComponent,
    AccountsCategoryComponent,
    AccountsCategoryResourceComponent,
    ConfigurationCategoryComponent,
    ConfigurationCategoryResourceComponent,
    ReportsCategoryComponent,
    ReportsCategoryResourceComponent,
    BatchesCategoryComponent,
    BatchesCategoryResourceComponent,
    JournalEntriesCategoryComponent,
    JournalEntriesCategoryResourceComponent,
    AllJournalEntriesPageComponent,
    JEApprovalsPageComponent,
    JournalEntryBatchWorkspacePageComponent,
    DispatchStatusPageComponent,
    JeDashboardPageComponent,
    JournalEntryBatchesDashboardPageComponent,
    DimensionsPageComponent,
    AccountLinksPageComponent,
    GLAccountsPageComponent,
    JournalEntryDetailPanelComponent,
  ],
  imports: [MJDropdownComponent, MJACheckDropdownComponent, 
    ShellPagePendingComponent, // standalone — shared with orders' shell
    MJASummaryStripComponent, // standalone — the orders-idiom stats bubble (list-page standard)
    MJAListToolbarComponent, // standalone — search + preset chips + Filters disclosure (list-page standard)
    ShellRailComponent, // standalone — the rail + its collapse; also shared with orders' shell
    CommonModule,
    FormsModule,
    SharedGenericModule,
    EntityViewerModule, // <mj-entity-data-grid> — the house grid
    // The Batches category HOSTS these existing dashboards (now on interior chrome, §6 sweep).
    JournalEntryBatchDispatchModule, // <mj-batch-dispatch-dashboard> — Batch approvals
    ReadModelsModule, // <mj-batch-status-dashboard> + the read-model report dashboards
    ChartOfAccountsModule, // <mj-coa-dashboard> — Accounts
    CompanySetupModule, // <mj-company-setup-dashboard> — Configuration
    MJButtonDirective,
    MJPageLayoutComponent,
    MJPageHeaderComponent,
    MJPageBodyComponent,
  MJPageBodyInteriorComponent,
    MJPageHeaderInteriorComponent,
    MJLeftNavComponent,
    MJLeftNavContentComponent,
    MJStatBadgeComponent,
    MJRefreshButtonComponent,
    MJEmptyStateComponent,
    MjSlidePanelComponent,
    MJAlertComponent,
    CompanyScopeChipComponent,
    GlResolutionPreviewComponent,
    WorkspaceTabStripComponent,
    WorkspaceCardComponent,
    WorkspaceTipDirective,
  ],
  exports: [
    AccountsCategoryComponent,
    AccountsCategoryResourceComponent,
    ConfigurationCategoryComponent,
    ConfigurationCategoryResourceComponent,
    ReportsCategoryComponent,
    ReportsCategoryResourceComponent,
    BatchesCategoryComponent,
    BatchesCategoryResourceComponent,
    JournalEntriesCategoryComponent,
    JournalEntriesCategoryResourceComponent,
    AllJournalEntriesPageComponent,
    JEApprovalsPageComponent,
    JournalEntryBatchWorkspacePageComponent,
    DispatchStatusPageComponent,
    JeDashboardPageComponent,
    JournalEntryBatchesDashboardPageComponent,
    DimensionsPageComponent,
    AccountLinksPageComponent,
    GLAccountsPageComponent,
    JournalEntryDetailPanelComponent,
  ],
})
export class AccountingShellModule {}
