import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { PeriodsPageComponent } from '../periods/periods.page';

/**
 * Top-level Explorer Resource for Periods (bc-aidp-next-golive#447).
 * Mounts the month-close page: each company's books-closed and posting start dates.
 */
@RegisterClass(BaseResourceComponent, 'PeriodsResource')
@Component({
  standalone: true,
  imports: [PeriodsPageComponent],
  selector: 'mj-periods-resource',
  template: `
    <mj-accounting-periods-page></mj-accounting-periods-page>
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`]
})
export class PeriodsResourceComponent extends BaseResourceComponent implements OnInit {
  override ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Periods';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-calendar-check';
  }
}

/** Tree-shaking prevention */
export function LoadPeriodsResource(): void {
  // No-op. Anchors @RegisterClass(BaseResourceComponent, 'PeriodsResource')
  void PeriodsResourceComponent;
}
