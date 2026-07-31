import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Explorer resource shim for the Configuration CATEGORY (`DriverClass: "ConfigurationCategoryResource"`).
 * Thin: the shell it hosts is a BaseDashboard and calls NotifyLoadComplete itself.
 */
@RegisterClass(BaseResourceComponent, 'ConfigurationCategoryResource')
@Component({
  standalone: false,
  selector: 'mj-configuration-category-resource',
  template: `<mj-configuration-category></mj-configuration-category>`,
})
export class ConfigurationCategoryResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
  }
  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Configuration';
  }
  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-gear';
  }
}

/** Tree-shaking prevention — called from public-api.ts. */
export function LoadConfigurationCategoryResource(): void {
  // No-op.
}
