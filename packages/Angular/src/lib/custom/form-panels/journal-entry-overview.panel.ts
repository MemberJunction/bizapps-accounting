import { Component, inject } from '@angular/core';
import { CompositeKey } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import { NavigationService } from '@memberjunction/ng-shared';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { awaitsApproval } from '../shared/je-rules';
import {
    formatJournalTimestamp,
    JOURNAL_ENTRY_BATCH_ENTITY,
    JOURNAL_ENTRY_ENTITY,
} from './journal-entry-panel.helpers';

interface TimelineStep {
    Key: mjBizAppsAccountingJournalEntryEntity['Status'];
    Label: string;
    Icon: string;
    Done: boolean;
    Current: boolean;
}

/** The Accounting app's nav item that hosts the build flow — see `metadata/applications/`. */
const BATCHES_NAV_ITEM = 'Batches';

const STATUS_ORDER: Record<mjBizAppsAccountingJournalEntryEntity['Status'], number> = {
    Pending: 0,
    Batched: 1,
    GLPosted: 2,
};

/**
 * Journal Entry Overview — lifecycle, posting, source, and reversal facts.
 * Replaces the generated Lifecycle and Posting field dump.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:JournalEntries:overview',
    metadata: {
        entity: JOURNAL_ENTRY_ENTITY,
        slot: 'before-fields',
        sortKey: 90,
        contributionKey: 'overview',
        inclusion: 'Primary',
        replacesSectionKey: 'lifecycleAndPosting',
    },
})
@Component({
    standalone: false,
    selector: 'mja-journal-entry-overview-panel',
    templateUrl: './journal-entry-overview.panel.html',
    styleUrls: ['./journal-entry-form-panels.css'],
})
export class JournalEntryOverviewPanel extends BaseFormPanel<mjBizAppsAccountingJournalEntryEntity> {
    /** Optional: a panel can be mounted outside Explorer (tests, harnesses), where there is no shell. */
    private navService = inject(NavigationService, { optional: true });

    public get Timeline(): TimelineStep[] {
        const status = this.Record.Status ?? 'Pending';
        const reached = STATUS_ORDER[status] ?? 0;
        return [
            { Key: 'Pending', Label: 'Pending', Icon: 'fa-solid fa-pen', Done: reached >= 0, Current: status === 'Pending' },
            { Key: 'Batched', Label: 'Batched', Icon: 'fa-solid fa-layer-group', Done: reached >= 1, Current: status === 'Batched' },
            { Key: 'GLPosted', Label: 'GL Posted', Icon: 'fa-solid fa-circle-check', Done: reached >= 2, Current: status === 'GLPosted' },
        ];
    }

    public get AwaitsReview(): boolean {
        return awaitsApproval(this.Record);
    }

    public get PostedAtLabel(): string {
        // GLPostedAt is a DATETIMEOFFSET (a true timestamp), not a DATE column, so it stays on
        // local-parts formatting — see `formatJournalTimestamp`'s doc comment.
        return formatJournalTimestamp(this.Record.GLPostedAt);
    }

    public OpenBatch(): void {
        if (!this.Record.JournalEntryBatchID) {
            return;
        }
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: JOURNAL_ENTRY_BATCH_ENTITY,
            PrimaryKey: CompositeKey.FromID(this.Record.JournalEntryBatchID),
        });
    }

    /**
     * Take the operator to where batches are actually built (golive #193).
     *
     * The unbatched state used to be a dead sentence — "Assigned when the next batch is built" —
     * with nothing on this form, on either grid, or in the record's menu saying where that happens.
     * 'Batches' is the app nav item; the label is resolved at runtime against the Application row,
     * so this follows a nav rename without a code change (and no-ops if the item is absent).
     */
    public async OpenBatchBuilder(): Promise<void> {
        if (!this.navService) return;
        await this.navService.OpenNavItemByName(BATCHES_NAV_ITEM);
    }

    public OpenSource(): void {
        if (!this.Record.LinkedEntity || !this.Record.LinkedRecordID) {
            return;
        }
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: this.Record.LinkedEntity,
            PrimaryKey: CompositeKey.FromID(this.Record.LinkedRecordID),
        });
    }

    public OpenReverses(): void {
        if (!this.Record.ReversesJournalEntryID) {
            return;
        }
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: JOURNAL_ENTRY_ENTITY,
            PrimaryKey: CompositeKey.FromID(this.Record.ReversesJournalEntryID),
        });
    }

    public OpenReversedBy(): void {
        if (!this.Record.ReversedByJournalEntryID) {
            return;
        }
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: JOURNAL_ENTRY_ENTITY,
            PrimaryKey: CompositeKey.FromID(this.Record.ReversedByJournalEntryID),
        });
    }
}
