import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ERPExtensionRowModel } from './erp-sync.types';

@Component({
  standalone: false,
  selector: 'mj-erp-extension-list',
  templateUrl: './erp-extension-list.component.html',
  styleUrls: ['./erp-extension-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ERPExtensionListComponent {
  @Input() Extensions: ERPExtensionRowModel[] = [];
  @Output() OpenExtension = new EventEmitter<ERPExtensionRowModel>();
  @Output() ToggleStatus = new EventEmitter<ERPExtensionRowModel>();
}
