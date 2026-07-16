/**
 * BizApps Accounting Angular Bootstrap
 *
 * Client-side bootstrap package for the BizApps Accounting Open App.
 * Imports all entity classes and form components to ensure @RegisterClass
 * decorators fire and components are available to MJ's class factory.
 */

// Import entity package to trigger @RegisterClass decorators for entity subclasses
import '@mj-biz-apps/accounting-entities';

// Import generated form components (triggers @RegisterClass for form components)
import './lib/generated/generated-forms.module';

// Import custom form components (must come AFTER generated to override via @RegisterClass priority)
import './lib/custom/custom-forms.module';
import { LoadCustomForms } from './lib/custom/custom-forms.module';

// Import custom Explorer resource components (dashboards). Static import + the Load* calls in
// LoadBizAppsAccountingClient() keep their @RegisterClass decorators from being tree-shaken out.
import { BatchDispatchModule } from './lib/custom/BatchDispatch/batch-dispatch.module';
import { LoadBatchDispatchDashboard } from './lib/custom/BatchDispatch/batch-dispatch-dashboard.component';
import { LoadBatchDispatchResource } from './lib/custom/BatchDispatch/batch-dispatch-resource.component';

// Stage-2 read-model dashboards (Trial Balance & AR, Revenue & Tax, Batch Status, Intercompany Flow).
import { ReadModelsModule } from './lib/custom/shared/read-models.module';
import { LoadTrialBalanceARDashboard } from './lib/custom/TrialBalanceAR/trial-balance-ar-dashboard.component';
import { LoadTrialBalanceARResource } from './lib/custom/TrialBalanceAR/trial-balance-ar-resource.component';
import { LoadRevenueTaxDashboard } from './lib/custom/RevenueTax/revenue-tax-dashboard.component';
import { LoadRevenueTaxResource } from './lib/custom/RevenueTax/revenue-tax-resource.component';
import { LoadBatchStatusDashboard } from './lib/custom/BatchStatus/batch-status-dashboard.component';
import { LoadBatchStatusResource } from './lib/custom/BatchStatus/batch-status-resource.component';
import { LoadIntercompanyFlowDashboard } from './lib/custom/Intercompany/intercompany-flow-dashboard.component';
import { LoadIntercompanyFlowResource } from './lib/custom/Intercompany/intercompany-flow-resource.component';

// Journal Entries Console (filterable ledger list + expandable lines + reversal + source-order drill).
import { JournalEntryConsoleModule } from './lib/custom/JournalEntryConsole/je-console.module';
import { LoadJournalEntryConsoleResource } from './lib/custom/JournalEntryConsole/je-console-resource.component';

// Chart of Accounts tree + Company Setup hub. (The Approvals inbox was removed — redundant with Batches.)
import { ChartOfAccountsModule } from './lib/custom/ChartOfAccounts/chart-of-accounts.module';
import { LoadChartOfAccountsResource } from './lib/custom/ChartOfAccounts/coa-resource.component';
import { CompanySetupModule } from './lib/custom/CompanySetup/company-setup.module';
import { LoadCompanySetupResource } from './lib/custom/CompanySetup/company-setup-resource.component';

// App shell (UI plan §8.0) — the category shells hosting MJ's mj-left-nav + their pages.
import { AccountingShellModule } from './lib/custom/shell/shell.module';
import { LoadAccountsCategory } from './lib/custom/shell/accounts-category.component';
import { LoadAccountsCategoryResource } from './lib/custom/shell/accounts-category-resource.component';
import { LoadConfigurationCategory } from './lib/custom/shell/configuration-category.component';
import { LoadConfigurationCategoryResource } from './lib/custom/shell/configuration-category-resource.component';
import { LoadReportsCategory } from './lib/custom/shell/reports-category.component';
import { LoadReportsCategoryResource } from './lib/custom/shell/reports-category-resource.component';
import { LoadBatchesCategory } from './lib/custom/shell/batches-category.component';
import { LoadBatchesCategoryResource } from './lib/custom/shell/batches-category-resource.component';
import { LoadJournalEntriesCategory } from './lib/custom/shell/journal-entries-category.component';
import { LoadJournalEntriesCategoryResource } from './lib/custom/shell/journal-entries-category-resource.component';

