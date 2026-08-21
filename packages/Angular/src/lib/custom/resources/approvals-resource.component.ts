import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

/**
 * Top-level Explorer Resource for Journal Entry Approvals.
 * Mounts the JE Approvals review queue.
 */
@RegisterClass(BaseResourceComponent, 'ApprovalsResource')
@Component({
  standalone: false,
  selector: 'mj-approvals-resource',
  template: `<mj-je-approvals-page></mj-je-approvals-page>`,
})
export class ApprovalsResourceComponent extends BaseResourceComponent implements OnInit {
  ngOnInit(): void {
    super.ngOnInit();
    this.NotifyLoadComplete();
  }

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Approvals';
  }

  async GetResourceIconClass(_data: ResourceData): Promise<string> {
    return 'fa-solid fa-user-check';
  }
}

/** Tree-shaking prevention */
export function LoadApprovalsResource(): void {
  // No-op. Anchors @RegisterClass(BaseResourceComponent, 'ApprovalsResource')
}
