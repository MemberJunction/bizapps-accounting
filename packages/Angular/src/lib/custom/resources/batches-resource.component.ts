import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { AccountingBatchesPageComponent } from '../overview/accounting-batches.component';

/**
 * Top-level Explorer Resource for Journal Entry Batches.
 * Mounts the Batches phase & stage control workspace.
 */
@RegisterClass(BaseResourceComponent, 'BatchesResource')
@Component({
  standalone: true,
  imports: [AccountingBatchesPageComponent],
  selector: 'mj-batches-resource',
  template: `
    <mj-accounting-batches-page></mj-accounting-batches-page>
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`]
})
export class BatchesResourceComponent extends BaseResourceComponent implements OnInit {
  override ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
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
  void BatchesResourceComponent;
}
