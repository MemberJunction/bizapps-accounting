import { Component, OnInit, inject } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { CompositeKey } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent, NavigationService } from '@memberjunction/ng-shared';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/**
 * Top-level Explorer Resource for Journal Entries.
 * Mounts the full All Journal Entries worklist with status chips, search,
 * and direct NavigationService.OpenEntityRecord / OpenNewEntityRecord routing.
 */
@RegisterClass(BaseResourceComponent, 'JournalEntriesResource')
@Component({
  standalone: false,
  selector: 'mj-journal-entries-resource',
  template: `
    <mj-all-journal-entries-page
      (RecordOpened)="onRecordOpened($event)"
      (CreateRequested)="onCreateRequested()">
    </mj-all-journal-entries-page>
  `,
})
export class JournalEntriesResourceComponent extends BaseResourceComponent implements OnInit {
  private navService = inject(NavigationService, { optional: true });

  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  public onRecordOpened(id: string): void {
    if (!id || !this.navService) return;
    this.navService.OpenEntityRecord(JE_ENTITY, CompositeKey.FromID(id));
  }

  public onCreateRequested(): void {
    if (!this.navService) return;
    this.navService.OpenNewEntityRecord(JE_ENTITY);
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Journal Entries';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-book-open';
  }
}

/** Tree-shaking prevention */
export function LoadJournalEntriesResource(): void {
  // No-op. Anchors @RegisterClass(BaseResourceComponent, 'JournalEntriesResource')
}
