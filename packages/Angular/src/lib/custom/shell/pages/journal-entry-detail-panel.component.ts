import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CompositeKey } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import type {
  AfterReversalRequestedEventArgs,
  JEHeaderView,
  RecordOpenRequestedEventArgs,
} from '@mj-biz-apps/accounting-ng-widgets';

import { openBizDetail } from '../../shared/biz-detail-form';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/**
 * Journal-entry detail slide-in (UI plan §8.1 "Row slide-in"). **Layer 3.**
 *
 * Element doctrine: **slide-in = quick VIEW** — peek at an entry without leaving the list. It
 * carries a pop-out (↗) to the entry's full-depth home, per the "every modal and slide-in
 * carries a pop-out" rule.
 *
 * The entry itself is rendered by `<mjacc-journal-entry-detail>` — the same widget the Explorer
 * Journal Entry form embeds. This class owns only what is genuinely Explorer's business: the
 * slide-panel chrome, the pop-out, and turning the widget's `RecordOpenRequested` intent into an
 * actual MJ presentation.
 *
 * It used to be ~380 lines, most of them a second implementation of the entry itself: a batched
 * two-hop loader, dimension folding, GL-account resolution, reversal-chain lookup, Dr/Cr totals
 * and the balance verdict. All of that moved into the widget, unchanged in behaviour — this was
 * the BETTER of the two duplicates, so the merge kept its logic and the Explorer form inherited
 * the improvement.
 *
 * **Deviation from the mockup (recorded honestly):** §8.1 asks for expandable rows revealing
 * lines INLINE in the grid. MJ's `<mj-entity-data-grid>` is AG Grid **Community**, where
 * master/detail is an Enterprise feature — so lines live here in the slide-in instead. The
 * information is all present; the affordance differs. Revisit if MJ's grid gains detail rows.
 *
 * **Public API is unchanged** by the layering refactor — `[JournalEntryID]`, `(Closed)`,
 * `(Changed)` — so `all-journal-entries.page.html` and `je-approvals.page.html` did not move.
 */
@Component({
  standalone: false,
  selector: 'mj-journal-entry-detail-panel',
  templateUrl: './journal-entry-detail-panel.component.html',
  styleUrls: ['./journal-entry-detail-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalEntryDetailPanelComponent extends BaseAngularComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly forms = inject(MJFormPresenterService);

  /**
   * The entry to show.
   *
   * The host parses the grid rowKey (`"ID|<guid>"`) with `rowKeyToId` before binding it here —
   * this input is a bare id, never a CompositeKey string. Passed straight through to the
   * composite, which owns the load.
   */
  @Input()
  set JournalEntryID(value: string | null) {
    this._journalEntryID = value;
    if (!value) this._entryNumber = null;
  }
  get JournalEntryID(): string | null {
    return this._journalEntryID;
  }
  private _journalEntryID: string | null = null;

  @Output() Closed = new EventEmitter<void>();

  /** Emitted after a mutating action succeeds, so the host list refetches (§8 refresh policy). */
  @Output() Changed = new EventEmitter<void>();

  /** Kept only for the panel title — the composite owns everything else about the entry. */
  private _entryNumber: string | null = null;

  public get Visible(): boolean {
    return !!this._journalEntryID;
  }

  public get Title(): string {
    return this._entryNumber ? `Journal entry ${this._entryNumber}` : 'Journal entry';
  }

  public Close(): void {
    this.Closed.emit();
  }

  /**
   * Pop-out (↗) to the entry's full-depth home — the MJ form host.
   *
   * **The panel closes as part of opening it** (GUI feedback 2026-07-16): the slide-in sits ABOVE
   * the main screen, so leaving it open meant "Open full" opened the full entry *behind* the panel
   * that hid it. Opening the full record and staying open is never the intent — the end state is
   * the full record, unobstructed.
   */
  public PopOut(): void {
    if (!this._journalEntryID) return;
    openBizDetail(this.forms, {
      entityName: JE_ENTITY,
      primaryKey: CompositeKey.FromID(this._journalEntryID),
      title: this.Title,
      mode: 'dialog',
    });
    this.Closed.emit();
  }

  /**
   * The widget asked for a record to be opened — a GL account, the source order, the other end of
   * a reversal chain. Turning that into a presentation is this layer's job; the widget neither
   * knows nor cares that the answer happens to be an MJ form overlay.
   *
   * Same rule as PopOut: we hand the screen over, so this panel gets out of the way.
   */
  public OnRecordOpenRequested(event: RecordOpenRequestedEventArgs): void {
    openBizDetail(this.forms, {
      entityName: event.EntityName,
      primaryKey: CompositeKey.FromID(event.RecordID),
      title: event.Title,
      mode: event.Preference === 'tab' ? 'dialog' : event.Preference,
    });
    this.Closed.emit();
  }

  /** The composite already refetched itself; the host list has not (§8 refresh policy). */
  public OnAfterReversal(event: AfterReversalRequestedEventArgs): void {
    if (event.Success) this.Changed.emit();
  }

  /** Name the panel as the composite resolves the entry, without issuing a second read. */
  public OnHeaderLoaded(header: JEHeaderView | null): void {
    this._entryNumber = header?.EntryNumber ?? null;
    this.cdr.markForCheck();
  }
}
