import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the (read-only) Batch Status dashboard. App nav targets this
 * via `DriverClass: "BatchStatusResource"`. Thin BaseResourceComponent hosting the dashboard.
 */
@RegisterClass(BaseResourceComponent, 'BatchStatusResource')
@Component({
  standalone: false,
  selector: 'mj-batch-status-resource',
  template: `<mj-batch-status-dashboard></mj-batch-status-dashboard>`,
})
export class BatchStatusResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Batch Status';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-list-check';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadBatchStatusResource(): void {
  // No-op.
}
