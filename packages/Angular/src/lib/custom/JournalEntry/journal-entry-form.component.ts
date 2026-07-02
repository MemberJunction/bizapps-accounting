import { Component } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import {
  mjBizAppsAccountingJournalEntryEntity,
  mjBizAppsAccountingJournalEntryLineEntity,
  mjBizAppsAccountingJournalEntryLineDimensionEntity,
} from '@mj-biz-apps/accounting-entities';
import { mjBizAppsAccountingJournalEntryFormComponent } from '../../generated/Entities/mjBizAppsAccountingJournalEntry/mjbizappsaccountingjournalentry.form.component';
import { JournalEntryClient } from './journal-entry.client';

const JEL_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Lines';
const JELD_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Line Dimensions';

/** One JE line with its display values + resolved dimension chips. */
interface LineRow {
  ID: string;
  LineNumber: number;
  GLAccount: string;
  DebitAmount: number | null;
  CreditAmount: number | null;
  Description: string | null;
  CounterpartyOrganization: string | null;
  /** "Dimension: Value" chips for this line's analytical tags. */
  Dimensions: { Dimension: string; DimensionValue: string }[];
}

/** One step in the JE status timeline. */
interface TimelineStep {
  Key: 'Pending' | 'Batched' | 'GLPosted';
  Label: string;
  Icon: string;
  /** done = the JE has reached at least this step; current = it is exactly here. */
  Done: boolean;
  Current: boolean;
}

const STATUS_ORDER: Record<'Pending' | 'Batched' | 'GLPosted', number> = { Pending: 0, Batched: 1, GLPosted: 2 };

/**
 * Journal Entry — custom detail form. Extends the generated form (so it wins @RegisterClass
 * priority) and adds, alongside the generated field panels:
 *   - a status timeline (Pending → Batched → GLPosted),
 *   - the JE lines with per-line dimension chips,
 *   - a "Generate Reversal" affordance shown ONLY when the JE is GLPosted (W6: a new Pending JE,
 *     Dr/Cr swapped, via the JournalEntryResolver → JournalEntryEntityServer.generateReversal).
 */
@RegisterClass(BaseFormComponent, 'MJ_BizApps_Accounting: Journal Entries')
@Component({
  standalone: false,
  selector: 'mj-journal-entry-form',
  templateUrl: './journal-entry-form.component.html',
  styleUrls: ['./journal-entry-form.component.css'],
})
export class JournalEntryFormComponentExtended extends mjBizAppsAccountingJournalEntryFormComponent {
  public declare record: mjBizAppsAccountingJournalEntryEntity;

  public Lines: LineRow[] = [];
  public LinesLoading = false;
  public LinesError: string | null = null;

  // Reversal affordance state.
  public ShowReversalForm = false;
  public ReversalReason = '';
  public ReversalBusy = false;
  public ReversalMessage: string | null = null;
  public ReversalMessageIsError = false;

  override async ngOnInit(): Promise<void> {
    await super.ngOnInit();
    await this.loadLines();
  }

  // ─── status timeline ─────────────────────────────────────────────────────

  public get Timeline(): TimelineStep[] {
    const status = this.record?.Status ?? 'Pending';
    const reached = STATUS_ORDER[status] ?? 0;
    return [
      { Key: 'Pending', Label: 'Pending', Icon: 'fa-solid fa-pen', Done: reached >= 0, Current: status === 'Pending' },
      { Key: 'Batched', Label: 'Batched', Icon: 'fa-solid fa-layer-group', Done: reached >= 1, Current: status === 'Batched' },
      { Key: 'GLPosted', Label: 'GL Posted', Icon: 'fa-solid fa-circle-check', Done: reached >= 2, Current: status === 'GLPosted' },
    ];
  }

  // ─── reversal affordance ───────────────────────────────────────────────────

  /** The Generate Reversal affordance shows ONLY for a GLPosted JE that hasn't already been reversed. */
  public get CanReverse(): boolean {
    return this.record?.Status === 'GLPosted' && !this.record?.ReversedByJournalEntryID;
  }

