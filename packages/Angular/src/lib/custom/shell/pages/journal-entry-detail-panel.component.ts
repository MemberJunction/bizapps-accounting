import { Component, ChangeDetectionStrategy, ChangeDetectorRef, Input, Output, EventEmitter, inject } from '@angular/core';
import { RunView, CompositeKey } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { openBizDetail } from '../../shared/biz-detail-form';
import { JournalEntryConsoleClient } from '../../JournalEntryConsole/je-console.client';
import { canReverse, reversalBlockedReason, awaitsApproval, isBalanced, statusVariant, JEStatus, JEType } from '../../shared/je-rules';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JE_LINE_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JE_LINE_DIM_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const ORDER_ENTITY = 'MJ_BizApps_Orders: Orders';

/** The JE header this panel shows. */
export interface JEDetailHeader {
  ID: string;
  EntryNumber: string;
  EntryType: JEType;
  Status: JEStatus;
  EffectiveDate: Date | null;
  Description: string | null;
  OrderID: string | null;
  BatchID: string | null;
  ReversedByJournalEntryID: string | null;
  ReversesJournalEntryID: string | null;
}

/** One line, with its dimension tags folded in. */
interface JEDetailLine {
  LineNumber: number;
  Account: string;
  Debit: number;
  Credit: number;
  Description: string | null;
  Dimensions: string[];
}

/**
 * Journal-entry detail slide-in (UI plan §8.1 "Row slide-in").
 *
 * Element doctrine: **slide-in = quick VIEW** — peek at an entry without leaving the list. It
 * carries a pop-out (↗) to the entry's full-depth home, per the "every modal and slide-in carries a
 * pop-out" rule.
 *
 * Shows: the balanced Dr/Cr lines with their dimensions, origin lineage (the source order, as a
 * cross-app deep link), the reversal chain, batch membership, and the C.8 approval chip. The one
 * mutating verb is Reverse; it refetches on completion (§8 refresh policy: refetch-on-mutating-
 * action) and emits `Changed` so the host list refetches too.
 *
 * **Deviation from the mockup (recorded honestly):** §8.1 asks for expandable rows revealing lines
 * INLINE in the grid. MJ's `<mj-entity-data-grid>` is AG Grid **Community**, where master/detail is
 * an Enterprise feature — so lines live here in the slide-in instead. The information is all
 * present; the affordance differs. Revisit if MJ's grid gains detail rows.
 */
