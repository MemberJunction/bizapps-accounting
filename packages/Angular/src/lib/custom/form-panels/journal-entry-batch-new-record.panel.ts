import { Component, inject } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import { NavigationService } from '@memberjunction/ng-shared';
import type { mjBizAppsAccountingJournalEntryBatchEntity } from '@mj-biz-apps/accounting-entities';

/** The Accounting app's nav item that hosts the build flow — see `metadata/applications/`. */
const BATCHES_NAV_ITEM = 'Batches';

/**
 * What a NEW Journal Entry Batch shows instead of a blank CRUD form (golive #193).
 *
 * The generated form let an operator type a batch number, pick a company and posting date, and key
 * Total Entries / Total Debits / Total Credits by hand. None of that builds a batch: the netted
 * summary entry, the lock on each member journal entry and the CFO approval task all happen in the
 * build transaction, so what the form produced was an empty Pending header carrying totals that
 * footed against nothing — and it was indistinguishable from a real batch until dispatch.
 *
 * `JournalEntryBatchEntityServer` now refuses the create outright; this panel is what stops the
 * operator filling a form that was always going to be rejected, and says where to go instead.
 * `leadsWhenUnsaved` puts it in front of the fields rather than beside them.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:JournalEntryBatches:newRecord',
    metadata: {
        entity: 'MJ_BizApps_Accounting: Journal Entry Batches',
        slot: 'before-fields',
        sortKey: 200,
        contributionKey: 'newRecord',
        inclusion: 'Primary',
        leadsWhenUnsaved: true,
    },
})
@Component({
    standalone: false,
    selector: 'mja-journal-entry-batch-new-record-panel',
    template: `
        @if (!Record.IsSaved) {
            <div class="mja-batch-new">
                <i class="fa-solid fa-boxes-stacked mja-batch-new__icon" aria-hidden="true"></i>
                <h2 class="mja-batch-new__title">Batches are built, not typed</h2>
                <p class="mja-batch-new__body">
                    A journal entry batch is produced from the pending journal entries you select — together
                    with its netted summary entry, the lock on each entry it takes, and the approval task.
                    Saving this form cannot do any of that, so it will be rejected.
                </p>
                <button type="button" class="mj-btn mj-btn--primary" (click)="OpenBatchBuilder()">
                    <i class="fa-solid fa-layer-group" aria-hidden="true"></i> Go to Batches
                </button>
            </div>
        }
    `,
    styles: [`
        .mja-batch-new {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 12px;
            padding: 32px 24px;
        }
        .mja-batch-new__icon {
            font-size: 28px;
            color: var(--mj-text-muted);
        }
        .mja-batch-new__title {
            margin: 0;
            font-size: var(--mj-text-lg);
            font-weight: 650;
            color: var(--mj-text-primary);
        }
        .mja-batch-new__body {
            margin: 0;
            max-width: 52ch;
            font-size: var(--mj-text-sm);
            color: var(--mj-text-secondary);
        }
    `],
})
export class JournalEntryBatchNewRecordPanel extends BaseFormPanel<mjBizAppsAccountingJournalEntryBatchEntity> {
    /** Optional: a panel can be mounted outside Explorer (tests, harnesses), where there is no shell. */
    private navService = inject(NavigationService, { optional: true });

    /** Resolved at runtime against the Application row, so a nav rename needs no code change. */
    public async OpenBatchBuilder(): Promise<void> {
        if (!this.navService) return;
        await this.navService.OpenNavItemByName(BATCHES_NAV_ITEM);
    }
}
