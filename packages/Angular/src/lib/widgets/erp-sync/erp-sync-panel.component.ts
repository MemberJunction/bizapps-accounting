import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ERPSyncCompanyResultModel } from './erp-sync.types';

export interface ERPSyncRequest {
  Objects: Array<'accounts' | 'dimensions' | 'dimensionValues'>;
  CompanyIDs?: string[];
}

@Component({
  standalone: false,
  selector: 'mj-erp-sync-panel',
  templateUrl: './erp-sync-panel.component.html',
  styleUrls: ['./erp-sync-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ERPSyncPanelComponent {
  @Input() Running = false;
  @Input() Results: ERPSyncCompanyResultModel[] = [];
  @Output() Run = new EventEmitter<ERPSyncRequest>();

  public WantAccounts = true;
  public WantDimensions = true;
  public WantDimensionValues = true;

  public OnRun(): void {
    const objects: ERPSyncRequest['Objects'] = [];
    if (this.WantAccounts) objects.push('accounts');
    if (this.WantDimensions) objects.push('dimensions');
    if (this.WantDimensionValues) objects.push('dimensionValues');
    if (objects.length === 0) return;
    this.Run.emit({ Objects: objects });
  }
}
