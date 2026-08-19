/**
 * Hand-written form contributions and remaining custom forms for BizApps Accounting.
 * Journal Entry identity / overview / lines / reversal are BaseFormPanel registrations
 * on the generated form (no *Extended class). GL Account still overrides via @RegisterClass.
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Same form primitives the generated forms module imports (record-form-container,
// collapsible-panel, mj-form-field, form-panel-slot).
import { BaseFormsModule } from '@memberjunction/ng-base-forms';
import { EntityViewerModule } from '@memberjunction/ng-entity-viewer';
import { LinkDirectivesModule } from '@memberjunction/ng-link-directives';

// Loading / empty-state + buttons.
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import {
  MJButtonDirective,
  MJEmptyStateComponent,
  MJDropdownComponent,
  MJPageBodyInteriorComponent,
  MJStatBadgeComponent,
} from '@memberjunction/ng-ui-components';

import { GLAccountFormComponentExtended, LoadGLAccountFormComponentExtended } from './GLAccount/gl-account-form.component';
import { JournalEntryHeaderPanel } from './form-panels/journal-entry-header.panel';
import { JournalEntryOverviewPanel } from './form-panels/journal-entry-overview.panel';
import { JournalEntryLinesPanel } from './form-panels/journal-entry-lines.panel';
import { JournalEntryReversalPanel } from './form-panels/journal-entry-reversal.panel';
import { JEWorkspacePageComponent } from './shell/pages/je-workspace.page';
import { WorkspaceTabStripComponent } from '../transfer-pending/workspace-tabs/workspace-tab-strip.component';
import { WorkspaceCardComponent } from '../transfer-pending/workspace-tabs/workspace-card.component';
import { WorkspaceTipDirective } from '../transfer-pending/workspace-tabs/workspace-tip.directive';

// Hero Headers & Overview Panels
import { JournalEntryBatchHeaderPanel } from './form-panels/journal-entry-batch-header.panel';
import { JournalEntryBatchOverviewPanel, JournalEntryBatchOverviewComponent } from './form-panels/journal-entry-batch-overview.panel';
import { CompanyAccountingHeaderPanel } from './form-panels/company-accounting-header.panel';
import { CompanyAccountingOverviewPanel, CompanyAccountingOverviewComponent } from './form-panels/company-accounting-overview.panel';
import { GLAccountHierarchyPanel } from './form-panels/gl-account-hierarchy.panel';
import { DimensionValueHierarchyPanel } from './form-panels/dimension-value-hierarchy.panel';
import { CompanyProfileHierarchyPanel } from './form-panels/company-profile-hierarchy.panel';
import { TaxJurisdictionHierarchyPanel } from './form-panels/tax-jurisdiction-hierarchy.panel';

const ACCOUNTING_PANELS = [
  JEWorkspacePageComponent,
  GLAccountFormComponentExtended,
  JournalEntryBatchHeaderPanel,
  JournalEntryBatchOverviewPanel,
  CompanyAccountingHeaderPanel,
  CompanyAccountingOverviewPanel,
  JournalEntryHeaderPanel,
  JournalEntryOverviewPanel,
  JournalEntryLinesPanel,
  JournalEntryReversalPanel,
];

@NgModule({
  declarations: [...ACCOUNTING_PANELS],
  imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule,
    SharedGenericModule,
    MJButtonDirective,
    MJEmptyStateComponent,
    MJDropdownComponent,
    MJPageBodyInteriorComponent,
    MJStatBadgeComponent,
    WorkspaceTabStripComponent,
    WorkspaceCardComponent,
    WorkspaceTipDirective,
    JournalEntryBatchOverviewComponent,
    CompanyAccountingOverviewComponent,
    GLAccountHierarchyPanel,
    DimensionValueHierarchyPanel,
    CompanyProfileHierarchyPanel,
    TaxJurisdictionHierarchyPanel,
  ],
  exports: [
    ...ACCOUNTING_PANELS,
    JournalEntryBatchOverviewComponent,
    CompanyAccountingOverviewComponent,
    GLAccountHierarchyPanel,
    DimensionValueHierarchyPanel,
    CompanyProfileHierarchyPanel,
    TaxJurisdictionHierarchyPanel,
  ],
})
export class CustomFormsModule {}

/** Tree-shaking prevention — anchors the custom forms' @RegisterClass decorators. */
export function LoadCustomForms(): void {
  LoadJournalEntryFormPanels();
  LoadGLAccountFormComponentExtended();
}

/** Tree-shaking prevention — anchors the JE form-panel @RegisterClassEx decorators. */
export function LoadJournalEntryFormPanels(): void {
  // No-op.
}
