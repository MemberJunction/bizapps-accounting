import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompositeKey, Metadata, RunView } from '@memberjunction/core';
import { UserCanOperateJournalEntryBatches } from '@mj-biz-apps/accounting-engine-base';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { NavigationService } from '@memberjunction/ng-shared';
import { MJButtonDirective, MJDialogComponent, MJDialogActionsComponent, MJDropdownComponent } from '@memberjunction/ng-ui-components';
import { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';
import { BusinessTimeZoneEngine, IsCalendarDay } from '@mj-biz-apps/common-entities';
import { calendarDaySpan, formatJournalDate } from '../form-panels/journal-entry-panel.helpers';
import { ClosedBooksProblem, PostingDateMonthWarning, PostingMonthLabel } from '../shared/posting-date-warning';
import {
    ALL_ENTRIES,
    NO_ENTRIES,
    IncludedCandidateIds,
    IsEntryIncluded,
    SelectionRequestIds,
    ToggleEntrySelection,
    type EntrySelection,
} from '../shared/entry-selection';
import {
    JournalEntryBatchDispatchClient,
    PreviewEntryWire,
    BuildJournalEntryBatchOptionsInput,
} from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';
import { BatchAction, BatchActionDialogState } from '../JournalEntryBatchDispatch/batch-action-dialog/batch-action-dialog.state';
import { BatchActionDialogComponent } from '../JournalEntryBatchDispatch/batch-action-dialog/batch-action-dialog.component';
import { RetryConfirmState } from '../JournalEntryBatchDispatch/retry-confirm-dialog/retry-confirm-dialog.state';
import { RetryConfirmDialogComponent } from '../JournalEntryBatchDispatch/retry-confirm-dialog/retry-confirm-dialog.component';
import { CompanyApprovers, IsErpAcceptedFailedBatch, LoadCompanyApprovers, MayArchiveBatch, MayCancelApprovedBatch, MayCancelPendingBatch, MayDecideBatch } from '../JournalEntryBatchDispatch/batch-action-permission';

/**
 * The batch fields this page reads, PICKED from the generated entity class rather than
 * re-declared (a hand-written interface mirroring an entity is an
 * MJ anti-pattern). The compiler now checks every field name and type against the schema,
 * so `Status` carries the real CHECK-constraint union — widening it is a CodeGen concern,
 * never a hand edit here.
 *
 * Picked from the CLASS, not the Zod-inferred `...EntityType`: this package declares no zod
 * dependency of its own and resolves a different zod than @mj-biz-apps/accounting-entities
 * does, so `z.infer` degrades every field to `T | undefined` across the package boundary.
 * The class's declared property types are immune to that skew.
 */
export type BatchItem = Pick<
    mjBizAppsAccountingJournalEntryBatchEntity,
    | 'ID'
    | 'JournalEntryBatchNumber'
    | 'Status'
    | 'TargetSystem'
    | 'PostingDate'
    | 'BatchedAt'
    | 'TotalEntries'
    | 'TotalDebits'
    | 'TotalCredits'
    | 'Company'
    | 'ExternalJournalEntryBatchRef'
    | 'ArchiveReason'
    | 'CancelReason'
    | 'CompanyID'
    | 'BatchedByUserID'
    | 'ApprovedByUserID'
>;

interface StageCount {
    Status: string;
    Count: number;
    Color: string;
    Icon: string;
}

const BATCH_ENTITY = 'MJ_BizApps_Accounting: Journal Entry Batches';
const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

/**
 * Journal Entry Batches Workspace.
 *
 * Provides a dedicated phase & stage control center for ERP posting batches,
 * stage filtering, target system filtering, and batch creation.
 */
@Component({
    selector: 'mj-accounting-batches-page',
    standalone: true,
    imports: [CommonModule, FormsModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent, MJDropdownComponent, BatchActionDialogComponent, RetryConfirmDialogComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="mja-batches-layout">
            <!-- Notification Banner -->
            @if (ActionMessage) {
                <div class="mja-banner" [class.mja-banner--error]="ActionMessageIsError" [class.mja-banner--success]="!ActionMessageIsError" role="status">
                    <i class="fa-solid" [class.fa-circle-check]="!ActionMessageIsError" [class.fa-triangle-exclamation]="ActionMessageIsError"></i>
                    <span>{{ ActionMessage }}</span>
                    <button type="button" class="mja-banner-close" (click)="ActionMessage = null" aria-label="Dismiss">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            }

            <!-- Header Toolbar -->
            <header class="mja-head-card">
                <div class="mja-head-top">
                    <div class="mja-identity">
                        <div class="mja-avatar">
                            <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                        </div>
                        <div class="mja-titles">
                            <h1 class="mja-title">Journal Entry Batches</h1>
                            <p class="mja-sub">Review and manage ERP posting batches, inspect consolidated GL movements, and dispatch to target systems.</p>
                        </div>
                    </div>

                    <div class="mja-actions">
                        @if (MayOperateBatches) {
                            <button mjButton variant="primary" size="sm" type="button" (click)="OpenBuildBatchModal()">
                                <i class="fa-solid fa-plus"></i> Build Batch
                            </button>
                        }
                    </div>
                </div>

                <!-- Phase / Stage Tabs -->
                <div class="mja-stage-tabs">
                    <button
                        type="button"
                        class="mja-stage-tab"
                        [class.mja-stage-tab--active]="SelectedStage === 'All'"
                        (click)="SetStage('All')">
                        <span>All Batches</span>
                        <span class="mja-tab-count">{{ Batches.length }}</span>
                    </button>
                    @for (stage of Stages; track stage.Status) {
                        <button
                            type="button"
                            class="mja-stage-tab"
                            [class.mja-stage-tab--active]="SelectedStage === stage.Status"
                            (click)="SetStage(stage.Status)">
                            <i [class]="stage.Icon" [style.color]="stage.Color"></i>
                            <span>{{ stage.Status }}</span>
                            <span class="mja-tab-count" [class.mja-count--highlight]="stage.Count > 0">{{ stage.Count }}</span>
                        </button>
                    }
                </div>

                <!-- Filter Controls Bar -->
                <div class="mja-filter-bar">
                    <div class="mja-search-box">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input
                            type="text"
                            class="mja-search-input"
                            placeholder="Search by batch № or reference…"
                            [(ngModel)]="SearchTerm"
                            (ngModelChange)="OnFilterChange()" />
                    </div>

                    <div class="mja-filter-group">
                        <label class="mja-filter-label">
                            <span>Target ERP</span>
                            <select class="mja-select" [(ngModel)]="SelectedTarget" (ngModelChange)="OnFilterChange()">
                                <option value="">All Systems</option>
                                <option value="QuickBooks">QuickBooks</option>
                                <option value="NetSuite">NetSuite</option>
                                <option value="BusinessCentral">Business Central</option>
                                <option value="Sage">Sage</option>
                                <option value="Xero">Xero</option>
                                <option value="Other">Other</option>
                            </select>
                        </label>

                        <button mjButton variant="flat" size="sm" type="button" (click)="ResetFilters()" title="Reset all filters">
                            <i class="fa-solid fa-rotate-left"></i> Reset
                        </button>
                    </div>
                </div>
            </header>

            <!-- Main Content Area -->
            <main class="mja-body-card">
                @if (IsLoading) {
                    <div class="mja-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <span>Loading batch lifecycle data…</span>
                    </div>
                } @else if (FilteredBatches.length === 0) {
                    <div class="mja-empty-hero">
                        <div class="mja-empty-icon">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        <h3 class="mja-empty-title">
                            @if (Batches.length === 0) {
                                No Batches Created Yet
                            } @else {
                                No Batches Match Selected Filters
                            }
                        </h3>
                        <p class="mja-empty-desc">
                            @if (Batches.length === 0) {
                                There are currently <strong>{{ PendingJECount }} Pending Journal Entries</strong> in the subledger ready to be consolidated and dispatched.
                            } @else {
                                Try adjusting your phase or search filters to view other batches in flight.
                            }
                        </p>
                        @if (MayOperateBatches) {
                            <div class="mja-empty-actions">
                                <button mjButton variant="primary" size="md" type="button" (click)="OpenBuildBatchModal()">
                                    <i class="fa-solid fa-plus"></i> Build First Batch
                                </button>
                            </div>
                        }
                    </div>
                } @else {
                    <div class="mja-table-wrap">
                        <table class="mja-table">
                            <thead>
                                <tr>
                                    <th>Batch №</th>
                                    <th>Target System</th>
                                    <th>Posting Date</th>
                                    <th>Company</th>
                                    <th>Phase / Status</th>
                                    <th class="mja-th-right">Entries</th>
                                    <th class="mja-th-right">Total Volume</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (batch of FilteredBatches; track batch.ID) {
                                    <tr (click)="OpenBatchRecord(batch.ID)">
                                        <td>
                                            <strong class="mja-batch-num">{{ batch.JournalEntryBatchNumber }}</strong>
                                        </td>
                                        <td>
                                            <span class="mja-target-badge">
                                                <i class="fa-solid fa-server"></i> {{ batch.TargetSystem }}
                                            </span>
                                        </td>
                                        <td>{{ batch.PostingDate | date:'mediumDate':'UTC' }}</td>
                                        <td>{{ batch.Company || '—' }}</td>
                                        <td>
                                            <span class="mja-status-pill" [attr.data-status]="batch.Status">
                                                {{ batch.Status }}
                                            </span>
                                            @if (batch.Status === 'Archived' && batch.ArchiveReason) {
                                                <span class="mja-archive-reason" [title]="batch.ArchiveReason">{{ batch.ArchiveReason }}</span>
                                            }
                                            @if (batch.Status === 'Cancelled' && batch.CancelReason) {
                                                <span class="mja-archive-reason" [title]="batch.CancelReason">{{ batch.CancelReason }}</span>
                                            }
                                        </td>
                                        <td class="mja-td-right">{{ batch.TotalEntries }}</td>
                                        <td class="mja-td-right">
                                            <strong>{{ batch.TotalDebits | currency }}</strong>
                                        </td>
                                        <td class="mja-td-action">
                                            <div class="mja-row-actions">
                                                <!-- Confirm/affirmative LEFT, then secondary, per the MJ button convention. -->
                                                @if (CanDispatch(batch)) {
                                                    <button mjButton variant="primary" size="sm" type="button"
                                                            [disabled]="DispatchingBatchID === batch.ID"
                                                            [title]="'Send this approved batch to ' + batch.TargetSystem + '.'"
                                                            (click)="OnDispatch(batch, $event)">
                                                        <i class="fa-solid fa-paper-plane"></i> Dispatch
                                                    </button>
                                                }
                                                @if (CanRetry(batch)) {
                                                    <button mjButton variant="primary" size="sm" type="button"
                                                            [disabled]="DispatchingBatchID === batch.ID"
                                                            [title]="'Send this batch to ' + batch.TargetSystem + ' again. The ERP is checked first, so a batch it already holds is not posted twice.'"
                                                            (click)="OnDispatch(batch, $event)">
                                                        <i class="fa-solid fa-rotate-right"></i> Retry
                                                    </button>
                                                }
                                                @if (CanDecide(batch)) {
                                                    <button mjButton variant="success" size="sm" type="button"
                                                            [disabled]="DecidingBatchID === batch.ID"
                                                            title="Approve this batch so it can be dispatched to the ERP."
                                                            (click)="OnApprove(batch, $event)">
                                                        <i class="fa-solid fa-thumbs-up"></i> Approve
                                                    </button>
                                                    <button mjButton variant="danger" size="sm" type="button"
                                                            [disabled]="DecidingBatchID === batch.ID"
                                                            title="Reject this batch. It is cancelled and its journal entries return to the next build."
                                                            (click)="OnReject(batch, $event)">
                                                        <i class="fa-solid fa-thumbs-down"></i> Reject
                                                    </button>
                                                }
                                                @if (CanArchive(batch)) {
                                                    <button mjButton variant="secondary" size="sm" type="button"
                                                            [disabled]="ArchivingBatchID === batch.ID"
                                                            title="Close this batch permanently without sending it to the ERP. Its journal entries stay locked to it."
                                                            (click)="OnArchive(batch, $event)">
                                                        <i class="fa-solid fa-box-archive"></i> Archive
                                                    </button>
                                                }
                                                @if (CanCancel(batch)) {
                                                    <button mjButton variant="secondary" size="sm" type="button"
                                                            [disabled]="CancellingBatchID === batch.ID"
                                                            title="Cancel this batch and return its journal entries to the next build."
                                                            (click)="OnCancel(batch, $event)">
                                                        <i class="fa-solid fa-ban"></i> Cancel
                                                    </button>
                                                }
                                            </div>
                                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                }
            </main>

            <!-- Build Batch Modal Dialog -->
            <mj-dialog [Visible]="BuildModalVisible" Title="Build Journal Entry Batch" [Width]="700" (Close)="CloseBuildBatchModal()">
                <div class="mja-modal-content">
                    @if (ModalErrorMessage) {
                        <div class="mja-banner mja-banner--error" role="alert">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>{{ ModalErrorMessage }}</span>
                        </div>
                    }

                    <div class="mja-modal-controls">
                        <div class="mja-modal-field">
                            <label class="mja-modal-label">Target ERP</label>
                            <mj-dropdown
                                [Data]="TargetOptions"
                                [ValuePrimitive]="true"
                                [(ngModel)]="BuildTarget"
                                (ngModelChange)="OnBuildPreviewFilterChange()"
                                aria-label="Target ERP">
                            </mj-dropdown>
                        </div>

                        <div class="mja-modal-field">
                            <label class="mja-modal-label">Effective Date Cutoff</label>
                            <input
                                type="date"
                                class="mj-input mja-modal-date-input"
                                [(ngModel)]="BuildCutoffDate"
                                (ngModelChange)="OnBuildPreviewFilterChange()"
                                aria-label="Effective Date Cutoff" />
                            @if (!BuildCutoffDate) {
                                <span class="mja-modal-hint">No cutoff — includes everything through the posting date.</span>
                            }
                        </div>

                        <!-- The journal date the ERP receives (golive #315); it also ends the pool. -->
                        <div class="mja-modal-field">
                            <label class="mja-modal-label">Posting Date</label>
                            <input
                                type="date"
                                class="mj-input mja-modal-date-input"
                                [(ngModel)]="BuildPostingDate"
                                (ngModelChange)="OnBuildPreviewFilterChange()"
                                title="The journal date the ERP receives. Entries dated after it wait for a later batch."
                                aria-label="Posting Date" />
                        </div>
                    </div>

                    <!-- A prior or future month is allowed but confirmed: the ERP books the batch in that month. -->
                    @if (PostingDateWarning) {
                        <div class="mja-modal-posting-warning" role="alert">
                            <span>{{ PostingDateWarning }}</span>
                            <label class="mja-modal-checkbox-label">
                                <input type="checkbox" [checked]="PostingDateConfirmed" (change)="OnPostingDateConfirmChange($event)" />
                                <span>Yes, post this batch in {{ PostingMonth }}</span>
                            </label>
                        </div>
                    }

                    <div class="mja-modal-options">
                        <label class="mja-modal-checkbox-label">
                            <input type="checkbox" [(ngModel)]="ExcludeRevRec" (ngModelChange)="OnBuildPreviewFilterChange()" />
                            <span><strong>Exclude subscription revenue recognition</strong> (defer Rev Rec until month-end)</span>
                        </label>
                    </div>

                    <!-- Preview Statistics -->
                    <div class="mja-modal-facts">
                        <div class="mja-fact-item">
                            <span class="mja-fact-lbl">Including</span>
                            <strong class="mja-fact-val">{{ IncludedCount }} of {{ PreviewCandidateCount }} JEs</strong>
                        </div>
                        <div class="mja-fact-item" title="Every line of every ticked entry, before netting">
                            <span class="mja-fact-lbl">Entry Totals</span>
                            <strong class="mja-fact-val">Dr {{ PreviewGrossDebits | currency }}</strong>
                            <strong class="mja-fact-val">Cr {{ PreviewGrossCredits | currency }}</strong>
                        </div>
                        <div class="mja-fact-item" title="The netted summary the batch will carry and post">
                            <span class="mja-fact-lbl">Net to Post</span>
                            <strong class="mja-fact-val">Dr {{ PreviewTotalDebits | currency }}</strong>
                            <strong class="mja-fact-val">Cr {{ PreviewTotalCredits | currency }}</strong>
                        </div>
                        <div class="mja-fact-item">
                            <span class="mja-fact-lbl">Date Range</span>
                            <strong class="mja-fact-val">
                                {{ FormatCoveredDay(PreviewCoveredStartDate) }} &rarr;
                                {{ FormatCoveredDay(PreviewCoveredEndDate) }}
                            </strong>
                        </div>
                    </div>

                    <!-- Netting is why the two pairs differ: a booking's Cr Deferred Revenue and its
                         recognition's Dr Deferred Revenue cancel inside the batch (golive #284). -->
                    @if (NetsBelowGross) {
                        <p class="mja-fact-note">
                            Lines on the same account net against each other inside the batch, so Net to Post is
                            less than Entry Totals. Net to Post is what the batch carries.
                        </p>
                    }

                    <!-- Skipping an older entry while batching a newer one is ALLOWED, but it must
                         be visible: the entries reach the ERP out of their own date order. -->
                    @if (HasOutOfOrder) {
                        <div class="mja-banner" role="status">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <span>
                                {{ PreviewOutOfOrderSkipCount }} excluded entr{{ PreviewOutOfOrderSkipCount === 1 ? 'y is' : 'ies are' }}
                                older than an entry you included, so newer entries will batch ahead of
                                {{ PreviewOutOfOrderSkipCount === 1 ? 'it' : 'them' }}. That is allowed — the excluded
                                entries stay Pending for a later batch.
                            </span>
                        </div>
                    }

                    <!-- Held back by AccountingCompanyProfile.PostingStartDate: never in any batch, so say how many. -->
                    @if (PreviewBeforePostingStartCount > 0) {
                        <div class="mja-banner" role="status">
                            <i class="fa-solid fa-calendar-xmark"></i>
                            <span>
                                {{ PreviewBeforePostingStartCount }} entr{{ PreviewBeforePostingStartCount === 1 ? 'y is' : 'ies are' }}
                                dated before {{ PreviewBeforePostingStartCount === 1 ? 'its' : 'their' }} company's posting start date and held back.
                                They stay Pending and are not in this batch.
                            </span>
                        </div>
                    }

                    <!-- Candidate List -->
                    @if (IsPreviewLoading) {
                        <div class="mja-modal-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            <span>Gathering candidate journal entries…</span>
                        </div>
                    } @else if (PreviewCandidateCount === 0) {
                        <div class="mja-modal-empty">
                            <i class="fa-solid fa-inbox"></i>
                            <p>No unbatched pending journal entries match the selected filters.</p>
                        </div>
                    } @else {
                        <div class="mja-modal-table-wrap">
                            <table class="mja-table mja-modal-table">
                                <thead>
                                    <tr>
                                        <th class="mja-th-check">
                                            <input
                                                type="checkbox"
                                                [checked]="AllEntriesIncluded"
                                                [disabled]="IsBuildingBatch"
                                                (change)="SetAllEntriesIncluded(!AllEntriesIncluded)"
                                                aria-label="Include every candidate" />
                                        </th>
                                        <th>Entry №</th>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th class="mja-th-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (e of PreviewEntries; track e.ID) {
                                        <tr [class.mja-row--excluded]="IsExcluded(e.ID)">
                                            <td class="mja-td-check">
                                                <input
                                                    type="checkbox"
                                                    [checked]="!IsExcluded(e.ID)"
                                                    [disabled]="IsBuildingBatch"
                                                    (change)="ToggleEntry(e.ID)"
                                                    [attr.aria-label]="'Include ' + e.EntryNumber" />
                                            </td>
                                            <td><strong>{{ e.EntryNumber }}</strong></td>
                                            <td>{{ e.EffectiveDate | date:'mediumDate':'UTC' }}</td>
                                            <td><span class="mja-type-tag">{{ e.EntryTypeCode }}</span></td>
                                            <td class="mja-desc-cell">{{ e.Description || '—' }}</td>
                                            <td class="mja-td-right">{{ e.Amount | currency }}</td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    }
                </div>

                <mj-dialog-actions>
                    @if (BuildBlockedReason) {
                        <span class="mja-modal-blocked" role="status">{{ BuildBlockedReason }}</span>
                    }
                    <button
                        mjButton
                        variant="primary"
                        size="sm"
                        type="button"
                        [disabled]="!CanBuild"
                        [title]="BuildBlockedReason || 'Build a batch from the ticked entries'"
                        (click)="ExecuteBuildBatch()">
                        @if (IsBuildingBatch) {
                            <i class="fa-solid fa-spinner fa-spin"></i> Building Batch…
                        } @else {
                            <i class="fa-solid fa-layer-group"></i> Build Batch ({{ IncludedCount }})
                        }
                    </button>
                    <button mjButton variant="flat" size="sm" type="button" [disabled]="IsBuildingBatch" (click)="CloseBuildBatchModal()">
                        Cancel
                    </button>
                </mj-dialog-actions>
            </mj-dialog>

            <!-- Reject, Archive and Cancel (#405): the shared batch-action dialog, as on Batch approvals and Dispatch status. -->
            <mja-batch-action-dialog [State]="ActionDialog" (Confirm)="ConfirmActionDialog()" (Dismiss)="CloseActionDialog()" />

            <!-- A Failed batch's retry, when the ERP lookup cannot settle whether it posted (#182, #466). -->
            <mja-retry-confirm-dialog [State]="RetryConfirm" (Confirm)="ConfirmRetry()" (Dismiss)="CancelRetry()" />
        </div>
    `,
    styles: [`
        :host { display: block; width: 100%; height: 100%; box-sizing: border-box; }

        .mja-batches-layout {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 20px 24px;
            min-height: 100%;
            background: var(--mj-bg-surface-sunken, #f8fafc);
            box-sizing: border-box;
        }

        /* Banner */
        .mja-banner {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
        }
        .mja-banner--success {
            background: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
        }
        .mja-banner--error {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }
        .mja-banner-close {
            margin-left: auto;
            background: transparent;
            border: none;
            cursor: pointer;
            color: inherit;
            opacity: 0.7;
        }
        .mja-banner-close:hover { opacity: 1; }

        /* 1. Header Card */
        .mja-head-card {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: var(--mj-radius-lg, 12px);
            padding: 16px 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .mja-head-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
        }

        .mja-identity {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .mja-avatar {
            width: 44px;
            height: 44px;
            border-radius: var(--mj-radius-md, 8px);
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.25);
        }

        .mja-titles {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .mja-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--mj-text-primary, #0f172a);
        }

        .mja-sub {
            margin: 0;
            font-size: 13px;
            color: var(--mj-text-muted, #64748b);
        }

        /* Phase / Stage Tabs */
        .mja-stage-tabs {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            border-top: 1px solid var(--mj-border-subtle, #f1f5f9);
            padding-top: 12px;
        }

        .mja-stage-tab {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 9999px;
            border: 1px solid var(--mj-border-default, #e2e8f0);
            background: var(--mj-bg-surface, #ffffff);
            color: var(--mj-text-secondary, #475569);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .mja-stage-tab:hover {
            border-color: var(--mj-border-strong);
            background: var(--mj-bg-surface-hover, #f8fafc);
        }

        .mja-stage-tab--active {
            background: var(--mj-brand-primary, #0f172a);
            color: #ffffff;
            border-color: var(--mj-brand-primary, #0f172a);
        }

        .mja-stage-tab--active i {
            color: #ffffff !important;
        }

        .mja-tab-count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18px;
            height: 18px;
            padding: 0 4px;
            border-radius: 9999px;
            background: rgba(0, 0, 0, 0.06);
            font-size: 11px;
            font-weight: 600;
        }

        .mja-stage-tab--active .mja-tab-count {
            background: rgba(255, 255, 255, 0.2);
            color: #ffffff;
        }

        .mja-count--highlight {
            background: #fef3c7;
            color: #b45309;
        }

        /* Filter Controls */
        .mja-filter-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
        }

        .mja-search-box {
            position: relative;
            flex: 1;
            max-width: 380px;
            min-width: 240px;
        }

        .mja-search-box i {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--mj-text-muted, #94a3b8);
            font-size: 13px;
        }

        .mja-search-input {
            width: 100%;
            height: 34px;
            padding: 0 12px 0 34px;
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-sm, 6px);
            font-size: 13px;
            outline: none;
            background: var(--mj-bg-surface);
            color: var(--mj-text-primary);
            box-sizing: border-box;
            color-scheme: light dark;
        }

        .mja-search-input:focus {
            border-color: var(--mj-brand-primary);
        }

        .mja-filter-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .mja-filter-label {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--mj-text-secondary);
            font-weight: 500;
        }

        .mja-select {
            height: 34px;
            padding: 0 10px;
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-sm, 6px);
            font-size: 13px;
            background: var(--mj-bg-surface);
            color: var(--mj-text-primary);
            outline: none;
            color-scheme: light dark;
        }

        .mja-select:focus {
            border-color: var(--mj-brand-primary);
        }

        /* 2. Body Card */
        .mja-body-card {
            background: var(--mj-bg-surface-card, #ffffff);
            border: 1px solid var(--mj-border-default, #e2e8f0);
            border-radius: var(--mj-radius-lg, 12px);
            padding: 0;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        /* Empty State */
        .mja-empty-hero {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 24px;
            text-align: center;
            max-width: 480px;
            margin: 0 auto;
        }

        .mja-empty-icon {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: #f1f5f9;
            color: #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 16px;
        }

        .mja-empty-title {
            margin: 0 0 8px 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--mj-text-primary, #0f172a);
        }

        .mja-empty-desc {
            margin: 0 0 20px 0;
            font-size: 13px;
            color: var(--mj-text-muted, #64748b);
            line-height: 1.5;
        }

        /* Table */
        .mja-table-wrap {
            overflow-x: auto;
            width: 100%;
        }

        .mja-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }

        .mja-table thead th {
            background: var(--mj-bg-surface-sunken, #f8fafc);
            padding: 10px 16px;
            font-weight: 600;
            color: var(--mj-text-secondary, #475569);
            border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
            white-space: nowrap;
        }

        .mja-table tbody tr {
            border-bottom: 1px solid var(--mj-border-subtle, #f1f5f9);
            cursor: pointer;
            transition: background 0.1s ease;
        }

        .mja-table tbody tr:hover {
            background: var(--mj-bg-surface-hover, #f8fafc);
        }

        .mja-table tbody td {
            padding: 12px 16px;
            color: var(--mj-text-primary, #0f172a);
            vertical-align: middle;
        }

        .mja-batch-num {
            color: #0284c7;
            font-variant-numeric: tabular-nums;
        }

        .mja-target-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 8px;
            border-radius: 4px;
            background: #f1f5f9;
            color: #334155;
            font-size: 11.5px;
            font-weight: 500;
        }

        .mja-status-pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: capitalize;
        }

        .mja-status-pill[data-status="Pending"] { background: #fef3c7; color: #b45309; }
        .mja-status-pill[data-status="Approved"] { background: #e0f2fe; color: #0369a1; }
        .mja-status-pill[data-status="Sent"] { background: #ede9fe; color: #6d28d9; }
        .mja-status-pill[data-status="Posted"] { background: #dcfce7; color: #15803d; }
        .mja-status-pill[data-status="Failed"] { background: #fee2e2; color: #b91c1c; }
        .mja-status-pill[data-status="Cancelled"] { background: #f1f5f9; color: #64748b; }
        .mja-status-pill[data-status="Archived"] { background: #e2e8f0; color: #475569; }

        .mja-archive-reason {
            display: block;
            margin-top: 4px;
            max-width: 260px;
            font-size: 11px;
            line-height: 1.35;
            color: var(--mj-text-muted, #94a3b8);
        }

        .mja-th-right, .mja-td-right {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        .mja-td-action {
            /* Shrink-to-fit, not 32px: this cell held a lone open-record icon until the Archive
               action joined it, and a fixed 32px wrapped the icon under the button. */
            width: 1%;
            white-space: nowrap;
            text-align: right;
            color: var(--mj-text-muted, #94a3b8);
        }

        .mja-td-action > * { vertical-align: middle; }
        .mja-td-action > .mja-row-actions + i { margin-left: 10px; }

        /* Up to four buttons (Approve, Reject, Archive, Cancel on a Pending batch, #466): they wrap
           two to a line instead of widening the table past the page. The min-width keeps a pair on
           one line, since the shrink-to-fit cell would otherwise stack them one per line. */
        .mja-row-actions {
            display: inline-flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 6px;
            min-width: 210px;
            max-width: 220px;
            white-space: nowrap;
        }
        /* A row with no actions (Posted, Archived) keeps no blank 210px. */
        .mja-row-actions:empty { display: none; }

        .mja-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 60px;
            color: var(--mj-text-muted, #64748b);
            font-size: 13px;
        }

        /* Modal content */
        .mja-modal-content {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 4px 0;
            color: var(--mj-text-primary);
        }
        .mja-modal-controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            align-items: start;
        }
        .mja-modal-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
        }
        .mja-modal-hint {
            font-size: 12px;
            color: var(--mj-status-warning);
        }
        .mja-modal-posting-warning {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 12px;
            padding: 9px 12px;
            border-radius: 8px;
            font-size: 12.5px;
            background: color-mix(in srgb, var(--mj-status-warning) 10%, var(--mj-bg-surface));
            border: 1px solid color-mix(in srgb, var(--mj-status-warning) 40%, transparent);
        }
        .mja-modal-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--mj-text-muted);
        }
        .mj-input, .mja-modal-date-input {
            height: 34px;
            padding: 0 10px;
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-sm, 6px);
            font-size: 13px;
            background: var(--mj-bg-surface);
            color: var(--mj-text-primary);
            outline: none;
            box-sizing: border-box;
            color-scheme: light dark;
            width: 100%;
        }
        .mj-input:focus, .mja-modal-date-input:focus {
            border-color: var(--mj-brand-primary);
        }
        .mja-modal-options {
            padding: 10px 14px;
            background: var(--mj-bg-surface-sunken);
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-sm, 6px);
        }
        .mja-modal-checkbox-label {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: var(--mj-text-primary);
            cursor: pointer;
            user-select: none;
        }
        .mja-modal-checkbox-label input[type="checkbox"] {
            accent-color: var(--mj-brand-primary);
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
        .mja-modal-facts {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            padding: 12px 16px;
            background: var(--mj-bg-surface-sunken);
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md, 8px);
        }
        .mja-fact-item {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }
        .mja-fact-lbl {
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--mj-text-muted);
        }
        .mja-fact-val {
            font-size: 13.5px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .mja-fact-note {
            margin: 0;
            font-size: 12px;
            color: var(--mj-text-muted);
        }
        .mja-modal-table-wrap {
            max-height: 240px;
            overflow-y: auto;
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md, 8px);
            background: var(--mj-bg-surface);
        }
        .mja-modal-table thead th {
            background: var(--mj-bg-surface-sunken);
            color: var(--mj-text-secondary);
            border-bottom: 1px solid var(--mj-border-default);
        }
        .mja-modal-table tbody tr {
            border-bottom: 1px solid var(--mj-border-subtle);
        }
        .mja-modal-table tbody tr:hover {
            background: var(--mj-bg-surface-hover);
        }
        .mja-modal-table tbody td {
            color: var(--mj-text-primary);
        }
        .mja-th-check, .mja-td-check {
            width: 32px;
            text-align: center;
            padding-right: 0;
        }
        /* An excluded row stays legible and re-tickable — dimmed, never hidden. */
        .mja-modal-table tbody tr.mja-row--excluded td:not(.mja-td-check) {
            opacity: 0.45;
            text-decoration: line-through;
        }
        .mja-modal-blocked {
            margin-right: auto;
            font-size: 12px;
            color: var(--mj-text-muted);
        }
        .mja-type-tag {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            background: var(--mj-bg-surface-sunken);
            color: var(--mj-text-secondary);
            border: 1px solid var(--mj-border-subtle);
        }
        .mja-desc-cell {
            max-width: 220px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--mj-text-muted);
        }
        .mja-modal-loading, .mja-modal-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px 20px;
            gap: 10px;
            color: var(--mj-text-muted);
            font-size: 13px;
        }
    `]
})
export class AccountingBatchesPageComponent implements OnInit {
    private cdr = inject(ChangeDetectorRef);
    private navService = inject(NavigationService, { optional: true });

    public IsLoading = false;
    public Batches: BatchItem[] = [];
    public FilteredBatches: BatchItem[] = [];

    public SelectedStage = 'All';
    public SearchTerm = '';
    public SelectedTarget = '';
    public PendingJECount = 0;

    public TargetOptions: string[] = ['BusinessCentral', 'QuickBooks', 'NetSuite', 'Sage', 'Xero', 'Other'];

    public Stages: StageCount[] = [
        { Status: 'Pending', Count: 0, Color: '#d97706', Icon: 'fa-solid fa-clock' },
        { Status: 'Approved', Count: 0, Color: '#0284c7', Icon: 'fa-solid fa-user-check' },
        { Status: 'Sent', Count: 0, Color: '#7c3aed', Icon: 'fa-solid fa-paper-plane' },
        { Status: 'Posted', Count: 0, Color: '#16a34a', Icon: 'fa-solid fa-circle-check' },
        { Status: 'Failed', Count: 0, Color: '#dc2626', Icon: 'fa-solid fa-triangle-exclamation' },
        { Status: 'Cancelled', Count: 0, Color: '#64748b', Icon: 'fa-solid fa-ban' },
        { Status: 'Archived', Count: 0, Color: '#475569', Icon: 'fa-solid fa-box-archive' },
    ];

    // Build Batch Modal & Preview State
    public BuildModalVisible = false;
    public IsPreviewLoading = false;
    public IsBuildingBatch = false;
    public BuildTarget = 'BusinessCentral';
    public BuildCutoffDate = '';
    /** The batch's posting date (`YYYY-MM-DD`) — the journal date the ERP receives (golive #315). */
    public BuildPostingDate = '';
    public ExcludeRevRec = true;
    public ModalErrorMessage: string | null = null;

    public ActionMessage: string | null = null;
    public ActionMessageIsError = false;

    public PreviewEntries: PreviewEntryWire[] = [];
    public PreviewTotalDebits = 0;
    public PreviewTotalCredits = 0;
    public PreviewGrossDebits = 0;
    public PreviewGrossCredits = 0;
    public PreviewCandidateCount = 0;
    /** Calendar days (`YYYY-MM-DD`) — the EffectiveDate span of the ticked entries. */
    public PreviewCoveredStartDate: string | null = null;
    public PreviewCoveredEndDate: string | null = null;
    /**
     * How many unticked entries are older than the newest ticked one — the entries newer ones
     * would batch ahead of. Computed SERVER-side by the same code the build runs, so the warning cannot drift.
     */
    public PreviewOutOfOrderSkipCount = 0;
    /** Entries dated before their company's posting start date: held back, and left Pending, by every build. */
    public PreviewBeforePostingStartCount = 0;
    /** Numbers each preview request. Only the latest one's response is applied (#254): ticking
     *  fast fires overlapping previews, and a slower earlier one must not overwrite a newer one. */
    private previewRequestSeq = 0;

    /**
     * The operator's ticked entries (golive #193, #284): every candidate, or an explicit include
     * set. Sent to the preview as it is, so the server's totals and the ticks on screen always
     * describe the same selection. After Clear All the set is empty, so entries that a later filter
     * change brings into the pool start unticked.
     */
    public Selection: EntrySelection = ALL_ENTRIES;

    /** Per-row in-flight ids so the acting row's button disables, not every row's. */
    public ArchivingBatchID: string | null = null;
    public CancellingBatchID: string | null = null;
    public DecidingBatchID: string | null = null;
    public DispatchingBatchID: string | null = null;

    /** The Reject / Archive / Cancel dialog (#405), shared with Batch approvals and Dispatch status. */
    public ActionDialog = new BatchActionDialogState<BatchItem>();

    /** A Failed batch's retry waiting on the operator's ERP check (#182), shared with Dispatch status. */
    public RetryConfirm = new RetryConfirmState<BatchItem>();

    /** Whether any row's action is in flight: one batch action at a time. */
    private get anyRowBusy(): boolean {
        return !!(this.ArchivingBatchID || this.CancellingBatchID || this.DecidingBatchID || this.DispatchingBatchID);
    }

    /**
     * Approve and Reject show on a Pending batch to the users the server would record a decision from
     * (#339): the company's configured approver, and not the user who built the batch. This page is the
     * app's one batch list, so a batch built here is decided here too (#466). The server stays the authority.
     */
    public CanDecide(batch: BatchItem): boolean {
        if (batch.Status !== 'Pending' || this.DecidingBatchID === batch.ID) return false;
        return MayDecideBatch(batch, Metadata.Provider?.CurrentUser?.ID, this.companyApprovers);
    }

    /** Dispatch sends an Approved batch to the ERP; it needs the batch-operator Authorization (#448). */
    public CanDispatch(batch: BatchItem): boolean {
        return batch.Status === 'Approved' && this.DispatchingBatchID !== batch.ID && this.MayOperateBatches;
    }

    /** Retry re-sends a Failed batch under its original approval; same Authorization as Dispatch. */
    public CanRetry(batch: BatchItem): boolean {
        return batch.Status === 'Failed' && this.DispatchingBatchID !== batch.ID && this.MayOperateBatches;
    }

    /**
     * Record the approver's approval: the batch moves Pending→Approved and can be dispatched. The
     * decision is recorded on the batch's approval Task too, so the Task closes with it.
     */
    public async OnApprove(batch: BatchItem, event: Event): Promise<void> {
        // The row itself opens the record — an action button inside it must not also navigate.
        event.stopPropagation();
        if (this.anyRowBusy) return;
        this.DecidingBatchID = batch.ID;
        this.ActionMessage = null;
        this.cdr.markForCheck();
        try {
            const res = await this.dispatchClient.RecordDecision(batch.ID, 'Approved');
            this.ActionMessageIsError = !res.Success;
            this.ActionMessage = res.Success
                ? `Approved batch ${batch.JournalEntryBatchNumber}. It can now be dispatched to ${batch.TargetSystem}.`
                : (res.ErrorMessage ?? 'The approval was not recorded.');
            await this.LoadBatches();
        } finally {
            this.DecidingBatchID = null;
            this.cdr.markForCheck();
        }
    }

    /** A rejection cancels the batch, so it asks for the reason first (golive #302). */
    public OnReject(batch: BatchItem, event: Event): void {
        event.stopPropagation();
        this.openActionDialog(batch, 'Reject');
    }

    /**
     * Send an Approved batch, or retry a Failed one. `Success` means only that the call returned: an
     * ERP rejection comes back as `Success` with the batch at `Failed`, so anything other than `Posted`
     * is reported as an error. A retry the server's ERP lookup cannot settle opens the retry dialog.
     */
    public async OnDispatch(batch: BatchItem, event: Event): Promise<void> {
        event.stopPropagation();
        if (this.anyRowBusy || !(this.CanDispatch(batch) || this.CanRetry(batch))) return;
        await this.dispatch(batch, false);
    }

    /** Retry with the operator's word that the batch has not posted in the ERP. */
    public async ConfirmRetry(): Promise<void> {
        const batch = this.RetryConfirm.Batch;
        if (!batch || !this.RetryConfirm.CanConfirm) return;
        this.RetryConfirm.Close();
        if (!this.CanRetry(batch)) return;
        await this.dispatch(batch, true);
    }

    public CancelRetry(): void {
        this.RetryConfirm.Close();
        this.cdr.markForCheck();
    }

    private async dispatch(batch: BatchItem, confirmNotAlreadyPostedInERP: boolean): Promise<void> {
        this.DispatchingBatchID = batch.ID;
        this.ActionMessage = null;
        this.cdr.markForCheck();
        try {
            const res = await this.dispatchClient.DispatchJournalEntryBatch(batch.ID, confirmNotAlreadyPostedInERP);
            if (res.Success && res.ConfirmationRequired) {
                this.RetryConfirm.Open(batch, res.ConfirmationRequired, res.ConfirmationKind ?? null);
                return;
            }
            this.ActionMessageIsError = !(res.Success && res.Status === 'Posted');
            if (res.Success && res.Status === 'Posted') {
                const ref = res.ExternalJournalEntryBatchRef ? ` (ref ${res.ExternalJournalEntryBatchRef})` : '';
                this.ActionMessage = `Dispatched batch ${batch.JournalEntryBatchNumber} to ${batch.TargetSystem}: Posted${ref}.`;
            } else if (res.Success) {
                this.ActionMessage = `Batch ${batch.JournalEntryBatchNumber} did not post; it is ${res.Status ?? 'unknown'}. Open the batch for the ERP's error, then retry it.`;
            } else {
                this.ActionMessage = res.ErrorMessage ?? 'Dispatch failed.';
            }
            // Every outcome reloads: a server error can land after the batch has already moved.
            await this.LoadBatches();
        } finally {
            this.DispatchingBatchID = null;
            this.cdr.markForCheck();
        }
    }

    /**
     * Archive is offered wherever the server's LEGAL_TRANSITIONS allows it (Pending / Approved / Failed),
     * except on a Failed batch carrying the ERP's reference, which the server refuses (#413), and only to
     * the users the server would let archive it (#448): holders of the batch-operator Authorization who
     * are, on a Pending batch, the company's approver, and past approval the company's approver or the
     * user who approved it.
     */
    public CanArchive(batch: BatchItem): boolean {
        if (IsErpAcceptedFailedBatch(batch)) return false;
        if (!['Pending', 'Approved', 'Failed'].includes(batch.Status) || this.ArchivingBatchID === batch.ID) return false;
        return this.MayOperateBatches && MayArchiveBatch(batch, Metadata.Provider?.CurrentUser?.ID, this.companyApprovers);
    }

    /**
     * Whether the signed-in user holds the batch-operator Authorization (the Finance role) that Build
     * and Archive require on the server (#448). The server stays the authority.
     */
    public get MayOperateBatches(): boolean {
        return UserCanOperateJournalEntryBatches(Metadata.Provider?.CurrentUser, Metadata.Provider?.Authorizations);
    }

    /**
     * Archive a batch that must never post to the ERP (golive #214): terminal, no ERP call, and the
     * batch's journal entries STAY locked to it — the opposite of a reject/cancel, which returns them
     * to the candidate pool. The reason is required and is the only record of why it will never post.
     */
    public OnArchive(batch: BatchItem, event: Event): void {
        // The row itself opens the record — an action button inside it must not also navigate.
        event.stopPropagation();
        this.openActionDialog(batch, 'Archive');
    }

    /**
     * Cancel is offered on a Pending (golive #302), Approved or Failed (#183) batch. The server decides
     * who may cancel: the company's CFO or the batch's builder before approval (#308), the CFO or the
     * approver after it (#339). The button shows only to those users; the server check stays the
     * authority. Not on a Failed batch carrying the ERP's reference: the ERP accepted it, and the
     * server refuses (#412).
     */
    public CanCancel(batch: BatchItem): boolean {
        if (IsErpAcceptedFailedBatch(batch)) return false;
        if (!['Pending', 'Approved', 'Failed'].includes(batch.Status) || this.CancellingBatchID === batch.ID) return false;
        const userId = Metadata.Provider?.CurrentUser?.ID;
        return batch.Status === 'Pending'
            ? MayCancelPendingBatch(batch, userId, this.companyApprovers)
            : MayCancelApprovedBatch(batch, userId, this.companyApprovers);
    }

    /** Each company's configured approver, read with the batches; decides who sees Cancel (#308, #339). */
    private companyApprovers: CompanyApprovers = new Map();

    /**
     * Cancel a Pending, Approved or Failed batch: the batch becomes Cancelled, its summary journal entry
     * is deleted and its journal entries return to the candidate pool — the opposite of Archive, which
     * keeps them locked. A Pending batch's approval request is closed. A Failed batch may already be in
     * the ERP, so the server looks its number up first (#207); the dialog asks the operator only when
     * it cannot say.
     */
    public OnCancel(batch: BatchItem, event: Event): void {
        // The row itself opens the record — an action button inside it must not also navigate.
        event.stopPropagation();
        this.openActionDialog(batch, 'Cancel');
    }

    public CloseActionDialog(): void {
        if (this.ActionDialog.Busy) return;
        this.ActionDialog.Close();
        this.cdr.markForCheck();
    }

    /**
     * Run the dialog's action with its reason. A cancel's first attempt carries no ERP confirmation: the
     * server checks the ERP itself, and only when it cannot settle it does the dialog stay open and ask.
     * Every other answer closes the dialog (the message is on the page, and the dialog would hide it)
     * and reloads the list: an action whose response timed out may still have gone through.
     */
    public async ConfirmActionDialog(): Promise<void> {
        const dialog = this.ActionDialog;
        const batch = dialog.Batch;
        if (!batch || !dialog.Action || !dialog.CanConfirm) return;
        const action = dialog.Action;
        this.setRowBusy(action, batch.ID);
        dialog.Busy = true;
        this.ActionMessage = null;
        this.cdr.markForCheck();
        try {
            const needsCheck = action === 'Archive'
                ? await this.archive(batch, dialog.TrimmedReason)
                : action === 'Reject'
                    ? await this.reject(batch, dialog.TrimmedReason)
                    : await this.cancel(batch, dialog);
            dialog.Busy = false;
            if (needsCheck) return;
            dialog.Close();
            await this.LoadBatches();
        } finally {
            dialog.Busy = false;
            this.setRowBusy(action, null);
            this.cdr.markForCheck();
        }
    }

    private openActionDialog(batch: BatchItem, action: BatchAction): void {
        if (this.anyRowBusy) return;
        this.ActionDialog.Open(batch, action, Metadata.Provider);
        this.cdr.markForCheck();
    }

    private setRowBusy(action: BatchAction, id: string | null): void {
        if (action === 'Archive') this.ArchivingBatchID = id;
        else if (action === 'Reject') this.DecidingBatchID = id;
        else this.CancellingBatchID = id;
    }

    /** Reject; the reason becomes the decision's notes and the batch's CancelReason. Never needs the ERP check. */
    private async reject(batch: BatchItem, reason: string): Promise<false> {
        const res = await this.dispatchClient.RecordDecision(batch.ID, 'Rejected', reason);
        this.ActionMessageIsError = !res.Success;
        this.ActionMessage = res.Success
            ? `Rejected batch ${batch.JournalEntryBatchNumber}. It is cancelled, and its journal entries return to the next build.`
            : (res.ErrorMessage ?? 'The rejection was not recorded.');
        return false;
    }

    /** Archive; never needs the ERP check. */
    private async archive(batch: BatchItem, reason: string): Promise<false> {
        const res = await this.dispatchClient.ArchiveBatch(batch.ID, reason);
        this.ActionMessageIsError = !res.Success;
        this.ActionMessage = res.Success
            ? `Archived batch ${batch.JournalEntryBatchNumber} — no ERP call; its journal entries stay locked to it.`
            : (res.ErrorMessage ?? `Batch ${batch.JournalEntryBatchNumber} was not archived. Try again.`);
        return false;
    }

    /** Cancel; true when the server asks for the ERP check and the dialog must stay open. */
    private async cancel(batch: BatchItem, dialog: BatchActionDialogState<BatchItem>): Promise<boolean> {
        const res = await this.dispatchClient.CancelBatch(batch.ID, dialog.TrimmedReason, dialog.ConfirmsNotPostedInERP);
        if (res.Success && res.ConfirmationRequired) {
            dialog.AskForERPCheck(res.ConfirmationRequired, res.ConfirmationKind ?? null);
            return true;
        }
        this.ActionMessageIsError = !res.Success;
        this.ActionMessage = res.Success
            ? `Cancelled batch ${batch.JournalEntryBatchNumber} — its journal entries return to the next build.`
            : (res.ErrorMessage ?? `Batch ${batch.JournalEntryBatchNumber} was not cancelled. Try again.`);
        return false;
    }

    private get dispatchClient(): JournalEntryBatchDispatchClient {
        return new JournalEntryBatchDispatchClient(Metadata.Provider as GraphQLDataProvider);
    }

    ngOnInit(): void {
        this.LoadBatches();
    }

    public async LoadBatches(): Promise<void> {
        this.IsLoading = true;
        this.cdr.markForCheck();

        try {
            const rv = new RunView();
            const [batchRes, jeRes, approvers] = await Promise.all([
                rv.RunView<BatchItem>({
                    EntityName: BATCH_ENTITY,
                    OrderBy: 'PostingDate DESC, JournalEntryBatchNumber DESC',
                    ResultType: 'simple',
                    MaxRows: 500,
                }),
                new RunView().RunView<{ ID: string }>({
                    EntityName: JE_ENTITY,
                    ExtraFilter: "Status = 'Pending'",
                    ResultType: 'simple',
                    MaxRows: 1,
                }),
                LoadCompanyApprovers(rv),
            ]);
            this.companyApprovers = approvers;

            if (batchRes.Success && batchRes.Results) {
                this.Batches = batchRes.Results;
                this.computeStageCounts();
                this.applyFilters();
            }

            if (jeRes.Success) {
                this.PendingJECount = jeRes.TotalRowCount ?? 0;
            }
        } catch {
            // ignore
        } finally {
            this.IsLoading = false;
            this.cdr.markForCheck();
        }
    }

    private computeStageCounts(): void {
        const counts: Record<string, number> = {};
        for (const b of this.Batches) {
            counts[b.Status] = (counts[b.Status] || 0) + 1;
        }

        for (const s of this.Stages) {
            s.Count = counts[s.Status] || 0;
        }
    }

    public SetStage(stage: string): void {
        this.SelectedStage = stage;
        this.applyFilters();
    }

    public OnFilterChange(): void {
        this.applyFilters();
    }

    public ResetFilters(): void {
        this.SelectedStage = 'All';
        this.SearchTerm = '';
        this.SelectedTarget = '';
        this.applyFilters();
    }

    private applyFilters(): void {
        const term = this.SearchTerm.trim().toLowerCase();
        this.FilteredBatches = this.Batches.filter((b) => {
            if (this.SelectedStage !== 'All' && b.Status !== this.SelectedStage) {
                return false;
            }
            if (this.SelectedTarget && b.TargetSystem !== this.SelectedTarget) {
                return false;
            }
            if (term) {
                const matchNum = b.JournalEntryBatchNumber?.toLowerCase().includes(term);
                const matchRef = b.ExternalJournalEntryBatchRef?.toLowerCase().includes(term);
                const matchCo = b.Company?.toLowerCase().includes(term);
                if (!matchNum && !matchRef && !matchCo) return false;
            }
            return true;
        });
        this.cdr.markForCheck();
    }

    public OpenBatchRecord(id: string): void {
        if (!this.navService) return;
        this.navService.OpenEntityRecord(BATCH_ENTITY, CompositeKey.FromID(id));
    }

    // ─── include / exclude (golive #193) ──────────────────────────────────────────────────────
    //
    // The build's own contract already carries the operator's selection end to end
    // (`PreviewJournalEntryBatchOptionsInput.IncludedJournalEntryIDs` and
    // `BuildJournalEntryBatchOptionsInput { Source: 'Explicit', JournalEntryIDs }`, served by
    // `buildJournalEntryBatchFromExplicitIds`). This page previously ignored it and swept every
    // candidate, so an operator with entries that must NOT post yet had no way to build at all.

    public IsExcluded(id: string): boolean {
        return !IsEntryIncluded(this.Selection, id);
    }

    /** Ticking re-previews: the netted totals and the out-of-order warning are both functions of
     *  the selection, and both are computed server-side by the code the build itself runs. */
    public async ToggleEntry(id: string): Promise<void> {
        if (this.IsBuildingBatch) return;
        this.Selection = ToggleEntrySelection(this.Selection, id, this.PreviewEntries.map(e => e.ID));
        await this.LoadBuildPreview();
    }

    public async SetAllEntriesIncluded(included: boolean): Promise<void> {
        if (this.IsBuildingBatch) return;
        this.Selection = included ? ALL_ENTRIES : NO_ENTRIES;
        await this.LoadBuildPreview();
    }

    /** The candidates on screen that are ticked: the set the preview totals and the build sends. */
    public get IncludedEntryIDs(): string[] {
        return IncludedCandidateIds(this.Selection, this.PreviewEntries.map(e => e.ID));
    }

    public get IncludedCount(): number {
        return this.IncludedEntryIDs.length;
    }

    public get ExcludedCount(): number {
        return this.PreviewCandidateCount - this.IncludedCount;
    }

    public get AllEntriesIncluded(): boolean {
        return this.PreviewCandidateCount > 0 && this.ExcludedCount === 0;
    }

    /** Cent-level tolerance — amounts are decimal(18,2), matching the server's FOOT_TOLERANCE. */
    public get IsBalanced(): boolean {
        return Math.abs(this.PreviewTotalDebits - this.PreviewTotalCredits) < 0.005;
    }

    /** True when netting inside the batch removes some of the ticked entries' volume. */
    public get NetsBelowGross(): boolean {
        return this.PreviewGrossDebits - this.PreviewTotalDebits > 0.005;
    }

    public get HasOutOfOrder(): boolean {
        return this.PreviewOutOfOrderSkipCount > 0;
    }

    /** Today's business day. */
    public get Today(): string {
        return BusinessTimeZoneEngine.Instance.Today();
    }

    /** The posting date whose prior/future-month warning was confirmed; any other date asks again. */
    private confirmedPostingDate: string | null = null;

    /** "Are you sure?" text when the posting date is in a prior or future month (golive #315), or null. */
    public get PostingDateWarning(): string | null {
        return PostingDateMonthWarning(this.BuildPostingDate, this.Today);
    }

    /** The posting date's month, e.g. `September 2026`, for the confirmation label. */
    public get PostingMonth(): string {
        return IsCalendarDay(this.BuildPostingDate) ? PostingMonthLabel(this.BuildPostingDate) : '';
    }

    public get PostingDateConfirmed(): boolean {
        return !!this.BuildPostingDate && this.BuildPostingDate === this.confirmedPostingDate;
    }

    public ConfirmPostingDate(confirmed: boolean): void {
        this.confirmedPostingDate = confirmed ? this.BuildPostingDate : null;
        this.cdr.markForCheck();
    }

    public OnPostingDateConfirmChange(event: Event): void {
        this.ConfirmPostingDate((event.target as HTMLInputElement).checked);
    }

    /** Why the posting date falls in a month finance has closed for a ticked entry's company (golive #316), or null. */
    public get ClosedBooksProblem(): string | null {
        const included = new Set(this.IncludedEntryIDs);
        const companies = this.PreviewEntries.filter(e => included.has(e.ID)).map(e => e.CompanyID);
        return ClosedBooksProblem(this.BuildPostingDate, companies);
    }

    /** Non-null = why Build is disabled. Saying it beats a dead button with no explanation. */
    public get BuildBlockedReason(): string | null {
        // The preview re-queries on every change and its pool ends at the posting date, so no ticked
        // entry can postdate it; the server refuses that case regardless.
        if (!this.MayOperateBatches) return 'Building a journal entry batch requires the Finance role.';
        if (!IsCalendarDay(this.BuildPostingDate)) return 'Choose a posting date.';
        if (this.ClosedBooksProblem) return this.ClosedBooksProblem;
        if (this.PostingDateWarning && !this.PostingDateConfirmed) return `Confirm posting this batch in ${this.PostingMonth}.`;
        if (this.PreviewCandidateCount === 0) return 'Nothing matches these criteria.';
        if (this.IncludedCount === 0) return 'Every entry is excluded — nothing to build.';
        if (!this.IsBalanced) return 'The selected entries do not balance: total debits must equal total credits. Include or exclude entries until they match.';
        return null;
    }

    public get CanBuild(): boolean {
        return !this.IsBuildingBatch && !this.IsPreviewLoading && this.BuildBlockedReason === null;
    }

    public async OpenBuildBatchModal(): Promise<void> {
        if (!this.MayOperateBatches) return;
        this.BuildModalVisible = true;
        // A fresh session starts with everything ticked — the sweep remains the one-click default.
        this.Selection = ALL_ENTRIES;
        this.ModalErrorMessage = null;
        this.confirmedPostingDate = null;
        if (!this.BuildCutoffDate) {
            this.BuildCutoffDate = BusinessTimeZoneEngine.Instance.Today();
        }
        if (!this.BuildPostingDate) {
            this.BuildPostingDate = BusinessTimeZoneEngine.Instance.Today();
        }
        await this.LoadBuildPreview();
    }

    public CloseBuildBatchModal(): void {
        this.BuildModalVisible = false;
        // Drop any preview still in flight — it answers a session that is over.
        this.previewRequestSeq++;
        this.IsPreviewLoading = false;
        this.ModalErrorMessage = null;
    }

    public async OnBuildPreviewFilterChange(): Promise<void> {
        await this.LoadBuildPreview();
    }

    public async LoadBuildPreview(): Promise<void> {
        const seq = ++this.previewRequestSeq;
        this.IsPreviewLoading = true;
        this.ModalErrorMessage = null;
        this.cdr.markForCheck();

        try {
            // Send the selection as it is, so the netted totals and the out-of-order count describe
            // what the TICKED entries would produce. It is never derived from the previous response's
            // candidates: after a filter change those are the old pool (golive #284). The server
            // still returns every candidate, so an unticked entry stays visible and re-tickable.
            const previewRes = await this.dispatchClient.PreviewJournalEntryBatch({
                Cutoff: this.BuildCutoffDate || null,
                PostingDate: this.BuildPostingDate || null,
                ExcludeEntryTypeCodes: this.ExcludeRevRec ? ['RevenueRecognition'] : null,
                IncludedJournalEntryIDs: SelectionRequestIds(this.Selection),
            });
            if (seq !== this.previewRequestSeq) return; // superseded by a newer request

            if (previewRes.Success) {
                this.PreviewEntries = previewRes.Candidates ?? [];
                this.PreviewCandidateCount = this.PreviewEntries.length;
                this.PreviewTotalDebits = previewRes.TotalDebits;
                this.PreviewTotalCredits = previewRes.TotalCredits;
                this.PreviewGrossDebits = previewRes.GrossDebits;
                this.PreviewGrossCredits = previewRes.GrossCredits;
                this.PreviewOutOfOrderSkipCount = previewRes.OutOfOrderSkipCount;
                this.PreviewBeforePostingStartCount = previewRes.BeforePostingStartCount;
                this.setCoveredDateRange(this.PreviewEntries);
            } else {
                this.ModalErrorMessage = previewRes.ErrorMessage ?? 'Could not load the entries that match these criteria. Try again.';
                this.clearPreview();
            }
        } catch (e) {
            if (seq !== this.previewRequestSeq) return;
            this.ModalErrorMessage = e instanceof Error ? e.message : String(e);
        } finally {
            if (seq === this.previewRequestSeq) {
                this.IsPreviewLoading = false;
                this.cdr.markForCheck();
            }
        }
    }

    /** The effective-date span the ticked entries cover — the modal's fourth fact. */
    private setCoveredDateRange(entries: PreviewEntryWire[]): void {
        const span = calendarDaySpan(entries.filter(e => IsEntryIncluded(this.Selection, e.ID)).map(e => e.EffectiveDate));
        this.PreviewCoveredStartDate = span?.First ?? null;
        this.PreviewCoveredEndDate = span?.Last ?? null;
    }

    /** A covered-range end (a calendar day) for display — UTC-anchored, never the browser's day. */
    public FormatCoveredDay(day: string | null): string {
        return formatJournalDate(day);
    }

    private clearPreview(): void {
        this.PreviewEntries = [];
        this.PreviewCandidateCount = 0;
        this.PreviewTotalDebits = 0;
        this.PreviewTotalCredits = 0;
        this.PreviewGrossDebits = 0;
        this.PreviewGrossCredits = 0;
        this.PreviewOutOfOrderSkipCount = 0;
        this.PreviewBeforePostingStartCount = 0;
        this.PreviewCoveredStartDate = null;
        this.PreviewCoveredEndDate = null;
    }

    public async ExecuteBuildBatch(): Promise<void> {
        if (!this.CanBuild) return;
        this.IsBuildingBatch = true;
        this.ModalErrorMessage = null;
        this.cdr.markForCheck();

        try {
            // Build EXACTLY the ticked set. Source='Explicit' re-validates server-side that every
            // id is still Pending and loud-rejects a stale selection — the preview is a snapshot.
            // With nothing unticked this is the same set the criteria sweep would have taken.
            const buildRes = await this.dispatchClient.BuildJournalEntryBatch({
                TargetSystem: this.BuildTarget,
                Cutoff: this.BuildCutoffDate || null,
                PostingDate: this.BuildPostingDate || null,
                ExcludeEntryTypeCodes: this.ExcludeRevRec ? ['RevenueRecognition'] : null,
                Source: 'Explicit',
                JournalEntryIDs: this.IncludedEntryIDs,
            });

            if (buildRes.Success) {
                if (buildRes.NothingToBatch) {
                    this.ActionMessage = 'There are no pending journal entries to batch.';
                    this.ActionMessageIsError = false;
                } else {
                    this.ActionMessage = `Successfully built ${buildRes.CompanyCount} batch(es) for ${buildRes.JECount} journal entr${buildRes.JECount === 1 ? 'y' : 'ies'} (${buildRes.SummaryLineCount} consolidated GL lines, Dr ${buildRes.TotalDebits.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}).`;
                    this.ActionMessageIsError = false;
                }
                this.BuildModalVisible = false;
                this.SelectedStage = 'All';
                await this.LoadBatches();
            } else {
                this.ModalErrorMessage = buildRes.ErrorMessage ?? 'The journal entry batch was not built. Try again.';
            }
        } catch (e) {
            this.ModalErrorMessage = e instanceof Error ? e.message : String(e);
        } finally {
            this.IsBuildingBatch = false;
            this.cdr.markForCheck();
        }
    }
}