  public OpenReversalForm(): void {
    this.ShowReversalForm = true;
    this.ReversalMessage = null;
    this.cdr.markForCheck();
  }

  public CancelReversal(): void {
    this.ShowReversalForm = false;
    this.ReversalReason = '';
    this.cdr.markForCheck();
  }

  public async ConfirmReversal(): Promise<void> {
    if (this.ReversalBusy || !this.record?.ID) return;
    this.ReversalBusy = true;
    this.ReversalMessage = null;
    this.cdr.markForCheck();
    try {
      const client = new JournalEntryClient(this.ProviderToUse as GraphQLDataProvider);
      const res = await client.GenerateReversal(this.record.ID, this.ReversalReason || 'Reversal requested from Explorer.');
      if (res.Success) {
        this.ReversalMessage = `Created reversal ${res.ReversalEntryNumber ?? ''}. Reload to see the back-reference.`;
        this.ReversalMessageIsError = false;
        this.ShowReversalForm = false;
        this.ReversalReason = '';
      } else {
        this.ReversalMessage = res.ErrorMessage ?? 'Failed to generate reversal.';
        this.ReversalMessageIsError = true;
      }
    } finally {
      this.ReversalBusy = false;
      this.cdr.markForCheck();
    }
  }

  // ─── lines + dimensions ──────────────────────────────────────────────────

  public get TotalDebits(): number {
    return this.Lines.reduce((s, l) => s + (l.DebitAmount ?? 0), 0);
  }

  public get TotalCredits(): number {
    return this.Lines.reduce((s, l) => s + (l.CreditAmount ?? 0), 0);
  }

  private async loadLines(): Promise<void> {
    if (!this.record?.ID) { this.Lines = []; return; }
    this.LinesLoading = true;
    this.LinesError = null;
    this.cdr.markForCheck();
    try {
      const rv = RunView.FromMetadataProvider(this.ProviderToUse);
      const user = this.ProviderToUse.CurrentUser;

      const lineRes = await rv.RunView<mjBizAppsAccountingJournalEntryLineEntity>(
        { EntityName: JEL_ENTITY, ExtraFilter: `JournalEntryID='${this.record.ID}'`, OrderBy: 'LineNumber ASC', ResultType: 'simple' },
        user,
      );
      if (!lineRes.Success) { this.LinesError = lineRes.ErrorMessage ?? 'Failed to load lines.'; this.Lines = []; return; }
      const lines = lineRes.Results ?? [];
      if (lines.length === 0) { this.Lines = []; return; }

      // Load all dimension tags for these lines in ONE query, then group client-side.
      const lineIds = lines.map(l => `'${l.ID}'`).join(',');
      const dimRes = await rv.RunView<mjBizAppsAccountingJournalEntryLineDimensionEntity>(
        { EntityName: JELD_ENTITY, ExtraFilter: `JournalEntryLineID IN (${lineIds})`, ResultType: 'simple' },
        user,
      );
      const dimsByLine = new Map<string, { Dimension: string; DimensionValue: string }[]>();
      if (dimRes.Success) {
        for (const d of dimRes.Results ?? []) {
          const arr = dimsByLine.get(d.JournalEntryLineID) ?? [];
          arr.push({ Dimension: d.Dimension, DimensionValue: d.DimensionValue });
          dimsByLine.set(d.JournalEntryLineID, arr);
        }
      }

      this.Lines = lines.map(l => ({
        ID: l.ID,
        LineNumber: l.LineNumber,
        GLAccount: l.GLAccount,
        DebitAmount: l.DebitAmount,
        CreditAmount: l.CreditAmount,
        Description: l.Description,
        CounterpartyOrganization: l.CounterpartyOrganization,
        Dimensions: dimsByLine.get(l.ID) ?? [],
      }));
    } catch (e) {
      this.LinesError = e instanceof Error ? e.message : String(e);
      this.Lines = [];
    } finally {
      this.LinesLoading = false;
      this.cdr.markForCheck();
    }
  }
}

/** Tree-shaking prevention — called from custom-forms.module.ts's load function. */
export function LoadJournalEntryFormComponentExtended(): void {
  // No-op.
}
