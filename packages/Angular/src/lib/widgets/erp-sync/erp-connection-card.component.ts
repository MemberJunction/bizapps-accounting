import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ERPConnectionCardModel } from './erp-sync.types';

/**
 * Reusable connection card. No Router. Parent opens records / runs sync.
 */
@Component({
  standalone: false,
  selector: 'mj-erp-connection-card',
  templateUrl: './erp-connection-card.component.html',
  styleUrls: ['./erp-connection-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ERPConnectionCardComponent {
  @Input() Connection!: ERPConnectionCardModel;
  @Output() OpenCompany = new EventEmitter<ERPConnectionCardModel>();
  @Output() OpenIntegration = new EventEmitter<ERPConnectionCardModel>();
  @Output() RunNow = new EventEmitter<ERPConnectionCardModel>();

  public get StatusTone(): 'success' | 'error' | 'warning' | 'info' {
    const s = (this.Connection?.LastRunStatus ?? '').toLowerCase();
    if (s === 'completed' || s === 'success') return 'success';
    if (s === 'failed' || s === 'error') return 'error';
    if (s === 'running' || s === 'queued') return 'warning';
    return 'info';
  }
}
