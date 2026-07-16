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
  MJLeftNavContentComponent,
  MJStatBadgeComponent,
  MJRefreshButtonComponent,
  MJEmptyStateComponent,
  MjSlidePanelComponent,
  MJAlertComponent,
} from '@memberjunction/ng-ui-components';

import { CompanyScopeChipComponent } from '../shared/company-scope-chip.component';
import { GlResolutionPreviewComponent } from '../shared/gl-resolution-preview.component';
import { WorkspaceTabStripComponent } from '../../transfer-pending/workspace-tabs/workspace-tab-strip.component';

import { BatchDispatchModule } from '../BatchDispatch/batch-dispatch.module';
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
import { JEWorkspacePageComponent } from './pages/je-workspace.page';
import { JEApprovalsPageComponent } from './pages/je-approvals.page';
import { BatchWorkspacePageComponent } from './pages/batch-workspace.page';
import { DispatchStatusPageComponent } from './pages/dispatch-status.page';
import { JeDashboardPageComponent } from './pages/je-dashboard.page';
import { BatchesDashboardPageComponent } from './pages/batches-dashboard.page';
import { DimensionsPageComponent } from './pages/dimensions.page';
import { ErpMappingPageComponent } from './pages/erp-mapping.page';
import { AccountLinksPageComponent } from './pages/account-links.page';
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
    JEWorkspacePageComponent,
    JEApprovalsPageComponent,
    BatchWorkspacePageComponent,
    DispatchStatusPageComponent,
    JeDashboardPageComponent,
    BatchesDashboardPageComponent,
    DimensionsPageComponent,
    ErpMappingPageComponent,
    AccountLinksPageComponent,
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
    ReadModelsModule, // <mj-batch-status-dashboard> + the read-model report dashboards
    ChartOfAccountsModule, // <mj-coa-dashboard> — Accounts
    CompanySetupModule, // <mj-company-setup-dashboard> — Configuration
    MJButtonDirective,
    MJPageLayoutComponent,
    MJPageBodyComponent,
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
    JEWorkspacePageComponent,
    JEApprovalsPageComponent,
    BatchWorkspacePageComponent,
    DispatchStatusPageComponent,
    JeDashboardPageComponent,
    BatchesDashboardPageComponent,
    DimensionsPageComponent,
    ErpMappingPageComponent,
    AccountLinksPageComponent,
    JournalEntryDetailPanelComponent,
  ],
})
export class AccountingShellModule {}