// Import class registrations manifest
import { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';

// Re-export for consumers
export { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';
export { GeneratedFormsModule } from './lib/generated/generated-forms.module';
export { CustomFormsModule } from './lib/custom/custom-forms.module';
export { BatchDispatchModule } from './lib/custom/BatchDispatch/batch-dispatch.module';
export { ReadModelsModule } from './lib/custom/shared/read-models.module';
// Shared bizapps detail surfaces (slide-in + centered dialog over the MJ form host). Exported so orders reuses the
// same two standardized surfaces across the suite.
export { openBizDetail, type BizDetailMode, type BizDetailOptions } from './lib/custom/shared/biz-detail-form';
export { AccountingShellModule } from './lib/custom/shell/shell.module';
// App-wide company scope (rail-top chip). Exported so orders can share the same scope surface.
export { CompanyScopeService, type ScopeCompany } from './lib/custom/shared/company-scope.service';
// GL-resolution preview — accounting-domain, SHARED with orders (its product panel + Confirm-failure
// UX). Presentation only: orders resolves with its own fallback chain and hands the result in.
export { GlResolutionPreviewComponent, type GlResolutionResult, type GlResolutionStep } from './lib/custom/shared/gl-resolution-preview.component';
export { CompanyScopeChipComponent } from './lib/custom/shared/company-scope-chip.component';

// ─── Shell primitives, shared with orders (orders UI plan §13.0) ─────────────
// The category-shell pattern (Explorer nav item -> <mj-left-nav> + local page switching) is
// IDENTICAL in both apps, so it exists once here rather than as two drifting copies. Exported —
// not re-homed in bizapps-common — because the dependency direction already allows it
// (common -> accounting -> orders) and orders must import accounting-homed surfaces regardless
// (the GL-resolution preview above, and the Customer A/R base view). CategoryShellBase's only
// app-specific binding is CompanyScopeService, which orders shares.
export { CategoryShellBase } from './lib/custom/shell/category-shell.base';
export { ShellPagePendingComponent } from './lib/custom/shell/pages/shell-page-pending.component';

// The workspace-tab framework (parked, framework-clean — TRANSFER-BACKLOG target: common -> MJ
// base). Orders' Order editor uses the same session-tab semantics as the JE/Batch workspaces.
export { WorkspaceTabStripComponent } from './lib/transfer-pending/workspace-tabs/workspace-tab-strip.component';
export { WorkspaceTabStore } from './lib/transfer-pending/workspace-tabs/workspace-tab-store';
export type { WorkspaceTab, WorkspaceTabState } from './lib/transfer-pending/workspace-tabs/workspace-tabs.types';

/**
 * Bootstrap function called during MJExplorer initialization.
 * Static imports above handle most registration; the explicit Load* calls below
 * anchor the custom resource components' + custom forms' @RegisterClass decorators against tree-shaking.
 */
export function LoadBizAppsAccountingClient(): void {
    // Stage 1 — Batch Dispatch.
    LoadBatchDispatchDashboard();
    LoadBatchDispatchResource();
    void BatchDispatchModule;

    // Stage 2 — read-model dashboards.
    LoadTrialBalanceARDashboard();
    LoadTrialBalanceARResource();
    LoadRevenueTaxDashboard();
    LoadRevenueTaxResource();
    LoadBatchStatusDashboard();
    LoadBatchStatusResource();
    LoadIntercompanyFlowDashboard();
    LoadIntercompanyFlowResource();
    void ReadModelsModule;

    // Stage 2 — custom forms (Journal Entry, GL Account).
    LoadCustomForms();

    // Journal Entries Console.
    LoadJournalEntryConsoleResource();
    void JournalEntryConsoleModule;

    // Chart of Accounts tree + Company Setup hub. (Approvals inbox removed — redundant with Batches.)
    LoadChartOfAccountsResource();
    void ChartOfAccountsModule;
    LoadCompanySetupResource();
    void CompanySetupModule;

    // UI wave §8.0 — category shells (Explorer app nav items -> mj-left-nav + pages).
    LoadJournalEntriesCategory();
    LoadJournalEntriesCategoryResource();
    LoadBatchesCategory();
    LoadBatchesCategoryResource();
    LoadAccountsCategory();
    LoadAccountsCategoryResource();
    LoadConfigurationCategory();
    LoadConfigurationCategoryResource();
    LoadReportsCategory();
    LoadReportsCategoryResource();
    void AccountingShellModule;
}
