import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Batches CATEGORY. App nav targets this via
 * `DriverClass: "BatchesCategoryResource"`.
 *
 * Thin: the category shell it hosts is a BaseDashboard and calls NotifyLoadComplete itself once its
 * data resolves — calling it here too would clear Explorer's loading screen prematurely.
 */
@RegisterClass(BaseResourceComponent, 'BatchesCategoryResource')
@Component({
  standalone: false,
  selector: 'mj-batches-category-resource',
  template: `<mj-batches-category></mj-batches-category>`,
})
export class BatchesCategoryResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Batches';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-layer-group';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadBatchesCategoryResource(): void {
  // No-op.
}
