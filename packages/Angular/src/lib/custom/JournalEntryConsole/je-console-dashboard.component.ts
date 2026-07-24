import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { BaseDashboard } from '@memberjunction/ng-shared';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, Metadata, RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { ResourceData } from '@memberjunction/core-entities';
import { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { JournalEntryConsoleClient } from './je-console.client';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';
const JE_LINE_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';

/** Status + type unions, derived from the generated entity (rule 2c). */
type JEStatus = mjBizAppsAccountingJournalEntryEntity['Status'];
type JEType = mjBizAppsAccountingJournalEntryEntity['EntryType'];

/** Ledger status lifecycle — the filter chips. */
const STATUSES: JEStatus[] = ['Pending', 'Batched', 'GLPosted'];

interface JERow {
  ID: string;
  EntryNumber: string;
  EntryType: JEType;
  Status: JEStatus;
  EffectiveDate: Date | null;
  Description: string | null;
  /** Polymorphic origin pair (plan D25) — the JE's single causal source record, or null = manual. */
  LinkedEntityID: string | null;
  LinkedRecordID: string | null;
  BatchID: string | null;
  ReversedByJournalEntryID: string | null;
  ReversesJournalEntryID: string | null;
  TotalDebits: number;
  TotalCredits: number;
  LineCount: number;
}

interface JELineRow {
  LineNumber: number;
  Account: string;
  Debit: number;
  Credit: number;
  Description: string | null;
}

/**
 * Journal Entries Console — the ledger review surface. Filterable list of journal entries with
 * status chips (Pending → Batched → GLPosted), entry-type filter, and search; expand any entry to
 * its balanced Dr/Cr lines; drill through to the source Order that booked it; and generate a
 * balanced reversing entry (W6) for an entry that has not already been reversed.
 *
 * Reads are client-side (RunView). The reversal calls the GenerateJournalEntryReversal mutation via
 * JournalEntryConsoleClient; the drill-through emits the BaseDashboard OpenEntityRecord output.
 */
@Component({
  standalone: false,
  selector: 'mj-je-console-dashboard',
  templateUrl: './je-console-dashboard.component.html',
  styleUrls: ['./je-console-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@RegisterClass(BaseDashboard, 'JournalEntryConsoleDashboard')
export class JournalEntryConsoleDashboardComponent extends BaseDashboard {
  private cdr = inject(ChangeDetectorRef);
  private forms = inject(MJFormPresenterService);

  public readonly Statuses: readonly JEStatus[] = STATUSES;

  public IsBusy = false;
  public LoadError: string | null = null;

  public AllEntries: JERow[] = [];

  // ─── filters ───────────────────────────────────────────────────────────────
  public StatusFilter: JEStatus | 'All' = 'All';
  public TypeFilter = 'All';
  public Search = '';

  // ─── expanded entry + its lines ──────────────────────────────────────────────
  public ExpandedID: string | null = null;
  public ExpandedLines: JELineRow[] = [];
  public LinesLoading = false;

  // ─── reversal ────────────────────────────────────────────────────────────────
  public ReversingID: string | null = null;
  public ActionMessage: string | null = null;
  public ActionIsError = false;

  async GetResourceDisplayName(_data: ResourceData): Promise<string> {
    return 'Journal Entries';
  }

  protected initDashboard(): void {
    // One-time setup; data loads in loadData().
  }

  protected async loadData(): Promise<void> {
    this.IsBusy = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      await this.loadEntries();
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsBusy = false;
      this.cdr.markForCheck();
    }
  }

  private async loadEntries(): Promise<void> {
    const rv = new RunView();
    const res = await rv.RunView<{
      ID: string; EntryNumber: string; EntryType: JEType; Status: JEStatus;
      EffectiveDate: Date | null; Description: string | null;
      LinkedEntityID: string | null; LinkedRecordID: string | null;
      BatchID: string | null; ReversedByJournalEntryID: string | null; ReversesJournalEntryID: string | null;
    }>({
      EntityName: JE_ENTITY,
      Fields: ['ID', 'EntryNumber', 'EntryType', 'Status', 'EffectiveDate', 'Description', 'LinkedEntityID', 'LinkedRecordID', 'BatchID', 'ReversedByJournalEntryID', 'ReversesJournalEntryID'],
      OrderBy: '__mj_CreatedAt DESC',
      MaxRows: 200,
      ResultType: 'simple',
    });
    const rows = res.Results ?? [];
    const totals = await this.loadLineTotals(rows.map(r => r.ID));
    this.AllEntries = rows.map(r => ({
      ...r,
      TotalDebits: totals.get(r.ID.toUpperCase())?.dr ?? 0,
      TotalCredits: totals.get(r.ID.toUpperCase())?.cr ?? 0,
      LineCount: totals.get(r.ID.toUpperCase())?.count ?? 0,
    }));
  }

  /** One batched read of all lines for the listed entries → per-entry Dr/Cr totals + line count. */
  private async loadLineTotals(jeIds: string[]): Promise<Map<string, { dr: number; cr: number; count: number }>> {
    const totals = new Map<string, { dr: number; cr: number; count: number }>();
    if (jeIds.length === 0) return totals;
    const inList = jeIds.map(id => `'${id}'`).join(',');
    const rv = new RunView();
    const res = await rv.RunView<{ JournalEntryID: string; DebitAmount: number | null; CreditAmount: number | null }>({
      EntityName: JE_LINE_ENTITY,
      ExtraFilter: `JournalEntryID IN (${inList})`,
      Fields: ['JournalEntryID', 'DebitAmount', 'CreditAmount'],
      ResultType: 'simple',
    });
    for (const l of res.Results ?? []) {
      const key = l.JournalEntryID.toUpperCase();
      const cur = totals.get(key) ?? { dr: 0, cr: 0, count: 0 };
      cur.dr += Number(l.DebitAmount ?? 0);
      cur.cr += Number(l.CreditAmount ?? 0);
      cur.count += 1;
      totals.set(key, cur);
    }
    return totals;
  }

  // ─── filtered views ──────────────────────────────────────────────────────────

  public get TypeOptions(): string[] {
    return Array.from(new Set(this.AllEntries.map(e => e.EntryType))).sort();
  }

  public get FilteredEntries(): JERow[] {
    const q = this.Search.trim().toLowerCase();
    return this.AllEntries.filter(e => {
      if (this.StatusFilter !== 'All' && e.Status !== this.StatusFilter) return false;
      if (this.TypeFilter !== 'All' && e.EntryType !== this.TypeFilter) return false;
      if (q && !this.matchesSearch(e, q)) return false;
      return true;
    });
  }

  private matchesSearch(e: JERow, q: string): boolean {
    return e.EntryNumber.toLowerCase().includes(q)
      || (e.Description?.toLowerCase().includes(q) ?? false);
  }

  public get PendingCount(): number { return this.AllEntries.filter(e => e.Status === 'Pending').length; }
  public get BatchedCount(): number { return this.AllEntries.filter(e => e.Status === 'Batched').length; }
  public get PostedCount(): number { return this.AllEntries.filter(e => e.Status === 'GLPosted').length; }

  public SetStatusFilter(status: JEStatus | 'All'): void {
    this.StatusFilter = status;
    this.cdr.markForCheck();
  }

  // ─── expand / lines ──────────────────────────────────────────────────────────

  public async ToggleExpand(row: JERow): Promise<void> {
    if (this.ExpandedID === row.ID) {
      this.ExpandedID = null;
      this.ExpandedLines = [];
      this.cdr.markForCheck();
      return;
    }
    this.ExpandedID = row.ID;
    this.ExpandedLines = [];
    this.LinesLoading = true;
    this.cdr.markForCheck();
    try {
      const rv = new RunView();
      const res = await rv.RunView<{ LineNumber: number; GLAccount: string | null; GLAccountID: string; DebitAmount: number | null; CreditAmount: number | null; Description: string | null }>({
        EntityName: JE_LINE_ENTITY,
        ExtraFilter: `JournalEntryID='${row.ID}'`,
        Fields: ['LineNumber', 'GLAccount', 'GLAccountID', 'DebitAmount', 'CreditAmount', 'Description'],
        OrderBy: 'LineNumber ASC',
        ResultType: 'simple',
      });
      this.ExpandedLines = (res.Results ?? []).map(l => ({
        LineNumber: l.LineNumber,
        Account: l.GLAccount ?? l.GLAccountID,
        Debit: Number(l.DebitAmount ?? 0),
        Credit: Number(l.CreditAmount ?? 0),
        Description: l.Description,
      }));
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.LinesLoading = false;
      this.cdr.markForCheck();
    }
  }

  // ─── actions ──────────────────────────────────────────────────────────────────

  /** Open the JE's origin record — generic over the D25 pair (LinkedEntityID resolves the entity). */
  public OpenOrigin(row: JERow): void {
    if (!row.LinkedEntityID || !row.LinkedRecordID) return;
    const md = new Metadata();
    const target = row.LinkedEntityID.toLowerCase();
    const entity = md.Entities.find(e => e.ID.toLowerCase() === target);
    if (!entity) return;
    this.forms.Open({ EntityName: entity.Name, PrimaryKey: CompositeKey.FromID(row.LinkedRecordID), Presentation: 'dialog', Width: '94vw' });
  }

  public CanReverse(row: JERow): boolean {
    return !row.ReversedByJournalEntryID && this.ReversingID !== row.ID;
  }

  public async ReverseEntry(row: JERow): Promise<void> {
    if (!this.CanReverse(row)) return;
    this.ReversingID = row.ID;
    this.ActionMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new JournalEntryConsoleClient(this.ProviderToUse as GraphQLDataProvider);
      const res = await client.GenerateReversal(row.ID, `Reversal of ${row.EntryNumber} from Journal Entries Console`);
      if (res.Success) {
        this.ActionMessage = `Reversed ${row.EntryNumber} → new entry ${res.ReversalEntryNumber ?? '(pending)'}.`;
        this.ActionIsError = false;
        await this.loadEntries();
      } else {
        this.setError(res.ErrorMessage ?? 'Reversal failed.');
      }
    } catch (e) {
      this.setError(e instanceof Error ? e.message : String(e));
    } finally {
      this.ReversingID = null;
      this.cdr.markForCheck();
    }
  }

  private setError(message: string): void {
    this.ActionMessage = message;
    this.ActionIsError = true;
    this.cdr.markForCheck();
  }

  // ─── presentation helpers ────────────────────────────────────────────────────

  public StatusVariant(status: JEStatus): string {
    switch (status) {
      case 'GLPosted': return 'success';
      case 'Batched': return 'info';
      default: return 'warning';
    }
  }

  public IsBalanced(row: JERow): boolean {
    return Math.abs(row.TotalDebits - row.TotalCredits) < 0.005;
  }
}
