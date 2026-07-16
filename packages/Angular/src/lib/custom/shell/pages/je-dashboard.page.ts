import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { AccountingDashboardBase } from './accounting-dashboard.base';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const SJE_ENTITY = 'MJ_BizApps_Accounting: Scheduled Journal Entries';

/**
 * Journal Entries dashboard (UI plan §8.1) — cheap stats only.
 *
 * Every card is a filtered COUNT (see AccountingDashboardBase). The mockup also drew an
 * entries-per-day trend; that is exactly the "expensive stat" §0 rules out unless precomputed on a
 * schedule, so it is deliberately NOT here rather than being computed on demand.
 */
@Component({
  standalone: false,
  selector: 'mj-je-dashboard-page',
  templateUrl: './accounting-dashboard.html',
  styleUrls: ['./accounting-dashboard.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JeDashboardPageComponent extends AccountingDashboardBase implements OnInit {
  public Scope = inject(CompanyScopeService);
  public Title = 'Journal Entries';
  public Subtitle = 'What needs attention in the ledger';

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
      const and = (f: string) => (scope ? `(${f}) AND (${scope})` : f);
      const monthStart = this.monthStartUTC();

      const [thisMonth, unbatched, awaiting, scheduledDue] = await Promise.all([
        this.count({ EntityName: JE_ENTITY, ExtraFilter: and(`EffectiveDate >= '${monthStart}'`) }),
        this.count({ EntityName: JE_ENTITY, ExtraFilter: and(`Status='Pending'`) }),
        // C.8: a Pending MANUAL entry is sitting behind the CFO gate — it will not be batched.
        this.count({ EntityName: JE_ENTITY, ExtraFilter: and(`Status='Pending' AND EntryType='Manual'`) }),
        this.count({ EntityName: SJE_ENTITY, ExtraFilter: `Status='Scheduled' AND ScheduledEffectiveDate <= '${this.todayUTC()}'` }),
      ]);

      this.Stats = [
        { Id: 'month', Label: 'Entries this month', Value: thisMonth, Icon: 'fa-solid fa-book-open',
          Tooltip: 'Journal entries with an effective date in the current calendar month (UTC).' },
        { Id: 'unbatched', Label: 'Unbatched', Value: unbatched, Icon: 'fa-solid fa-layer-group', GoTo: 'all-entries',
          Tooltip: 'Pending entries — the candidate pool a batch build would sweep.' },
        { Id: 'awaiting', Label: 'Awaiting CFO approval', Value: awaiting, Icon: 'fa-solid fa-user-check',
          GoTo: 'approvals', Warn: awaiting > 0,
          Tooltip: 'Pending MANUAL entries. They are excluded from batching until approved (C.8) — this is why an entry can look "stuck".' },
        { Id: 'due', Label: 'Scheduled entries due', Value: scheduledDue, Icon: 'fa-regular fa-calendar-days', GoTo: 'scheduled',
          Tooltip: 'Scheduled entries whose date has arrived and which have not materialised yet.' },
      ];
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
      this.Stats = [];
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
