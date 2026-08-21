import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Reports CATEGORY (`DriverClass: "ReportsCategoryResource"`).
 * Thin: the shell it hosts is a BaseDashboard and calls NotifyLoadComplete itself.
 */
@RegisterClass(BaseResourceComponent, 'ReportsCategoryResource')
@Component({
  standalone: false,
  selector: 'mj-reports-category-resource',
  template: `<mj-reports-category></mj-reports-category>`,
})
export class ReportsCategoryResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
  }
  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Reports';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-chart-column';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadReportsCategoryResource(): void {
  // No-op.
}
