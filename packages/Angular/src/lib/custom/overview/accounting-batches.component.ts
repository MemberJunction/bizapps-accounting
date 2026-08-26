import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompositeKey, Metadata, RunView } from '@memberjunction/core';
import { GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
import { NavigationService } from '@memberjunction/ng-shared';
import { MJButtonDirective, MJDialogComponent, MJDialogActionsComponent, MJDropdownComponent } from '@memberjunction/ng-ui-components';
import {
    JournalEntryBatchDispatchClient,
    PreviewEntryWire,
    BuildJournalEntryBatchOptionsInput,
} from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';

export interface BatchItem {
    ID: string;
    JournalEntryBatchNumber: string;
    Status: 'Pending' | 'Approved' | 'Sent' | 'Posted' | 'Failed' | 'Cancelled';
    TargetSystem: string;
    PostingDate: string;
    BatchedAt: string;
    TotalEntries: number;
    TotalDebits: number;
    TotalCredits: number;
    Company: string | null;
    ExternalJournalEntryBatchRef: string | null;
}

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
    imports: [CommonModule, FormsModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent, MJDropdownComponent],
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
                        <button mjButton variant="primary" size="sm" type="button" (click)="OpenBuildBatchModal()">
                            <i class="fa-solid fa-plus"></i> Build Batch
                        </button>
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
                        <div class="mja-empty-actions">
                            <button mjButton variant="primary" size="md" type="button" (click)="OpenBuildBatchModal()">
                                <i class="fa-solid fa-plus"></i> Build First Batch
                            </button>
                        </div>
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
                                        <td>{{ batch.PostingDate | date:'mediumDate' }}</td>
                                        <td>{{ batch.Company || '—' }}</td>
                                        <td>
                                            <span class="mja-status-pill" [attr.data-status]="batch.Status">
                                                {{ batch.Status }}
                                            </span>
                                        </td>
                                        <td class="mja-td-right">{{ batch.TotalEntries }}</td>
                                        <td class="mja-td-right">
                                            <strong>{{ batch.TotalDebits | currency }}</strong>
                                        </td>
                                        <td class="mja-td-action">
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
                        </div>
                    </div>

                    <div class="mja-modal-options">
                        <label class="mja-modal-checkbox-label">
                            <input type="checkbox" [(ngModel)]="ExcludeRevRec" (ngModelChange)="OnBuildPreviewFilterChange()" />
                            <span><strong>Exclude subscription revenue recognition</strong> (defer Rev Rec until month-end)</span>
                        </label>
                    </div>

                    <!-- Preview Statistics -->
                    <div class="mja-modal-facts">
                        <div class="mja-fact-item">
                            <span class="mja-fact-lbl">Candidates</span>
                            <strong class="mja-fact-val">{{ PreviewCandidateCount }} JEs</strong>
                        </div>
                        <div class="mja-fact-item">
                            <span class="mja-fact-lbl">Total Debits</span>
                            <strong class="mja-fact-val">{{ PreviewTotalDebits | currency }}</strong>
                        </div>
                        <div class="mja-fact-item">
                            <span class="mja-fact-lbl">Total Credits</span>
                            <strong class="mja-fact-val">{{ PreviewTotalCredits | currency }}</strong>
                        </div>
                        <div class="mja-fact-item">
                            <span class="mja-fact-lbl">Date Range</span>
                            <strong class="mja-fact-val">
                                {{ PreviewCoveredStartDate ? (PreviewCoveredStartDate | date:'mediumDate') : '—' }} &rarr;
                                {{ PreviewCoveredEndDate ? (PreviewCoveredEndDate | date:'mediumDate') : '—' }}
                            </strong>
                        </div>
                    </div>

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
                                        <th>Entry №</th>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th class="mja-th-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (e of PreviewEntries; track e.ID) {
                                        <tr>
                                            <td><strong>{{ e.EntryNumber }}</strong></td>
                                            <td>{{ e.EffectiveDate | date:'mediumDate' }}</td>
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
                    <button
                        mjButton
                        variant="primary"
                        size="sm"
                        type="button"
                        [disabled]="IsBuildingBatch || IsPreviewLoading || PreviewCandidateCount === 0"
                        (click)="ExecuteBuildBatch()">
                        @if (IsBuildingBatch) {
                            <i class="fa-solid fa-spinner fa-spin"></i> Building Batch…
                        } @else {
                            <i class="fa-solid fa-layer-group"></i> Build Batch ({{ PreviewCandidateCount }})
                        }
                    </button>
                    <button mjButton variant="flat" size="sm" type="button" [disabled]="IsBuildingBatch" (click)="CloseBuildBatchModal()">
                        Cancel
                    </button>
                </mj-dialog-actions>
            </mj-dialog>
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
            border-color: var(--mj-border-hover, #cbd5e1);
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

        .mja-th-right, .mja-td-right {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        .mja-td-action {
            width: 32px;
            text-align: center;
            color: var(--mj-text-muted, #94a3b8);
        }

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
    ];

    // Build Batch Modal & Preview State
    public BuildModalVisible = false;
    public IsPreviewLoading = false;
    public IsBuildingBatch = false;
    public BuildTarget = 'BusinessCentral';
    public BuildCutoffDate = '';
    public ExcludeRevRec = true;
    public ModalErrorMessage: string | null = null;

    public ActionMessage: string | null = null;
    public ActionMessageIsError = false;

    public PreviewEntries: PreviewEntryWire[] = [];
    public PreviewTotalDebits = 0;
    public PreviewTotalCredits = 0;
    public PreviewCandidateCount = 0;
    public PreviewCoveredStartDate: string | null = null;
    public PreviewCoveredEndDate: string | null = null;

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
            const [batchRes, jeRes] = await Promise.all([
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
            ]);

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

    public async OpenBuildBatchModal(): Promise<void> {
        this.BuildModalVisible = true;
        this.ModalErrorMessage = null;
        if (!this.BuildCutoffDate) {
            this.BuildCutoffDate = new Date().toISOString().slice(0, 10);
        }
        await this.LoadBuildPreview();
    }

    public CloseBuildBatchModal(): void {
        this.BuildModalVisible = false;
        this.ModalErrorMessage = null;
    }

    public async OnBuildPreviewFilterChange(): Promise<void> {
        await this.LoadBuildPreview();
    }

    public async LoadBuildPreview(): Promise<void> {
        this.IsPreviewLoading = true;
        this.ModalErrorMessage = null;
        this.cdr.markForCheck();

        try {
            const previewRes = await this.dispatchClient.PreviewJournalEntryBatch({
                Cutoff: this.BuildCutoffDate || null,
                ExcludeEntryTypeCodes: this.ExcludeRevRec ? ['RevenueRecognition'] : null,
            });

            if (previewRes.Success) {
                this.PreviewEntries = previewRes.Candidates ?? [];
                this.PreviewCandidateCount = this.PreviewEntries.length;
                this.PreviewTotalDebits = previewRes.TotalDebits;
                this.PreviewTotalCredits = previewRes.TotalCredits;

                if (this.PreviewEntries.length > 0) {
                    const dates = this.PreviewEntries.map(e => new Date(e.EffectiveDate).getTime()).filter(t => !isNaN(t));
                    if (dates.length > 0) {
                        this.PreviewCoveredStartDate = new Date(Math.min(...dates)).toISOString();
                        this.PreviewCoveredEndDate = new Date(Math.max(...dates)).toISOString();
                    } else {
                        this.PreviewCoveredStartDate = null;
                        this.PreviewCoveredEndDate = null;
                    }
                } else {
                    this.PreviewCoveredStartDate = null;
                    this.PreviewCoveredEndDate = null;
                }
            } else {
                this.ModalErrorMessage = previewRes.ErrorMessage ?? 'Failed to load candidate preview.';
                this.PreviewEntries = [];
                this.PreviewCandidateCount = 0;
                this.PreviewTotalDebits = 0;
                this.PreviewTotalCredits = 0;
            }
        } catch (e) {
            this.ModalErrorMessage = e instanceof Error ? e.message : String(e);
        } finally {
            this.IsPreviewLoading = false;
            this.cdr.markForCheck();
        }
    }

    public async ExecuteBuildBatch(): Promise<void> {
        if (this.IsBuildingBatch || this.PreviewCandidateCount === 0) return;
        this.IsBuildingBatch = true;
        this.ModalErrorMessage = null;
        this.cdr.markForCheck();

        try {
            const buildRes = await this.dispatchClient.BuildJournalEntryBatch({
                TargetSystem: this.BuildTarget,
                Cutoff: this.BuildCutoffDate || null,
                ExcludeEntryTypeCodes: this.ExcludeRevRec ? ['RevenueRecognition'] : null,
            });

            if (buildRes.Success) {
                if (buildRes.NothingToBatch) {
                    this.ActionMessage = 'No candidate journal entries found to batch.';
                    this.ActionMessageIsError = false;
                } else {
                    this.ActionMessage = `Successfully built ${buildRes.CompanyCount} batch(es) for ${buildRes.JECount} journal entr${buildRes.JECount === 1 ? 'y' : 'ies'} (${buildRes.SummaryLineCount} consolidated GL lines, Dr ${buildRes.TotalDebits.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}).`;
                    this.ActionMessageIsError = false;
                }
                this.BuildModalVisible = false;
                this.SelectedStage = 'All';
                await this.LoadBatches();
            } else {
                this.ModalErrorMessage = buildRes.ErrorMessage ?? 'Failed to build batch.';
            }
        } catch (e) {
            this.ModalErrorMessage = e instanceof Error ? e.message : String(e);
        } finally {
            this.IsBuildingBatch = false;
            this.cdr.markForCheck();
        }
    }
}
