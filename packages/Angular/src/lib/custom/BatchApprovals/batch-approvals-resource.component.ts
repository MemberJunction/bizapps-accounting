import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Batch Approvals inbox — the class the application nav metadata targets
 * via DriverClass "BatchApprovalsResource". Thin BaseResourceComponent hosting the dashboard, which owns
 * the page chrome. Mirrors JournalEntryConsoleResource / BatchDispatchResource.
 */
@RegisterClass(BaseResourceComponent, 'BatchApprovalsResource')
@Component({
  standalone: false,
  selector: 'mj-batch-approvals-resource',
  template: `<mj-batch-approvals-dashboard></mj-batch-approvals-dashboard>`,
})
export class BatchApprovalsResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Approvals';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-clipboard-check';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadBatchApprovalsResource(): void {
  // No-op. Keeps @RegisterClass(BaseResourceComponent, 'BatchApprovalsResource') alive.
}
