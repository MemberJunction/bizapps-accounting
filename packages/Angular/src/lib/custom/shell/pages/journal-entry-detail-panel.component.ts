import { Component, ChangeDetectionStrategy, ChangeDetectorRef, Input, Output, EventEmitter, inject } from '@angular/core';
import { RunView, RunViewParams, CompositeKey } from '@memberjunction/core';
import { NormalizeUUID } from '@memberjunction/global';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { openBizDetail } from '../../shared/biz-detail-form';
import { JournalEntryClient } from '../../JournalEntry/journal-entry.client';
import { canReverse, reversalBlockedReason, awaitsApproval, isBalanced, statusVariant, JEStatus, JEType } from '../../shared/je-rules';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JE_LINE_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JE_LINE_DIM_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const GL_ACCOUNT_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const ORDER_ENTITY = 'MJ_BizApps_Orders: Orders';

/**
 * The JE header this panel shows. Every field is a real column/view field on
 * `MJ_BizApps_Accounting: Journal Entries` — nothing here is derived or invented.
 */
export interface JEDetailHeader {
  ID: string;
  EntryNumber: string;
  EntryType: JEType;
  Status: JEStatus;
  EffectiveDate: Date | null;
  Description: string | null;
  CompanyID: string;
  /** Denormalized company name carried by vwJournalEntries — no lookup needed. */
  Company: string;
  OrderID: string | null;
  JournalEntryBatchID: string | null;
  ReversedByJournalEntryID: string | null;
  ReversesJournalEntryID: string | null;
  /** datetimeoffset — an INSTANT. Rendered in the viewer's local zone. */
  GLPostedAt: Date | null;
  GLReferenceID: string | null;
  /** datetimeoffset — an INSTANT. Rendered in the viewer's local zone. */
  __mj_CreatedAt: Date;
}

/** The raw line row as read from the view, before its account + dimensions are folded in. */
interface JELineRow {
  ID: string;
  LineNumber: number;
  GLAccount: string | null;
  GLAccountID: string;
  DebitAmount: number | null;
  CreditAmount: number | null;
  Description: string | null;
}

/** One line, with its account identity and dimension tags folded in. */
interface JEDetailLine {
  LineNumber: number;
  /** GLAccount.Code — the number an accountant actually scans for. */
  AccountCode: string;
  /** GLAccount.Name (falls back to the view's denormalized GLAccount label). */
  AccountName: string;
  AccountType: string | null;
  Debit: number;
  Credit: number;
  Description: string | null;
  Dimensions: string[];
}

/** A GL account row, resolved so a line can show code + name rather than a bare label. */
interface GLAccountRow {
  ID: string;
  Code: string;
  Name: string;
  AccountType: string;
}

