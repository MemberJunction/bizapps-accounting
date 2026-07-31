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
import { MJButtonDirective, MJEmptyStateComponent } from '@memberjunction/ng-ui-components';

import { JournalEntryFormComponentExtended, LoadJournalEntryFormComponentExtended } from './JournalEntry/journal-entry-form.component';
import { GLAccountFormComponentExtended, LoadGLAccountFormComponentExtended } from './GLAccount/gl-account-form.component';

@NgModule({
  declarations: [JournalEntryFormComponentExtended, GLAccountFormComponentExtended],
  imports: [
    CommonModule,
    FormsModule,
    BaseFormsModule,
    EntityViewerModule,
    LinkDirectivesModule,
    SharedGenericModule,
    MJButtonDirective,
    MJEmptyStateComponent,
  ],
  exports: [JournalEntryFormComponentExtended, GLAccountFormComponentExtended],
})
export class CustomFormsModule {}

/** Tree-shaking prevention — anchors the custom forms' @RegisterClass decorators. */
export function LoadCustomForms(): void {
  LoadJournalEntryFormComponentExtended();
  LoadGLAccountFormComponentExtended();
}
