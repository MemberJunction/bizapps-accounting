import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Journal Entries Console — the class the application nav metadata
 * targets via DriverClass "JournalEntryConsoleResource". Thin BaseResourceComponent hosting the
 * dashboard, which owns the page chrome. Mirrors BatchDispatchResource.
 */
@RegisterClass(BaseResourceComponent, 'JournalEntryConsoleResource')
@Component({
  standalone: false,
  selector: 'mj-je-console-resource',
  template: `<mj-je-console-dashboard></mj-je-console-dashboard>`,
})
export class JournalEntryConsoleResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Journal Entries';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-book-open';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadJournalEntryConsoleResource(): void {
  // No-op. Keeps @RegisterClass(BaseResourceComponent, 'JournalEntryConsoleResource') alive.
}
