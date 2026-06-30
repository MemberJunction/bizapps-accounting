import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * The Explorer resource shim for the Batch Dispatch dashboard. This is the class the
 * application nav metadata targets via `DriverClass: "BatchDispatchResource"`. It is a thin
 * `BaseResourceComponent` that hosts the dashboard component which owns the page chrome.
 *
 * Pattern mirrors core MJ's `SchedulingOverviewResourceComponent`: the resource shim renders
 * the inner dashboard and signals load-complete; the dashboard owns the chrome trio.
 */
@RegisterClass(BaseResourceComponent, 'BatchDispatchResource')
@Component({
  standalone: false,
  selector: 'mj-batch-dispatch-resource',
  template: `<mj-batch-dispatch-dashboard></mj-batch-dispatch-dashboard>`,
})
export class BatchDispatchResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    // The inner dashboard does the data load; the shim signals the shell that it's interactive so
    // the loading screen clears on direct-URL navigation. (BaseResourceComponent contract.)
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Batch Dispatch';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-paper-plane';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadBatchDispatchResource(): void {
  // No-op. Keeps the @RegisterClass(BaseResourceComponent, 'BatchDispatchResource') from being shaken out.
}
