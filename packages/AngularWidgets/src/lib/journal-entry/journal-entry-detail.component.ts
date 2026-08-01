import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RunView, type RunViewParams } from '@memberjunction/core';
import { NormalizeUUID } from '@memberjunction/global';
import type { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { MJStatBadgeComponent, type MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import {
  JournalEntryClient,
  awaitsApproval,
  canReverse,
  isBalanced,
  reversalBlockedReason,
  statusVariant,
} from '@mj-biz-apps/accounting-engine-base';

import {
  AfterLoadCompletedEventArgs,
  AfterReversalRequestedEventArgs,
  BeforeReversalRequestedEventArgs,
  RecordOpenRequestedEventArgs,
} from './je-events';
import { JELineTableComponent } from './je-line-table.component';
import { JEReversalPanelComponent, type JEReversalRequest } from './je-reversal-panel.component';
import { JEStatusTimelineComponent } from './je-status-timeline.component';
import { sumCredits, sumDebits, type JEHeaderView, type JELineView, type JELineageView } from './je-view-models';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JE_LINE_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JE_LINE_DIM_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';
const GL_ACCOUNT_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';

const HEADER_FIELDS = [
  'ID', 'EntryNumber', 'EntryType', 'Status', 'EffectiveDate', 'Description',
  'CompanyID', 'Company', 'LinkedEntity', 'LinkedEntityID', 'LinkedRecordID', 'BatchID', 'ReversedByJournalEntryID',
  'ReversesJournalEntryID', 'GLPostedAt', 'GLReferenceID',
];

/** Raw line row as the view returns it, before accounts + dimensions are folded in. */
interface JELineRow {
  ID: string;
  LineNumber: number;
  GLAccount: string | null;
  GLAccountID: string;
  DebitAmount: number | null;
  CreditAmount: number | null;
  Description: string | null;
}

/** A GL account row, so a line can show code + name rather than a bare denormalized label. */
interface GLAccountRow {
  ID: string;
  Code: string;
  Name: string;
  AccountType: string;
}

/**
 * `<mjacc-journal-entry-detail>` — everything there is to know about one journal entry.
 *
 * **Layer 2.** It assembles the layer-1 widgets (timeline, line table, reversal panel), owns
 * loading, and emits intent. It performs exactly one mutation — the reversal — because that is
 * a domain operation against an L0 client, not a navigation. It never routes and it has never
 * heard of MJ Explorer, which is why the Explorer form, the slide-in panel, a standalone
 * Angular app and a test can all mount it.
 *
 * ## What this replaced
 *
 * Two components rendered this same entry independently:
 *
 * | | `journal-entry-form.component.ts` | `journal-entry-detail-panel.component.ts` |
 * |---|---|---|
 * | Reversal rule | `Status === 'GLPosted'` — **wrong twice** | `canReverse()` from the L0 rules — correct |
 * | Line loading | 2 queries, dimensions only | batched `RunViews`, dimensions + account code/name |
 * | Totals row | `colspan` off by one — Dr under the **Cr** heading | correct |
 * | Lineage | none | batch number + reversal chain |
 *
 * Neither was lazy work; they were written months apart by people solving the screen in front
 * of them. That is exactly how duplicates happen, and it is why the fix is structural rather
 * than a code review note.
 *
 * ## Data access
 *
 * Every read goes through `ProviderToUse` (inherited from `BaseAngularComponent`), never
 * `new RunView()`. That is what lets the same widget work under a non-default provider — and
 * it is checked by `npm run check:ui-layers`, so it cannot quietly regress.
 *
 * ## Example
 * ```html
 * <mjacc-journal-entry-detail
 *   [JournalEntryID]="id"
 *   [Provider]="ProviderToUse"
 *   (BeforeReversalRequested)="guardReversal($event)"
 *   (AfterReversalRequested)="refresh($event)"
 *   (RecordOpenRequested)="open($event)"
 *   (AfterLoadCompleted)="NotifyLoadComplete()" />
 * ```
 */
@Component({
  selector: 'mjacc-journal-entry-detail',
  standalone: true,
  imports: [
    CommonModule,
    MJStatBadgeComponent,
    JEStatusTimelineComponent,
    JELineTableComponent,
    JEReversalPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journal-entry-detail.component.html',
  styleUrls: ['./journal-entry-detail.component.css'],
})
export class JournalEntryDetailComponent extends BaseAngularComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  // ─── inputs ────────────────────────────────────────────────────────────────

  /**
   * The entry to show, by id. Setter-driven per MJ convention so the load fires exactly when
   * the id changes — not on every `ngOnChanges` pass.
   *
   * A host that already holds the record should bind {@link Header} instead and avoid the
   * header round-trip entirely; the lines are loaded either way.
   */
  @Input()
  set JournalEntryID(value: string | null) {
    const previous = this._journalEntryID;
    this._journalEntryID = value ? NormalizeUUID(value) : null;
    if (this._journalEntryID && this._journalEntryID !== previous) void this.load(this._journalEntryID);
    if (!value) this.reset();
  }
  get JournalEntryID(): string | null {
    return this._journalEntryID;
  }
  private _journalEntryID: string | null = null;

  /**
   * A pre-loaded header. Bind this when the host already has the record (an Explorer entity
   * form always does) so the composite skips the header read and loads only what the host
   * doesn't have: lines, dimensions, account names and lineage.
   */
  @Input()
  set Header(value: JEHeaderView | null) {
    this._header = value;
    this.AfterHeaderLoaded.emit(value);
    if (value?.ID) {
      const id = NormalizeUUID(value.ID);
      if (id !== this._journalEntryID) {
        this._journalEntryID = id;
        void this.loadDetail(value);
      }
    }
  }
  get Header(): JEHeaderView | null {
    return this._header;
  }
  private _header: JEHeaderView | null = null;

  /** Show the Pending → Batched → GL Posted timeline. */
  @Input() ShowTimeline = true;

  /** Show the reversal affordance. Off for read-only surfaces. */
  @Input() ShowReversal = true;

  /** Show the dimension column on lines. */
  @Input() ShowDimensions = true;

  /** Show batch membership and the reversal chain. */
  @Input() ShowLineage = true;

  /** Show the header identity strip. Off when the host already renders the entry's identity. */
  @Input() ShowIdentity = true;

  // ─── outputs ───────────────────────────────────────────────────────────────

  /**
   * Fired BEFORE a reversal request leaves. Set `Cancel = true` to block it — the request is
   * not sent and `AfterReversalRequested` does NOT fire.
   *
   * Handlers must be synchronous; see the note in `je-events.ts`.
   */
  @Output() BeforeReversalRequested = new EventEmitter<BeforeReversalRequestedEventArgs>();

  /** Fired AFTER a reversal request settles, success or failure. */
  @Output() AfterReversalRequested = new EventEmitter<AfterReversalRequestedEventArgs>();

  /** The operator asked to open a related record. The host decides how. */
  @Output() RecordOpenRequested = new EventEmitter<RecordOpenRequestedEventArgs>();

  /** A load attempt finished. Hosts use this to clear a shell spinner. */
  @Output() AfterLoadCompleted = new EventEmitter<AfterLoadCompletedEventArgs>();

  /**
   * The header is available. Informational, with no `Before` pair — a host cannot veto a load
   * that already happened.
   *
   * Exists so chrome outside the widget (a slide-in title, a tab label, a breadcrumb) can name
   * the entry without issuing its own read. `null` when the entry is cleared.
   */
  @Output() AfterHeaderLoaded = new EventEmitter<JEHeaderView | null>();

  // ─── state ─────────────────────────────────────────────────────────────────

  public Lines: JELineView[] = [];
  public Lineage: JELineageView = { BatchNumber: null, ReversalEntryNumber: null, ReversesEntryNumber: null };

  public IsLoading = false;
  public LoadError: string | null = null;
  public IsReversing = false;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  // ─── derived ───────────────────────────────────────────────────────────────

  public get TotalDebits(): number {
    return sumDebits(this.Lines);
  }

  public get TotalCredits(): number {
    return sumCredits(this.Lines);
  }

  /** The cent-tolerance rule lives in L0 and has exactly one definition. */
  public get IsBalanced(): boolean {
    return isBalanced(this.TotalDebits, this.TotalCredits);
  }

  /** Typed as the badge's own union — `strictTemplates` rejects the widened `string`. */
  public get StatusVariant(): MJStatBadgeVariant {
    return this._header ? statusVariant(this._header.Status) : 'default';
  }

  /** A Pending Manual entry sits behind the (designed, not yet enforced) CFO gate. */
  public get AwaitsApproval(): boolean {
    return this._header ? awaitsApproval(this._header) : false;
  }

  public get CanReverse(): boolean {
    return !!this._header && canReverse(this._header) && !this.IsReversing;
  }

  public get ReverseBlockedReason(): string | null {
    return this._header ? reversalBlockedReason(this._header) : null;
  }

  /** True when the entry names the record that caused it (an order, a payment, …). */
  public get HasSourceRecord(): boolean {
    return !!this._header?.LinkedRecordID && !!this._header?.LinkedEntity;
  }

  /** "Open source order", "Open source payment" — named from the link, not hardcoded. */
  public get SourceRecordLabel(): string {
    const entity = this._header?.LinkedEntity;
    if (!entity) return 'Source record';
    // "MJ_BizApps_Orders: Orders" → "Orders"; then singularize the common plural.
    const bare = entity.includes(':') ? entity.split(':').pop()!.trim() : entity;
    return `Source ${bare.replace(/s$/, '').toLowerCase()}`;
  }

  // ─── intent ────────────────────────────────────────────────────────────────

  /**
   * Ask the host to open the record that caused this entry.
   *
   * This used to be a hardcoded "open the order" that read `Header.OrderID`. That column was
   * replaced by the polymorphic `LinkedEntityID` / `LinkedRecordID` pair, and because the row was
   * read as an untyped `simple` result and cast, nothing complained: the property was
   * `undefined`, the guard was always false, and the button silently stopped rendering. Moving
   * the projection into a typed view model is what surfaced it.
   */
  public OpenSourceRecord(): void {
    const header = this._header;
    if (!header?.LinkedEntity || !header.LinkedRecordID) return;
    this.RecordOpenRequested.emit(
      new RecordOpenRequestedEventArgs(header.LinkedEntity, header.LinkedRecordID, this.SourceRecordLabel, 'slide-in'),
    );
  }

  /** Ask the host to open the batch this entry belongs to. */
  public OpenBatch(): void {
    const batchID = this._header?.BatchID;
    if (!batchID) return;
    this.RecordOpenRequested.emit(
      new RecordOpenRequestedEventArgs(BATCH_ENTITY, batchID, this.Lineage.BatchNumber ?? 'Batch', 'dialog'),
    );
  }

  /** Ask the host to open one side of the reversal chain. */
  public OpenRelatedEntry(which: 'reversal' | 'reverses'): void {
    const header = this._header;
    if (!header) return;
    const id = which === 'reversal' ? header.ReversedByJournalEntryID : header.ReversesJournalEntryID;
    const number = which === 'reversal' ? this.Lineage.ReversalEntryNumber : this.Lineage.ReversesEntryNumber;
    if (!id) return;
    this.RecordOpenRequested.emit(
      new RecordOpenRequestedEventArgs(JE_ENTITY, id, `Journal entry ${number ?? ''}`.trim(), 'dialog'),
    );
  }

  /** Bubbled from the line table — the operator clicked an account. */
  protected onLineRecordOpen(args: RecordOpenRequestedEventArgs): void {
    this.RecordOpenRequested.emit(args);
  }

  protected onReversalDismissed(): void {
    this.ActionMessage = null;
    this.cdr.markForCheck();
  }

  // ─── the one mutation ──────────────────────────────────────────────────────

  /**
   * Reverse this entry.
   *
   * The Before/After contract in full: emit `Before*`, bail without emitting `After*` if a
   * listener canceled, otherwise perform the operation and emit `After*` with the outcome —
   * success or failure, because the host needs to react either way.
   */
  protected async onReversalRequested(request: JEReversalRequest): Promise<void> {
    const header = this._header;
    if (!header || !this.CanReverse) return;

    const reason = request.Reason || `Reversal of ${header.EntryNumber} requested from the UI.`;
    const before = new BeforeReversalRequestedEventArgs(header.ID, header.EntryNumber, reason);
    this.BeforeReversalRequested.emit(before);
    if (before.Cancel) {
      this.setMessage(before.CancelReason ?? 'Reversal canceled.', true);
      return; // After* deliberately NOT emitted — the contract hosts rely on.
    }

    this.IsReversing = true;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new JournalEntryClient(this.ProviderToUse as GraphQLDataProvider);
      const result = await client.GenerateReversal(header.ID, reason);
      if (result.Success) {
        this.setMessage(
          `Reversed ${header.EntryNumber} → new entry ${result.ReversalEntryNumber ?? '(pending)'}.`,
          false,
        );
        await this.load(header.ID); // refetch-on-mutating-action
      } else {
        this.setMessage(result.ErrorMessage ?? 'Reversal failed.', true);
      }
      this.AfterReversalRequested.emit(
        new AfterReversalRequestedEventArgs(
          header.ID,
          result.Success,
          result.ReversalEntryNumber ?? null,
          result.ErrorMessage ?? null,
        ),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.setMessage(message, true);
      this.AfterReversalRequested.emit(new AfterReversalRequestedEventArgs(header.ID, false, null, message));
    } finally {
      this.IsReversing = false;
      this.cdr.markForCheck();
    }
  }

  // ─── loading ───────────────────────────────────────────────────────────────

  /** Header + everything else. Two round-trips for the whole entry, never one per row. */
  private async load(id: string): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const result = await this.runView().RunView<JEHeaderView>(
        { EntityName: JE_ENTITY, ExtraFilter: `ID='${id}'`, Fields: HEADER_FIELDS, ResultType: 'simple' },
        this.contextUser(),
      );
      if (!result.Success) {
        this.failLoad(id, result.ErrorMessage ?? 'This journal entry could not be loaded.');
        return;
      }
      const header = result.Results?.[0] ?? null;
      if (!header) {
        // An honest "not found" — never a blank panel.
        this.failLoad(id, 'This journal entry could not be found. It may have been deleted, or you may not have access to it.');
        return;
      }
      this._header = header;
      this.AfterHeaderLoaded.emit(header);
      await this.loadDetail(header);
    } catch (e) {
      this.failLoad(id, e instanceof Error ? e.message : String(e));
    }
  }

  /** Lines, dimensions, account identities and lineage — batched into one hop. */
  private async loadDetail(header: JEHeaderView): Promise<void> {
    this.IsLoading = true;
    this.cdr.markForCheck();
    try {
      const lineResult = await this.runView().RunView<JELineRow>(
        {
          EntityName: JE_LINE_ENTITY,
          ExtraFilter: `JournalEntryID='${header.ID}'`,
          Fields: ['ID', 'LineNumber', 'GLAccount', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description'],
          OrderBy: 'LineNumber ASC',
          ResultType: 'simple',
        },
        this.contextUser(),
      );
      const rawLines = lineResult.Success ? (lineResult.Results ?? []) : [];

      const { queries, slots } = this.buildDetailQueries(header, rawLines);
      const results = queries.length > 0 ? await this.runView().RunViews(queries, this.contextUser()) : [];

      const dimensions = slots.dims === undefined
        ? new Map<string, JELineView['Dimensions']>()
        : this.foldDimensions(results[slots.dims]?.Results ?? []);
      const accounts = slots.accounts === undefined
        ? new Map<string, GLAccountRow>()
        : this.indexAccounts(results[slots.accounts]?.Results ?? []);

      this.Lines = rawLines.map((line) => this.toLineView(line, accounts, dimensions));
      this.Lineage = {
        BatchNumber: slots.batch === undefined
          ? null
          : ((results[slots.batch]?.Results?.[0] as { BatchNumber: string } | undefined)?.BatchNumber ?? null),
        ...this.resolveReversalChain(header, slots.related === undefined ? [] : (results[slots.related]?.Results ?? [])),
      };
      this.LoadError = null;
      this.AfterLoadCompleted.emit(new AfterLoadCompletedEventArgs(header.ID, true));
    } catch (e) {
      this.failLoad(header.ID, e instanceof Error ? e.message : String(e));
      return;
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * The second round-trip's query set, with a slot index per optional query.
   *
   * Built as a list rather than a fixed tuple because three of the four are conditional — an
   * entry with no lines needs no dimension or account read, and most entries have no batch and
   * no reversal chain. Sending empty `IN ()` filters would be both wasteful and invalid SQL.
   */
  private buildDetailQueries(
    header: JEHeaderView,
    rawLines: JELineRow[],
  ): { queries: RunViewParams[]; slots: { dims?: number; accounts?: number; batch?: number; related?: number } } {
    const queries: RunViewParams[] = [];
    const slots: { dims?: number; accounts?: number; batch?: number; related?: number } = {};

    if (rawLines.length > 0) {
      slots.dims = queries.length;
      queries.push({
        EntityName: JE_LINE_DIM_ENTITY,
        ExtraFilter: this.inFilter('JournalEntryLineID', rawLines.map((l) => l.ID)),
        Fields: ['JournalEntryLineID', 'Dimension', 'DimensionValue'],
        OrderBy: 'Dimension ASC',
        ResultType: 'simple',
      });
      slots.accounts = queries.length;
      queries.push({
        EntityName: GL_ACCOUNT_ENTITY,
        ExtraFilter: this.inFilter('ID', [...new Set(rawLines.map((l) => NormalizeUUID(l.GLAccountID)))]),
        Fields: ['ID', 'Code', 'Name', 'AccountType'],
        ResultType: 'simple',
      });
    }
    if (header.BatchID) {
      slots.batch = queries.length;
      queries.push({
        EntityName: BATCH_ENTITY,
        ExtraFilter: `ID='${header.BatchID}'`,
        Fields: ['ID', 'BatchNumber'],
        ResultType: 'simple',
      });
    }
    const relatedIDs = [header.ReversedByJournalEntryID, header.ReversesJournalEntryID].filter(
      (x): x is string => !!x,
    );
    if (relatedIDs.length > 0) {
      slots.related = queries.length;
      queries.push({
        EntityName: JE_ENTITY,
        ExtraFilter: this.inFilter('ID', relatedIDs),
        Fields: ['ID', 'EntryNumber'],
        ResultType: 'simple',
      });
    }
    return { queries, slots };
  }

  private inFilter(column: string, ids: string[]): string {
    return `${column} IN (${ids.map((id) => `'${id}'`).join(',')})`;
  }

  /** Dimension tags per line. The view carries denormalized names, so there is no lookup. */
  private foldDimensions(rows: unknown[]): Map<string, JELineView['Dimensions']> {
    const byLine = new Map<string, JELineView['Dimensions']>();
    for (const row of rows as Array<{ JournalEntryLineID: string; Dimension: string; DimensionValue: string }>) {
      // NormalizeUUID for the key — SQL Server returns UUIDs uppercase (MJ UUID guide).
      const key = NormalizeUUID(row.JournalEntryLineID);
      const list = byLine.get(key) ?? [];
      list.push({ Dimension: row.Dimension, DimensionValue: row.DimensionValue });
      byLine.set(key, list);
    }
    return byLine;
  }

  private indexAccounts(rows: unknown[]): Map<string, GLAccountRow> {
    return new Map((rows as GLAccountRow[]).map((a) => [NormalizeUUID(a.ID), a]));
  }

  private toLineView(
    line: JELineRow,
    accounts: Map<string, GLAccountRow>,
    dimensions: Map<string, JELineView['Dimensions']>,
  ): JELineView {
    const account = accounts.get(NormalizeUUID(line.GLAccountID));
    return {
      ID: line.ID,
      LineNumber: line.LineNumber,
      // Degrade the LABEL, never the money: an unresolved account still shows its Dr/Cr.
      AccountCode: account?.Code ?? '—',
      AccountName: account?.Name ?? line.GLAccount ?? '(unknown account)',
      GLAccountID: line.GLAccountID ?? null,
      Debit: Number(line.DebitAmount ?? 0),
      Credit: Number(line.CreditAmount ?? 0),
      Description: line.Description,
      Dimensions: dimensions.get(NormalizeUUID(line.ID)) ?? [],
    };
  }

  /** The reversal chain, resolved to human entry numbers rather than raw ids. */
  private resolveReversalChain(
    header: JEHeaderView,
    rows: unknown[],
  ): Pick<JELineageView, 'ReversalEntryNumber' | 'ReversesEntryNumber'> {
    const byId = new Map(
      (rows as Array<{ ID: string; EntryNumber: string }>).map((r) => [NormalizeUUID(r.ID), r.EntryNumber]),
    );
    return {
      ReversalEntryNumber: header.ReversedByJournalEntryID
        ? (byId.get(NormalizeUUID(header.ReversedByJournalEntryID)) ?? null)
        : null,
      ReversesEntryNumber: header.ReversesJournalEntryID
        ? (byId.get(NormalizeUUID(header.ReversesJournalEntryID)) ?? null)
        : null,
    };
  }

  // ─── plumbing ──────────────────────────────────────────────────────────────

  /** Every read is provider-scoped. `new RunView()` would bind the global default. */
  private runView(): RunView {
    return RunView.FromMetadataProvider(this.ProviderToUse);
  }

  private contextUser() {
    return this.ProviderToUse.CurrentUser;
  }

  private setMessage(message: string, isError: boolean): void {
    this.ActionMessage = message;
    this.ActionIsError = isError;
    this.cdr.markForCheck();
  }

  private failLoad(id: string | null, message: string): void {
    this.LoadError = message;
    this.Lines = [];
    this.IsLoading = false;
    this.cdr.markForCheck();
    this.AfterLoadCompleted.emit(new AfterLoadCompletedEventArgs(id, false, message));
  }

  private reset(): void {
    this._header = null;
    this.AfterHeaderLoaded.emit(null);
    this.Lines = [];
    this.Lineage = { BatchNumber: null, ReversalEntryNumber: null, ReversesEntryNumber: null };
    this.ActionMessage = null;
    this.LoadError = null;
    this.cdr.markForCheck();
  }
}
