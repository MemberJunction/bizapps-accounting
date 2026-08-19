import { Component, OnInit, inject } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { CompositeKey } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent, NavigationService } from '@memberjunction/ng-shared';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

/**
 * Top-level Explorer Resource for Journal Entry Batches.
 * Mounts the All Batches worklist with batch status filters, metrics,
 * and direct NavigationService.OpenEntityRecord / OpenNewEntityRecord routing.
 */
@RegisterClass(BaseResourceComponent, 'BatchesResource')
@Component({
  standalone: false,
  selector: 'mj-batches-resource',
  template: `
    <mj-all-batches-page
      (RecordOpened)="onRecordOpened($event)"
      (CreateRequested)="onCreateRequested()">
    </mj-all-batches-page>
  `,
})
export class BatchesResourceComponent extends BaseResourceComponent implements OnInit {
  private navService = inject(NavigationService, { optional: true });

  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  public onRecordOpened(id: string): void {
    if (!id || !this.navService) return;
    this.navService.OpenEntityRecord(BATCH_ENTITY, CompositeKey.FromID(id));
  }

  public onCreateRequested(): void {
    if (!this.navService) return;
    this.navService.OpenNewEntityRecord(BATCH_ENTITY);
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Journal Entry Batches';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-layer-group';
  }
}

/** Tree-shaking prevention */
export function LoadBatchesResource(): void {
  // No-op. Anchors @RegisterClass(BaseResourceComponent, 'BatchesResource')
}
