import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { RunViewParams, CompositeKey, Metadata } from '@memberjunction/core';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { GridColumnConfig } from '@memberjunction/ng-entity-viewer';
import { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { openBizDetail } from '../../shared/biz-detail-form';
import { TIME_WINDOWS, TimeWindowId, timeWindowFilter, andFilters } from '../../../transfer-pending/list-scaffold/time-window';
import { sqlLiteral, likeContains } from '../../../transfer-pending/list-scaffold/sql-filter';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** Value-list union derived from the generated entity (MJ CLAUDE.md rule 2c — never hand-copied). */
type JEStatus = mjBizAppsAccountingJournalEntryEntity['Status'];

/**
 * The ledger status lifecycle. Only three values and they ARE the screen's semantic spine (the
 * filter chips read Pending → Batched → GLPosted in lifecycle order, which no metadata ordering
 * gives us), so the list is stated here — but typed as `JEStatus[]`, so if CodeGen ever widens the
 * CHECK constraint this line fails to compile rather than silently omitting a status.
 */
const STATUSES: readonly JEStatus[] = ['Pending', 'Batched', 'GLPosted'] as const;

/**
 * All journal entries (UI plan §8.1) — the **list-scaffold pilot**: the grid/filter/slide-in idiom
 * every other list clones.
 *
 * **Built on MJ's `<mj-entity-data-grid>`** (§8 MJ-wins rule), which already ships the whole list
 * substrate this screen needs: AG Grid rendering, RunView-driven loading, **infinite (server-side)
 * pagination** — the plan's keyset "Load more" in MJ's own idiom — server-side sorting, column
 * reorder/resize/visibility, export, and per-user grid-state persistence. We contribute only the
 * domain: the filter set, the column config, and the row slide-in.
 *
 * Filters live in the page header's `[toolbar]` and state in `[meta]`, per the Explorer chrome
 * conventions; the refresh control is the single header seam from the §8 dispatch refresh policy
 * (refetch-on-mutating-action + ONE refresh control, no polling).
 */
@Component({
  standalone: false,
  selector: 'mj-all-journal-entries-page',
  templateUrl: './all-journal-entries.page.html',
  styleUrls: ['./all-journal-entries.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllJournalEntriesPageComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private forms = inject(MJFormPresenterService);
  public Scope = inject(CompanyScopeService);

  public readonly TimeWindows = TIME_WINDOWS;
  public readonly Statuses = STATUSES;

  /**
   * EntryType's value list, read from MJ entity metadata at runtime rather than hand-listed.
   *
   * This field's union is CodeGen-generated from the column's CHECK constraint and is genuinely a
   * moving target (16 values today: OrderBooking, Reversal, Refund, RevenueRecognition, …). A
   * hard-coded array here would silently stop offering any value a later migration adds — the exact
   * drift MJ CLAUDE.md rule 2c warns about. Metadata is the same source CodeGen used, so the filter
   * tracks the constraint forever, for free.
   */
  public EntryTypes: string[] = [];

  /** Time-window default — §0 requires one on every list; 90 days suits a ledger review. */
  public TimeWindow: TimeWindowId = 'last90';
  public StatusFilter: JEStatus | 'All' = 'All';
  /**
   * `string`, not `JEType | 'All'`, on purpose: the options come from runtime metadata (see
   * EntryTypes), so claiming the compile-time union here would be a cast we cannot honour. The
   * value is only ever composed into a filter predicate.
   */
  public TypeFilter: string = 'All';
  public Search = '';

  public GridParams: RunViewParams = { EntityName: JE_ENTITY };

  /** Bumped to force the grid to refetch (the header refresh control + post-mutation refetch). */
  public RefreshToken = 0;

  public Columns: GridColumnConfig[] = [
    { field: 'EntryNumber', title: 'Entry №', width: 140, sortable: true },
    { field: 'EffectiveDate', title: 'Effective', width: 120, sortable: true },
    { field: 'Status', title: 'Status', width: 110, sortable: true },
    { field: 'EntryType', title: 'Type', width: 100, sortable: true },
    { field: 'Description', title: 'Description', width: 'auto', sortable: false },
    { field: 'CompanyID', title: 'Company', width: 160, visible: false, sortable: true },
    { field: 'BatchID', title: 'Batch', width: 140, visible: false, sortable: true },
  ];

  ngOnInit(): void {
    this.EntryTypes = this.loadEntryTypeValues();
    this.applyFilters();
  }

  /** Read EntryType's allowed values from entity metadata (see the EntryTypes doc comment). */
  private loadEntryTypeValues(): string[] {
    const entity = new Metadata().EntityByName(JE_ENTITY);
    const field = entity?.Fields.find((f) => f.Name === 'EntryType');
    return (field?.EntityFieldValues ?? []).map((v) => v.Value).sort((a, b) => a.localeCompare(b));
  }

  /** Recompute the grid's RunViewParams from the current filter set + the app-wide company scope. */
  public applyFilters(): void {
    const filter = andFilters(
      timeWindowFilter(this.TimeWindow, 'EffectiveDate'),
      this.StatusFilter === 'All' ? null : `Status='${this.StatusFilter}'`,
      this.TypeFilter === 'All' ? null : `EntryType='${sqlLiteral(this.TypeFilter)}'`,
      this.searchFilter(),
      // Company scope is app-wide: an empty selection means ALL, resolved inside the service so the
      // rule lives in exactly one place.
      this.Scope.FilterFor('CompanyID'),
    );

    this.GridParams = {
      EntityName: JE_ENTITY,
      ExtraFilter: filter || undefined,
      OrderBy: 'EffectiveDate DESC, EntryNumber DESC',
    };
    this.cdr.markForCheck();
  }

  /**
   * Server-side search over the entry number + description. Escaped via the shared seam — this text
   * is composed into a SQL predicate string (RunView.ExtraFilter has no parameter binding).
   */
  private searchFilter(): string | null {
    return likeContains(['EntryNumber', 'Description'], this.Search);
  }

  public OnFilterChanged(): void {
    this.applyFilters();
  }

  /** The ONE refresh control (§8 dispatch ruling) — the seam live push replaces later. */
  public Refresh(): void {
    this.RefreshToken++;
    this.applyFilters();
  }

  /**
   * Row click → the standard bizapps slide-in (element doctrine: slide-in = quick VIEW).
   * `rowKey` is the grid's KeyField value — the JE's ID.
   */
  public OnRowClicked(rowKey: string | null | undefined): void {
    if (!rowKey) return;
    openBizDetail(this.forms, {
      entityName: JE_ENTITY,
      primaryKey: CompositeKey.FromID(rowKey),
      title: 'Journal entry',
      mode: 'slide-in',
    });
  }

  public get ScopeLabel(): string {
    return this.Scope.Label;
  }
}
