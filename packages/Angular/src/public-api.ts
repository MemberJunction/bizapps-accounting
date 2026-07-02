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

// Import class registrations manifest
import { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';

// Re-export for consumers
export { CLASS_REGISTRATIONS } from './lib/generated/class-registrations-manifest';
export { GeneratedFormsModule } from './lib/generated/generated-forms.module';
export { CustomFormsModule } from './lib/custom/custom-forms.module';
export { BatchDispatchModule } from './lib/custom/BatchDispatch/batch-dispatch.module';
export { ReadModelsModule } from './lib/custom/shared/read-models.module';

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
}
