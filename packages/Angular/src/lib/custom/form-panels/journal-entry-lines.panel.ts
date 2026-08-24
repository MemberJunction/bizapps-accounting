import { Component, OnInit } from '@angular/core';
import { CompositeKey } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import type { AfterDataLoadEventArgs } from '@memberjunction/ng-entity-viewer';
import type {
    mjBizAppsAccountingJournalEntryEntity,
    mjBizAppsAccountingJournalEntryLineEntity,
} from '@mj-biz-apps/accounting-entities';
import { isBalanced } from '../shared/je-rules';
import {
    ensureJournalEntryLines,
    formatJournalMoney,
    GL_ACCOUNT_ENTITY,
    JOURNAL_ENTRY_ENTITY,
    JOURNAL_ENTRY_LINE_ENTITY,
    journalLineTotals,
} from './journal-entry-panel.helpers';

const SECTION_KEY = 'lines';

/**
 * Journal Entry lines — claims the baked related grid. Display uses the
 * `Lines` related-record collection (plus nested Dimensions). Pending entries
 * also keep the stock grid so New / edit still work.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:JournalEntries:lines',
    metadata: {
        entity: JOURNAL_ENTRY_ENTITY,
        slot: 'after-related',
        sortKey: 90,
        relatedEntity: JOURNAL_ENTRY_LINE_ENTITY,
        relatedJoinField: 'JournalEntryID',
        contributionKey: SECTION_KEY,
        inclusion: 'Primary',
    },
})
@Component({
    standalone: false,
    selector: 'mja-journal-entry-lines-panel',
    templateUrl: './journal-entry-lines.panel.html',
    styleUrls: ['./journal-entry-form-panels.css'],
})
export class JournalEntryLinesPanel extends BaseFormPanel<mjBizAppsAccountingJournalEntryEntity> implements OnInit {
    public readonly SectionKey = SECTION_KEY;
    public readonly LineEntity = JOURNAL_ENTRY_LINE_ENTITY;
    public LinesLoading = false;
    public LinesError: string | null = null;

    public async ngOnInit(): Promise<void> {
        await this.loadLines();
    }

    public override OnRecordRefreshed(_record: mjBizAppsAccountingJournalEntryEntity): void {
        void this.loadLines(true);
    }

    public get Lines(): readonly mjBizAppsAccountingJournalEntryLineEntity[] {
        return this.Record.Lines.Items;
    }

    public get LineCountLabel(): string {
        const n = this.Lines.length;
        return `${n} ${n === 1 ? 'line' : 'lines'}`;
    }

    public get Totals(): { Debits: number; Credits: number } {
        return journalLineTotals(this.Lines);
    }

    public get DebitsLabel(): string {
        return formatJournalMoney(this.Totals.Debits) || '0.00';
    }

    public get CreditsLabel(): string {
        return formatJournalMoney(this.Totals.Credits) || '0.00';
    }

    public get Balanced(): boolean {
        return isBalanced(this.Totals.Debits, this.Totals.Credits);
    }

    public get Variance(): number {
        return Math.abs((this.Totals.Debits ?? 0) - (this.Totals.Credits ?? 0));
    }

    public get VarianceLabel(): string {
        return formatJournalMoney(this.Variance) || '0.00';
    }

    public get CanEditLines(): boolean {
        return this.Record.IsSaved && this.Record.Status === 'Pending';
    }

    public FormatAmount(amount: number | null): string {
        return formatJournalMoney(amount);
    }

    public SplitAccount(glAccount: string | null | undefined): { code: string | null; name: string } {
        if (!glAccount) return { code: null, name: '—' };
        const match = glAccount.match(/^(\w+)\s*[-–—]\s*(.*)$/);
        if (match) {
            return { code: match[1], name: match[2] };
        }
        return { code: null, name: glAccount };
    }

    public OpenAccount(line: mjBizAppsAccountingJournalEntryLineEntity): void {
        if (!line.GLAccountID) {
            return;
        }
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: GL_ACCOUNT_ENTITY,
            PrimaryKey: CompositeKey.FromID(line.GLAccountID),
        });
    }

    public OpenLine(line: mjBizAppsAccountingJournalEntryLineEntity): void {
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: JOURNAL_ENTRY_LINE_ENTITY,
            PrimaryKey: CompositeKey.FromID(line.ID),
        });
    }

    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount(SECTION_KEY, event.totalRowCount);
        void this.loadLines(true);
    }

    private async loadLines(force = false): Promise<void> {
        if (!this.Record.IsSaved) {
            this.LinesLoading = false;
            this.LinesError = null;
            return;
        }
        this.LinesLoading = true;
        this.LinesError = null;
        this.FormComponent.cdr.detectChanges();
        try {
            await ensureJournalEntryLines(this.Record, force);
        } catch (e) {
            this.LinesError = e instanceof Error ? e.message : String(e);
        } finally {
            this.LinesLoading = false;
            this.FormComponent.SetSectionRowCount(SECTION_KEY, this.Lines.length);
            this.FormComponent.cdr.detectChanges();
        }
    }
}
