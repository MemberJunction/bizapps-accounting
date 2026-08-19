import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Top-level Explorer Resource for Accounting Dimensions.
 * Mounts the Dimensions & Dimension Values master-detail management page.
 */
@RegisterClass(BaseResourceComponent, 'DimensionsResource')
@Component({
  standalone: false,
  selector: 'mj-dimensions-resource',
  template: `<mj-dimensions-page></mj-dimensions-page>`,
})
export class DimensionsResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Dimensions';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-tags';
  }
}

/** Tree-shaking prevention */
export function LoadDimensionsResource(): void {
  // No-op. Anchors @RegisterClass(BaseResourceComponent, 'DimensionsResource')
}
