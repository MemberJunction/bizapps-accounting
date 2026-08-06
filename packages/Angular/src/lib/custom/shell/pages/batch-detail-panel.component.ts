import { Component, ChangeDetectionStrategy, ChangeDetectorRef, Input, Output, EventEmitter, inject } from '@angular/core';
import { RunView, CompositeKey } from '@memberjunction/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { MJStatBadgeVariant } from '@memberjunction/ng-ui-components';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { mjBizAppsAccountingJournalEntryBatchEntityType } from '@mj-biz-apps/accounting-entities';
import { openBizDetail } from '../../shared/biz-detail-form';

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/** Status union derived from the generated entity (MJ CLAUDE.md rule 2c — never hand-copied). */
type BatchStatus = NonNullable<mjBizAppsAccountingJournalEntryBatchEntityType['Status']>;

/** The batch header this panel shows — every field a real column/view field on the batch view. */
export interface BatchDetailHeader {
  ID: string;
  JournalEntryBatchNumber: string;
  Status: BatchStatus;
  TargetSystem: string;
  PostingDate: Date | null;
  TotalEntries: number;
  TotalDebits: number;
  TotalCredits: number;
  CompanyID: string;
  /** Denormalized company name carried by the batch view. */
  Company: string;
  ExternalJournalEntryBatchRef: string | null;
  ApprovedAt: Date | null;
  SentAt: Date | null;
  PostedAt: Date | null;
  ErrorMessage: string | null;
  ApprovalTaskID: string | null;
  ApprovalTaskRaisedAt: Date | null;
  SummaryJournalEntryID: string | null;
  __mj_CreatedAt: Date;
}

/** One member entry, as the batch's member list shows it. */
interface BatchMemberRow {
  ID: string;
  EntryNumber: string;
  EntryType: string;
  Status: string;
  EffectiveDate: Date | null;
  Description: string | null;
}

/**
 * Batch detail slide-in — the batches twin of the JE detail panel (element doctrine:
 * slide-in = quick VIEW; it carries "Open in workspace" + the pop-out, both of which CLOSE this
 * panel as they hand the screen over).
 *
 * What a reviewer needs on the first click: the batch's identity (number, status, target system,
 * posting date, company), its money (entry count + netted Dr/Cr totals), its dispatch trail
 * (approved → sent → posted timestamps, the ERP reference, the failure message when Failed), the
 * approval-task state (MOD-14: a built batch with NO task is the detectable, retryable gap), and
 * its member entries.
 */
