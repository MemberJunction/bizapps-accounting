/**
 * Hand-written custom form components and overrides for BizApps Accounting.
 * Components declared here are loaded AFTER the generated module so their
 * @RegisterClass decorators win the priority race vs. the generated forms.
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

import { JournalEntryFormComponentExtended, LoadJournalEntryFormComponentExtended } from './JournalEntry/journal-entry-form.component';
import { GLAccountFormComponentExtended, LoadGLAccountFormComponentExtended } from './GLAccount/gl-account-form.component';
import { JEWorkspacePageComponent } from './shell/pages/je-workspace.page';
import { WorkspaceTabStripComponent } from '../transfer-pending/workspace-tabs/workspace-tab-strip.component';
import { WorkspaceCardComponent } from '../transfer-pending/workspace-tabs/workspace-card.component';
import { WorkspaceTipDirective } from '../transfer-pending/workspace-tabs/workspace-tip.directive';

// Hero Headers & Overview Panels
import { JournalEntryBatchHeaderPanel } from './form-panels/journal-entry-batch-header.panel';
import { JournalEntryBatchOverviewPanel, JournalEntryBatchOverviewComponent } from './form-panels/journal-entry-batch-overview.panel';
import { CompanyAccountingHeaderPanel } from './form-panels/company-accounting-header.panel';
import { CompanyAccountingOverviewPanel, CompanyAccountingOverviewComponent } from './form-panels/company-accounting-overview.panel';

const ACCOUNTING_PANELS = [
  JournalEntryFormComponentExtended,
  JEWorkspacePageComponent,
  GLAccountFormComponentExtended,
  JournalEntryBatchHeaderPanel,
  JournalEntryBatchOverviewPanel,
  CompanyAccountingHeaderPanel,
  CompanyAccountingOverviewPanel,
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
  ],
  exports: [
    ...ACCOUNTING_PANELS,
    JournalEntryBatchOverviewComponent,
    CompanyAccountingOverviewComponent,
  ],
})
export class CustomFormsModule {}

/** Tree-shaking prevention — anchors the custom forms' @RegisterClass decorators. */
export function LoadCustomForms(): void {
  LoadJournalEntryFormComponentExtended();
  LoadGLAccountFormComponentExtended();
}