@Component({
  standalone: false,
  selector: 'mj-journal-entry-detail-panel',
  templateUrl: './journal-entry-detail-panel.component.html',
  styleUrls: ['./journal-entry-detail-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalEntryDetailPanelComponent extends BaseAngularComponent {
  private cdr = inject(ChangeDetectorRef);
  private forms = inject(MJFormPresenterService);

  /**
   * The entry to show. Setter-driven (not ngOnChanges) per the MJ Angular convention — we want the
   * load to fire exactly when the id actually changes.
   */
  @Input()
  set JournalEntryID(value: string | null) {
    const previous = this._journalEntryID;
    this._journalEntryID = value;
    if (value && value !== previous) void this.load(value);
    if (!value) this.reset();
  }
  get JournalEntryID(): string | null {
    return this._journalEntryID;
  }
  private _journalEntryID: string | null = null;

  // The data provider comes from BaseAngularComponent (`Provider` @Input + the `ProviderToUse`
  // getter that falls back to the global). Using it rather than `new Metadata()` is what keeps this
  // correct under a non-default provider — see MJ CLAUDE.md on per-provider code paths.

  @Output() Closed = new EventEmitter<void>();
  /** Emitted after a mutating action succeeds, so the host list refetches (§8 refresh policy). */
  @Output() Changed = new EventEmitter<void>();

  public Header: JEDetailHeader | null = null;
  public Lines: JEDetailLine[] = [];
  public BatchNumber: string | null = null;
  public ReversalEntryNumber: string | null = null;
  public ReversesEntryNumber: string | null = null;

  public IsLoading = false;
  public LoadError: string | null = null;
  public IsReversing = false;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  public get Visible(): boolean {
    return !!this._journalEntryID;
  }

  public get Title(): string {
    return this.Header ? `Journal entry ${this.Header.EntryNumber}` : 'Journal entry';
  }

  public get TotalDebits(): number {
    return this.Lines.reduce((sum, l) => sum + l.Debit, 0);
  }
  public get TotalCredits(): number {
    return this.Lines.reduce((sum, l) => sum + l.Credit, 0);
  }
  public get IsBalanced(): boolean {
    return isBalanced(this.TotalDebits, this.TotalCredits);
  }

  /** Typed as the badge's own union, not `string` — strictTemplates rejects the widened type. */
  public get StatusVariant(): MJStatBadgeVariant {
    return this.Header ? statusVariant(this.Header.Status) : 'default';
  }

  /** C.8: a Pending Manual entry is sitting behind the CFO gate and cannot be batched yet. */
  public get AwaitsApproval(): boolean {
    return this.Header ? awaitsApproval(this.Header) : false;
  }

  public get CanReverse(): boolean {
    return !!this.Header && canReverse(this.Header) && !this.IsReversing;
  }

  public get ReverseBlockedReason(): string | null {
    return this.Header ? reversalBlockedReason(this.Header) : null;
  }

  public Close(): void {
    this.Closed.emit();
  }

  /** Pop-out (↗) to the entry's full-depth home — the MJ form host for now (JE workspace later). */
  public PopOut(): void {
    if (!this.Header) return;
    openBizDetail(this.forms, {
      entityName: JE_ENTITY,
      primaryKey: CompositeKey.FromID(this.Header.ID),
      title: `Journal entry ${this.Header.EntryNumber}`,
      mode: 'dialog',
    });
  }

  /** Cross-app deep link to the order that booked this entry (the GUI-review navigation fix). */
  public OpenSourceOrder(): void {
    if (!this.Header?.OrderID) return;
    openBizDetail(this.forms, {
      entityName: ORDER_ENTITY,
      primaryKey: CompositeKey.FromID(this.Header.OrderID),
      title: 'Order',
      mode: 'slide-in',
    });
  }

  public async Reverse(): Promise<void> {
    if (!this.Header || !this.CanReverse) return;

    this.IsReversing = true;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new JournalEntryConsoleClient(this.ProviderToUse as GraphQLDataProvider);
      const res = await client.GenerateReversal(this.Header.ID, `Reversal of ${this.Header.EntryNumber} from the journal entries browser`);
      if (res.Success) {
        this.ActionMessage = `Reversed ${this.Header.EntryNumber} → new entry ${res.ReversalEntryNumber ?? '(pending)'}.`;
        this.ActionIsError = false;
        await this.load(this.Header.ID); // refetch-on-mutating-action
        this.Changed.emit();
      } else {
        this.setError(res.ErrorMessage ?? 'Reversal failed.');
      }
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.IsReversing = false;
      this.cdr.markForCheck();
    }
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }

  private reset(): void {
    this.Header = null;
    this.Lines = [];
    this.BatchNumber = null;
    this.ReversalEntryNumber = null;
    this.ReversesEntryNumber = null;
    this.ActionMessage = null;
    this.LoadError = null;
  }

  private async load(id: string): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const header = await this.loadHeader(id);
      if (!header) {
        this.LoadError = 'This journal entry could not be loaded.';
        return;
      }
      this.Header = header;
      this.Lines = await this.loadLines(id);
      await this.loadLineage(header);
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  private runView(): RunView {
    return RunView.FromMetadataProvider(this.ProviderToUse);
  }

  private contextUser() {
    return this.ProviderToUse.CurrentUser;
  }

  private async loadHeader(id: string): Promise<JEDetailHeader | null> {
    const res = await this.runView().RunView<JEDetailHeader>(
      {
        EntityName: JE_ENTITY,
        ExtraFilter: `ID='${id}'`,
        Fields: [
          'ID', 'EntryNumber', 'EntryType', 'Status', 'EffectiveDate', 'Description',
          'OrderID', 'BatchID', 'ReversedByJournalEntryID', 'ReversesJournalEntryID',
        ],
        ResultType: 'simple',
      },
      this.contextUser(),
    );
    return res.Success ? (res.Results?.[0] ?? null) : null;
  }

  /**
   * Lines + their dimension tags: TWO reads total, never a query-per-line (a 40-line JE would
   * otherwise fire 41 round-trips). Sequential rather than batched because the dimension read is
   * keyed on the line ids the first read returns — deliberately keyed on ids rather than a subquery
   * against a view name, which would bind this component to the view's physical name.
   */
  private async loadLines(id: string): Promise<JEDetailLine[]> {
    const lineRes = await this.runView().RunView<{
      ID: string; LineNumber: number; GLAccount: string | null; GLAccountID: string;
      DebitAmount: number | null; CreditAmount: number | null; Description: string | null;
    }>(
      {
        EntityName: JE_LINE_ENTITY,
        ExtraFilter: `JournalEntryID='${id}'`,
        Fields: ['ID', 'LineNumber', 'GLAccount', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description'],
        OrderBy: 'LineNumber ASC',
        ResultType: 'simple',
      },
      this.contextUser(),
    );
    if (!lineRes.Success) return [];

    const lines = lineRes.Results ?? [];
    const dimsByLine = lines.length > 0 ? await this.loadLineDimensions(lines.map((l) => l.ID)) : new Map<string, string[]>();

    return lines.map((l) => ({
      LineNumber: l.LineNumber,
      Account: l.GLAccount ?? l.GLAccountID,
      Debit: Number(l.DebitAmount ?? 0),
      Credit: Number(l.CreditAmount ?? 0),
      Description: l.Description,
      Dimensions: dimsByLine.get(l.ID) ?? [],
    }));
  }

  /** Dimension tags per line. The view carries denormalized Dimension/DimensionValue names, so
   *  there is no lookup to do (MJ convention: use view fields instead of lookups). */
  private async loadLineDimensions(lineIDs: string[]): Promise<Map<string, string[]>> {
    const res = await this.runView().RunView<{ JournalEntryLineID: string; Dimension: string; DimensionValue: string }>(
      {
        EntityName: JE_LINE_DIM_ENTITY,
        ExtraFilter: `JournalEntryLineID IN (${lineIDs.map((i) => `'${i}'`).join(',')})`,
        Fields: ['JournalEntryLineID', 'Dimension', 'DimensionValue'],
        OrderBy: 'Dimension ASC',
        ResultType: 'simple',
      },
      this.contextUser(),
    );

    const byLine = new Map<string, string[]>();
    if (!res.Success) return byLine;
    for (const d of res.Results ?? []) {
      const list = byLine.get(d.JournalEntryLineID) ?? [];
      list.push(`${d.Dimension}: ${d.DimensionValue}`);
      byLine.set(d.JournalEntryLineID, list);
    }
    return byLine;
  }

  /** Batch membership + the reversal chain, resolved to human numbers rather than raw ids. */
  private async loadLineage(header: JEDetailHeader): Promise<void> {
    this.BatchNumber = null;
    this.ReversalEntryNumber = null;
    this.ReversesEntryNumber = null;

    const relatedJEIds = [header.ReversedByJournalEntryID, header.ReversesJournalEntryID].filter(
      (x): x is string => !!x,
    );

    const queries = [];
    if (header.BatchID) {
      queries.push({
        EntityName: BATCH_ENTITY,
        ExtraFilter: `ID='${header.BatchID}'`,
        Fields: ['ID', 'BatchNumber'],
        ResultType: 'simple' as const,
      });
    }
    if (relatedJEIds.length > 0) {
      queries.push({
        EntityName: JE_ENTITY,
        ExtraFilter: `ID IN (${relatedJEIds.map((i) => `'${i}'`).join(',')})`,
        Fields: ['ID', 'EntryNumber'],
        ResultType: 'simple' as const,
      });
    }
    if (queries.length === 0) return;

    const results = await this.runView().RunViews(queries, this.contextUser());

    let index = 0;
    if (header.BatchID) {
      const batch = results[index++];
      const row = batch?.Success ? ((batch.Results?.[0] ?? null) as { BatchNumber: string } | null) : null;
      this.BatchNumber = row?.BatchNumber ?? null;
    }
    if (relatedJEIds.length > 0) {
      const related = results[index];
      const rows = (related?.Success ? (related.Results ?? []) : []) as Array<{ ID: string; EntryNumber: string }>;
      const byId = new Map(rows.map((r) => [r.ID, r.EntryNumber]));
      this.ReversalEntryNumber = header.ReversedByJournalEntryID ? (byId.get(header.ReversedByJournalEntryID) ?? null) : null;
      this.ReversesEntryNumber = header.ReversesJournalEntryID ? (byId.get(header.ReversesJournalEntryID) ?? null) : null;
    }
  }
}
