import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { MJButtonDirective, MJEmptyStateComponent } from '@memberjunction/ng-ui-components';
import { ERPConnectionCardComponent } from './erp-connection-card.component';
import { ERPSyncPanelComponent } from './erp-sync-panel.component';
import { ERPExtensionListComponent } from './erp-extension-list.component';

@NgModule({
  declarations: [ERPConnectionCardComponent, ERPSyncPanelComponent, ERPExtensionListComponent],
  imports: [CommonModule, FormsModule, SharedGenericModule, MJButtonDirective, MJEmptyStateComponent],
  exports: [ERPConnectionCardComponent, ERPSyncPanelComponent, ERPExtensionListComponent],
})
export class ERPSyncWidgetsModule {}