@Component({
  standalone: false,
  selector: 'mj-batch-detail-panel',
  templateUrl: './batch-detail-panel.component.html',
  styleUrls: ['./batch-detail-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BatchDetailPanelComponent extends BaseAngularComponent {
  private cdr = inject(ChangeDetectorRef);
  private forms = inject(MJFormPresenterService);

  /** The batch to show. Setter-driven so the load fires exactly when the id changes. */
  @Input()
  set JournalEntryBatchID(value: string | null) {
    const previous = this._batchID;
    this._batchID = value;
    if (value && value !== previous) void this.load(value);
    if (!value) this.reset();
  }
  get JournalEntryBatchID(): string | null {
    return this._batchID;
  }
  private _batchID: string | null = null;

  @Output() Closed = new EventEmitter<void>();
  /** "Open in workspace" — carries the batch ID; the host routes it via GoToPage('workspace', id). */
  @Output() OpenInWorkspace = new EventEmitter<string>();

  public Header: BatchDetailHeader | null = null;
  public Members: BatchMemberRow[] = [];
  /** TRUE member total — the honest header count, not just the rows fetched. */
  public MemberCount = 0;

  public IsLoading = false;
  public LoadError: string | null = null;

  /** How many member rows the panel fetches; the count states the real total regardless. */
  private static readonly MEMBER_ROWS = 50;

  public get Visible(): boolean {
    return !!this._batchID;
  }

  public get Title(): string {
    return this.Header ? `Batch ${this.Header.JournalEntryBatchNumber}` : 'Batch';
  }

  /** Typed as the badge's own union — strictTemplates rejects the widened `string`. */
  public get StatusVariant(): MJStatBadgeVariant {
    switch (this.Header?.Status) {
      case 'Posted':
        return 'success';
      case 'Failed':
        return 'error';
      case 'Pending':
        return 'warning';
      case 'Approved':
      case 'Sent':
        return 'info';
      default:
        return 'default';
    }
  }

  /** MOD-14: Pending with no approval task = valid batch, nobody will ever be asked to approve it. */
  public get MissingApprovalTask(): boolean {
    return this.Header?.Status === 'Pending' && !this.Header.ApprovalTaskID;
  }

  public get MembersTruncated(): boolean {
    return this.MemberCount > this.Members.length;
  }

  public Close(): void {
    this.Closed.emit();
  }

  /** Same close-as-you-leave rule as the JE panel: the workspace is the destination. */
  public GoToWorkspace(): void {
    if (!this.Header) return;
    const id = this.Header.ID;
    this.Closed.emit();
    this.OpenInWorkspace.emit(id);
  }

  /** Pop-out (↗) to the batch's full-depth home — required on every slide-in; closes this panel. */
  public PopOut(): void {
    if (!this.Header) return;
    openBizDetail(this.forms, {
      entityName: BATCH_ENTITY,
      primaryKey: CompositeKey.FromID(this.Header.ID),
      title: `Batch ${this.Header.JournalEntryBatchNumber}`,
      mode: 'dialog',
    });
    this.Closed.emit();
  }

  private reset(): void {
    this.Header = null;
    this.Members = [];
    this.MemberCount = 0;
    this.LoadError = null;
  }

  /** ONE batched round-trip: the header and the member list are independent, keyed on the same id. */
  private async load(id: string): Promise<void> {
    this.IsLoading = true;
    this.LoadError = null;
    this.cdr.markForCheck();
    try {
      const rv = RunView.FromMetadataProvider(this.ProviderToUse);
      const [headerRes, memberRes] = await rv.RunViews(
        [
          {
            EntityName: BATCH_ENTITY,
            ExtraFilter: `ID='${id}'`,
            Fields: [
              'ID', 'JournalEntryBatchNumber', 'Status', 'TargetSystem', 'PostingDate', 'TotalEntries',
              'TotalDebits', 'TotalCredits', 'CompanyID', 'Company', 'ExternalJournalEntryBatchRef',
              'ApprovedAt', 'SentAt', 'PostedAt', 'ErrorMessage', 'ApprovalTaskID',
              'ApprovalTaskRaisedAt', 'SummaryJournalEntryID', '__mj_CreatedAt',
            ],
            ResultType: 'simple',
          },
          {
            EntityName: JE_ENTITY,
            ExtraFilter: `JournalEntryBatchID='${id}'`,
            Fields: ['ID', 'EntryNumber', 'EntryType', 'Status', 'EffectiveDate', 'Description'],
            OrderBy: 'EntryNumber ASC',
            MaxRows: BatchDetailPanelComponent.MEMBER_ROWS,
            ResultType: 'simple',
          },
        ],
        this.ProviderToUse.CurrentUser,
      );

      if (!headerRes.Success) {
        this.LoadError = headerRes.ErrorMessage ?? 'This batch could not be loaded.';
        return;
      }
      const header = (headerRes.Results?.[0] ?? null) as BatchDetailHeader | null;
      if (!header) {
        this.LoadError = 'This batch could not be found. It may have been deleted, or you may not have access to it.';
        return;
      }
      this.Header = header;
      this.Members = memberRes.Success ? ((memberRes.Results ?? []) as BatchMemberRow[]) : [];
      this.MemberCount = memberRes.Success ? (memberRes.TotalRowCount ?? this.Members.length) : this.Members.length;
    } catch (e) {
      this.LoadError = e instanceof Error ? e.message : String(e);
    } finally {
      this.IsLoading = false;
      this.cdr.markForCheck();
    }
  }
}
