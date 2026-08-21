import { Component } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { JOURNAL_ENTRY_ENTITY } from './journal-entry-panel.helpers';

/**
 * Replaces the generated Reversal Information dump (hierarchy Depth/Path/IsLeaf
 * columns). The reverse verb lives on the header.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:JournalEntries:reversal',
    metadata: {
        entity: JOURNAL_ENTRY_ENTITY,
        slot: 'after-fields',
        sortKey: 40,
        contributionKey: 'reversal',
        replacesSectionKey: 'reversalInformation',
    },
})
@Component({
    standalone: false,
    selector: 'mja-journal-entry-reversal-panel',
    templateUrl: './journal-entry-reversal.panel.html',
    styleUrls: ['./journal-entry-form-panels.css'],
})
export class JournalEntryReversalPanel extends BaseFormPanel<mjBizAppsAccountingJournalEntryEntity> {}