/**
 * Journal-entry detail slide-in (UI plan §8.1 "Row slide-in").
 *
 * Element doctrine: **slide-in = quick VIEW** — peek at an entry without leaving the list. It
 * carries a pop-out (↗) to the entry's full-depth home, per the "every modal and slide-in carries a
 * pop-out" rule.
 *
 * **Review-completeness (GUI feedback, 2026-07-16):** someone approving an entry must see
 * essentially everything on the FIRST click — so the panel carries the entry's full identity
 * (number, type, status, company, effective date, description), its GL-roundtrip state
 * (posted-at + ERP reference), its **lines** (account code + name, Dr/Cr, memo, dimensions) with
 * the Dr/Cr totals and the balance verdict, plus origin lineage (the source order, as a cross-app
 * deep link), the reversal chain and batch membership. A JE's lines ARE the entry; a JE panel
 * without them is not reviewable.
 *
 * The one mutating verb is Reverse; it refetches on completion (§8 refresh policy: refetch-on-
 * mutating-action) and emits `Changed` so the host list refetches too.
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
   *
   * The host parses the grid rowKey ("ID|<guid>") with `rowKeyToId` before binding it here — this
   * input is a bare id, never a CompositeKey string.
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
  /**
   * "Open in workspace" — carries the entry ID; the host routes it to the JE workspace page via the
   * category's `GoToPage('workspace', id)`. Close-as-you-leave: the workspace is the destination,
   * so this panel gets out of the way. This is the panel's ONE open action (Marcelo 2026-08-05):
   * the old "Open full" pop-out to the MJ form host was removed — the workspace IS the full-depth
   * home for an entry, so two open verbs were one too many.
   */
  @Output() OpenInWorkspace = new EventEmitter<string>();

  public GoToWorkspace(): void {
    if (!this.Header) return;
    const id = this.Header.ID;
    this.Closed.emit();
    this.OpenInWorkspace.emit(id);
  }

  public Header: JEDetailHeader | null = null;
  public Lines: JEDetailLine[] = [];
  public JournalEntryBatchNumber: string | null = null;
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

  /**
   * Dr/Cr totals + the balance verdict.
   *
   * A JE stores NO header total — the totals exist only as the sum of its lines, so summing the
   * lines shown here is the single source, not a second one that could disagree with a stored value.
   */
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

  /**
   * Cross-app deep link to the order that booked this entry (the GUI-review navigation fix).
   * Close-as-you-leave: we hand the screen over, so this panel gets out of the way.
   */
  public OpenSourceOrder(): void {
    if (!this.Header?.OrderID) return;
    openBizDetail(this.forms, {
      entityName: ORDER_ENTITY,
      primaryKey: CompositeKey.FromID(this.Header.OrderID),
      title: 'Order',
      mode: 'slide-in',
    });
    this.Closed.emit();
  }

  public async Reverse(): Promise<void> {
    if (!this.Header || !this.CanReverse) return;

    this.IsReversing = true;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new JournalEntryClient(this.ProviderToUse as GraphQLDataProvider);
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
    this.JournalEntryBatchNumber = null;
    this.ReversalEntryNumber = null;
    this.ReversesEntryNumber = null;
    this.ActionMessage = null;
    this.LoadError = null;
  }

  /**
   * TWO round-trips for the whole entry, never one-per-row:
   *   1. header + lines, batched (`RunViews`);
   *   2. the line-keyed follow-ups (dimensions, GL accounts) + the lineage reads (batch, related
   *      JEs), all batched — they are keyed on ids the first read returns, hence the second hop.
   */
  private async load(id: string): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const [headerRes, lineRes] = await this.runView().RunViews(
        [
          {
            EntityName: JE_ENTITY,
            ExtraFilter: `ID='${id}'`,
            Fields: [
              'ID', 'EntryNumber', 'EntryType', 'Status', 'EffectiveDate', 'Description',
              'CompanyID', 'Company', 'OrderID', 'JournalEntryBatchID', 'ReversedByJournalEntryID',
              'ReversesJournalEntryID', 'GLPostedAt', 'GLReferenceID', '__mj_CreatedAt',
            ],
            ResultType: 'simple',
          },
          {
            EntityName: JE_LINE_ENTITY,
            ExtraFilter: `JournalEntryID='${id}'`,
            Fields: ['ID', 'LineNumber', 'GLAccount', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description'],
            OrderBy: 'LineNumber ASC',
            ResultType: 'simple',
          },
        ],
        this.contextUser(),
      );

      if (!headerRes.Success) {
        this.LoadError = headerRes.ErrorMessage ?? 'This journal entry could not be loaded.';
        return;
      }
      const header = (headerRes.Results?.[0] ?? null) as JEDetailHeader | null;
      if (!header) {
        // Honest "not found" — never a blank panel.
        this.LoadError = 'This journal entry could not be found. It may have been deleted, or you may not have access to it.';
        return;
      }
      this.Header = header;

      const rawLines = (lineRes.Success ? (lineRes.Results ?? []) : []) as JELineRow[];
      await this.loadDetail(header, rawLines);
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

  /** The single second round-trip: everything keyed on the ids the first read produced. */
  private async loadDetail(header: JEDetailHeader, rawLines: JELineRow[]): Promise<void> {
    this.JournalEntryBatchNumber = null;
    this.ReversalEntryNumber = null;
    this.ReversesEntryNumber = null;

    const lineIDs = rawLines.map((l) => l.ID);
    const accountIDs = [...new Set(rawLines.map((l) => NormalizeUUID(l.GLAccountID)))];
    const relatedJEIds = [header.ReversedByJournalEntryID, header.ReversesJournalEntryID].filter(
      (x): x is string => !!x,
    );

    const queries: RunViewParams[] = [];
    const slots: { dims?: number; accounts?: number; batch?: number; related?: number } = {};
    if (lineIDs.length > 0) {
      slots.dims = queries.length;
      queries.push(this.dimensionQuery(lineIDs));
      slots.accounts = queries.length;
      queries.push(this.accountQuery(accountIDs));
    }
    if (header.JournalEntryBatchID) {
      slots.batch = queries.length;
      queries.push({ EntityName: BATCH_ENTITY, ExtraFilter: `ID='${header.JournalEntryBatchID}'`, Fields: ['ID', 'JournalEntryBatchNumber'], ResultType: 'simple' });
    }
    if (relatedJEIds.length > 0) {
      slots.related = queries.length;
      queries.push({ EntityName: JE_ENTITY, ExtraFilter: this.idInFilter(relatedJEIds), Fields: ['ID', 'EntryNumber'], ResultType: 'simple' });
    }

    const results = queries.length > 0 ? await this.runView().RunViews(queries, this.contextUser()) : [];

    const dims = slots.dims === undefined ? new Map<string, string[]>() : this.foldDimensions(results[slots.dims]?.Results ?? []);
    const accounts = slots.accounts === undefined ? new Map<string, GLAccountRow>() : this.indexAccounts(results[slots.accounts]?.Results ?? []);
    this.Lines = rawLines.map((l) => this.toDetailLine(l, accounts, dims));

    if (slots.batch !== undefined) {
      const row = (results[slots.batch]?.Results?.[0] ?? null) as { JournalEntryBatchNumber: string } | null;
      this.JournalEntryBatchNumber = row?.JournalEntryBatchNumber ?? null;
    }
    if (slots.related !== undefined) {
      this.applyReversalChain(header, (results[slots.related]?.Results ?? []) as Array<{ ID: string; EntryNumber: string }>);
    }
  }

  /** Dimension tags per line. The view carries denormalized Dimension/DimensionValue names, so
   *  there is no lookup to do (MJ convention: use view fields instead of lookups). */
  private dimensionQuery(lineIDs: string[]): RunViewParams {
    return {
      EntityName: JE_LINE_DIM_ENTITY,
      ExtraFilter: `JournalEntryLineID IN (${lineIDs.map((i) => `'${i}'`).join(',')})`,
      Fields: ['JournalEntryLineID', 'Dimension', 'DimensionValue'],
      OrderBy: 'Dimension ASC',
      ResultType: 'simple',
    };
  }

  /** The line view's `GLAccount` is a single denormalized label — the CODE lives only on the
   *  account row, so one bounded keyed read resolves code + name for every line at once. */
  private accountQuery(accountIDs: string[]): RunViewParams {
    return {
      EntityName: GL_ACCOUNT_ENTITY,
      ExtraFilter: this.idInFilter(accountIDs),
      Fields: ['ID', 'Code', 'Name', 'AccountType'],
      ResultType: 'simple',
    };
  }

  private idInFilter(ids: string[]): string {
    return `ID IN (${ids.map((i) => `'${i}'`).join(',')})`;
  }

  private foldDimensions(rows: unknown[]): Map<string, string[]> {
    const byLine = new Map<string, string[]>();
    for (const row of rows as Array<{ JournalEntryLineID: string; Dimension: string; DimensionValue: string }>) {
      // NormalizeUUID for the Map key — SQL Server hands UUIDs back uppercase (UUID guide).
      const key = NormalizeUUID(row.JournalEntryLineID);
      const list = byLine.get(key) ?? [];
      list.push(`${row.Dimension}: ${row.DimensionValue}`);
      byLine.set(key, list);
    }
    return byLine;
  }

  private indexAccounts(rows: unknown[]): Map<string, GLAccountRow> {
    return new Map((rows as GLAccountRow[]).map((a) => [NormalizeUUID(a.ID), a]));
  }

  private toDetailLine(line: JELineRow, accounts: Map<string, GLAccountRow>, dims: Map<string, string[]>): JEDetailLine {
    const account = accounts.get(NormalizeUUID(line.GLAccountID));
    return {
      LineNumber: line.LineNumber,
      // Degrade the LABEL, never the money: an unresolved account still shows its Dr/Cr.
      AccountCode: account?.Code ?? '—',
      AccountName: account?.Name ?? line.GLAccount ?? '(unknown account)',
      AccountType: account?.AccountType ?? null,
      Debit: Number(line.DebitAmount ?? 0),
      Credit: Number(line.CreditAmount ?? 0),
      Description: line.Description,
      Dimensions: dims.get(NormalizeUUID(line.ID)) ?? [],
    };
  }

  /** The reversal chain, resolved to human entry numbers rather than raw ids. */
  private applyReversalChain(header: JEDetailHeader, rows: Array<{ ID: string; EntryNumber: string }>): void {
    const byId = new Map(rows.map((r) => [NormalizeUUID(r.ID), r.EntryNumber]));
    this.ReversalEntryNumber = header.ReversedByJournalEntryID ? (byId.get(NormalizeUUID(header.ReversedByJournalEntryID)) ?? null) : null;
    this.ReversesEntryNumber = header.ReversesJournalEntryID ? (byId.get(NormalizeUUID(header.ReversesJournalEntryID)) ?? null) : null;
  }
}
