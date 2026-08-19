import { Component } from '@angular/core';
import { CompositeKey } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { awaitsApproval } from '../shared/je-rules';
import {
    formatJournalDate,
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
        return formatJournalDate(this.Record.GLPostedAt);
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
