import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { AccountingDashboardBase } from './accounting-dashboard.base';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/**
 * Batches dashboard (UI plan §8.2) — cheap stats only (§0).
 *
 * Note the batch stats are deliberately NOT company-scoped: batches are MULTI-company (CH-4), so a
 * batch merely TOUCHING another company would vanish under a company filter. The unbatched-entries
 * card IS scoped, because a journal entry belongs to exactly one company (MOD-12).
 */
@Component({
  standalone: false,
  selector: 'mj-batches-dashboard-page',
  templateUrl: './accounting-dashboard.html',
  styleUrls: ['./accounting-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatchesDashboardPageComponent extends AccountingDashboardBase implements OnInit {
  public Scope = inject(CompanyScopeService);
  public Title = 'Batches';
  public Subtitle = 'What is open, waiting, or stuck on its way to the ERP';

  ngOnInit(): void {
    void this.load();
  }

  public Refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const scope = this.Scope.FilterFor('CompanyID');
      const [open, awaiting, failed, unbatched, unstamped] = await Promise.all([
        this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status IN ('Pending','Approved')` }),
        this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Pending'` }),
        this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Failed'` }),
        this.count({ EntityName: JE_ENTITY, ExtraFilter: scope ? `(Status='Pending') AND (${scope})` : `Status='Pending'` }),
        // MOD-14: a built batch with no approval task is the detectable, retryable state. Surfacing
        // it here is what makes it actionable rather than merely detectable.
        this.count({ EntityName: BATCH_ENTITY, ExtraFilter: `Status='Pending' AND ApprovalTaskID IS NULL` }),
      ]);

      this.Stats = [
        { Id: 'open', Label: 'Open batches', Value: open, Icon: 'fa-solid fa-layer-group', GoTo: 'all-batches',
          Tooltip: 'Batches that are Pending or Approved — not yet sent to the ERP.' },
        { Id: 'awaiting', Label: 'Awaiting approval', Value: awaiting, Icon: 'fa-solid fa-user-check',
          GoTo: 'approvals', Warn: awaiting > 0,
          Tooltip: 'Pending batches waiting on a CFO decision before they can be dispatched.' },
        { Id: 'failed', Label: 'Dispatch failures', Value: failed, Icon: 'fa-solid fa-triangle-exclamation',
          GoTo: 'dispatch', Warn: failed > 0,
          Tooltip: 'Batches whose ERP dispatch failed — retry them from Dispatch status.' },
        { Id: 'unbatched', Label: 'Unbatched entries', Value: unbatched, Icon: 'fa-solid fa-inbox', GoTo: 'workspace',
          Tooltip: 'Pending journal entries waiting to be batched (in your company scope).' },
        { Id: 'unstamped', Label: 'Batches with no approval task', Value: unstamped, Icon: 'fa-solid fa-link-slash',
          GoTo: 'approvals', Warn: unstamped > 0,
          Tooltip: 'Built batches whose approval task could not be raised (MOD-14). The batch is valid — the task needs retrying, or nobody will be asked to approve it.' },
      ];
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Stats = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }
}
