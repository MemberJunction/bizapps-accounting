import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Intercompany Flow dashboard. App nav targets this via
 * `DriverClass: "IntercompanyFlowResource"`. Thin BaseResourceComponent hosting the dashboard.
 */
@RegisterClass(BaseResourceComponent, 'IntercompanyFlowResource')
@Component({
  standalone: false,
  selector: 'mj-intercompany-flow-resource',
  template: `<mj-intercompany-flow-dashboard></mj-intercompany-flow-dashboard>`,
})
export class IntercompanyFlowResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Intercompany Flow';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-arrows-turn-to-dots';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadIntercompanyFlowResource(): void {
  // No-op.
}
