import { Component, OnInit } from '@angular/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { isBalanced } from '../shared/je-rules';
import {
    ensureJournalEntryLines,
    formatJournalDate,
    formatJournalMoney,
    JOURNAL_ENTRY_ENTITY,
    JOURNAL_ENTRY_HEADER_SETTING_KEY,
    journalLineTotals,
    journalStatusChipClass,
} from './journal-entry-panel.helpers';

/**
 * Journal Entry identity strip. Replaces the generated Entry Details panel;
 * remaining generated sections stay under Details.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:JournalEntries:header',
    metadata: {
        entity: JOURNAL_ENTRY_ENTITY,
        slot: 'before-fields',
        sortKey: 100,
        contributionKey: 'header',
        replacesSectionKey: 'entryDetails',
    },
})
@Component({
    standalone: false,
    selector: 'mja-journal-entry-header-panel',
    templateUrl: './journal-entry-header.panel.html',
    styleUrls: ['./journal-entry-form-panels.css'],
})
export class JournalEntryHeaderPanel extends BaseFormPanel<mjBizAppsAccountingJournalEntryEntity> implements OnInit {
    public Collapsed = false;
    public LinesReady = false;

    public async ngOnInit(): Promise<void> {
        const raw = UserInfoEngine.Instance.GetSetting(JOURNAL_ENTRY_HEADER_SETTING_KEY);
        if (raw) {
            try {
                this.Collapsed = JSON.parse(raw) === true;
            } catch {
                this.Collapsed = false;
            }
        }
        await this.loadLines();
    }

    public override OnRecordRefreshed(_record: mjBizAppsAccountingJournalEntryEntity): void {
        void this.loadLines(true);
    }

    public ToggleCollapsed(): void {
        this.Collapsed = !this.Collapsed;
        UserInfoEngine.Instance.SetSettingDebounced(
            JOURNAL_ENTRY_HEADER_SETTING_KEY,
            JSON.stringify(this.Collapsed),
        );
    }

    public get Title(): string {
        return this.Record.EntryNumber || 'New journal entry';
    }

    public get StatusClass(): string {
        return journalStatusChipClass(this.Record.Status);
    }

    public get IsReversal(): boolean {
        return this.Record.EntryType === 'Reversal' || !!this.Record.ReversesJournalEntryID;
    }

    public get EffectiveDateLabel(): string {
        return formatJournalDate(this.Record.EffectiveDate);
    }

    public get Totals(): { Debits: number; Credits: number } {
        return journalLineTotals(this.Record.Lines.Items);
    }

    public get DebitsLabel(): string {
        return formatJournalMoney(this.Totals.Debits) || '0.00';
    }

    public get CreditsLabel(): string {
        return formatJournalMoney(this.Totals.Credits) || '0.00';
    }

    public get Difference(): number {
        return this.Totals.Debits - this.Totals.Credits;
    }

    public get Balanced(): boolean {
        return isBalanced(this.Totals.Debits, this.Totals.Credits);
    }

    public get DifferenceLabel(): string {
        return formatJournalMoney(Math.abs(this.Difference)) || '0.00';
    }

    private async loadLines(force = false): Promise<void> {
        await ensureJournalEntryLines(this.Record, force);
        this.LinesReady = true;
        this.FormComponent.cdr.detectChanges();
    }
}
