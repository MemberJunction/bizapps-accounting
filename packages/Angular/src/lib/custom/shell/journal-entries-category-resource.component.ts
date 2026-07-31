import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Journal Entries CATEGORY. App nav targets this via
 * `DriverClass: "JournalEntriesCategoryResource"` (metadata/applications/…-application.json).
 *
 * Thin by design: the category shell it hosts is a BaseDashboard, which calls NotifyLoadComplete
 * itself once its data resolves — so this shim must NOT call it too (a premature call would clear
 * Explorer's loading screen before the shell has anything to show).
 */
@RegisterClass(BaseResourceComponent, 'JournalEntriesCategoryResource')
@Component({
  standalone: false,
  selector: 'mj-journal-entries-category-resource',
  template: `<mj-journal-entries-category></mj-journal-entries-category>`,
})
export class JournalEntriesCategoryResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Journal Entries';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-book-open';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadJournalEntriesCategoryResource(): void {
  // No-op.
}
