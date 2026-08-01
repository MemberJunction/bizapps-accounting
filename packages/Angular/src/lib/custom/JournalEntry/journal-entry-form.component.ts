import { Component, inject } from '@angular/core';
import { CompositeKey } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent, MJFormPresenterService } from '@memberjunction/ng-base-forms';
import type {
  AfterReversalRequestedEventArgs,
  BeforeReversalRequestedEventArgs,
  JEHeaderView,
  RecordOpenRequestedEventArgs,
} from '@mj-biz-apps/accounting-ng-widgets';
import { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';

import { mjBizAppsAccountingJournalEntryFormComponent } from '../../generated/Entities/mjBizAppsAccountingJournalEntry/mjbizappsaccountingjournalentry.form.component';
import { openBizDetail } from '../shared/biz-detail-form';

/**
 * Journal Entry — the Explorer entity form. **Layer 3.**
 *
 * Everything an accountant sees below the field panels is rendered by
 * `<mjacc-journal-entry-detail>` from `@mj-biz-apps/accounting-ng-widgets` — the same composite
 * the journal-entries slide-in uses. This class exists to do the three things a widget is not
 * allowed to do:
 *
 *   1. hand the composite the record the form already has (no extra header read),
 *   2. turn its `RecordOpenRequested` intent into an actual MJ presentation,
 *   3. refresh the form after a reversal so the back-reference appears.
 *
 * ## What it used to be
 *
 * 193 lines: a `Timeline` getter, a `LinesLoading` / `LinesError` / `Lines` state machine, a
 * two-query line + dimension loader, five pieces of reversal state, and a `CanReverse` getter
 * that gated on `Status === 'GLPosted'`. That last one was wrong in both directions — it refused
 * reversals the server permits (a `Batched` entry) and offered reversals the server rejects (a
 * reversal of a reversal) — while a correct, unit-tested `canReverse()` already existed in this
 * repo and was being used by the other JE surface. Nothing here re-derives a domain rule now, so
 * that class of divergence has nowhere left to live.
 *
 * @see The MJ repo's `guides/UI_LAYERING_GUIDE.md`, and `docs/UI_LAYERING.md` here.
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

  private readonly forms = inject(MJFormPresenterService);

  /**
   * The loaded record, in the shape the composite renders.
   *
   * A projection rather than a cast: `JEHeaderView` is a plain view model with no `BaseEntity`
   * machinery, which is exactly why the widget package can be reused and unit-tested. Reading the
   * generated properties (never `.Get()`) keeps this type-checked against the schema.
   */
  public get HeaderView(): JEHeaderView | null {
    const r = this.record;
    if (!r?.ID) return null;
    return {
      ID: r.ID,
      EntryNumber: r.EntryNumber,
      EntryType: r.EntryType,
      Status: r.Status,
      EffectiveDate: r.EffectiveDate,
      Description: r.Description,
      CompanyID: r.CompanyID,
      Company: r.Company,
      LinkedEntity: r.LinkedEntity,
      LinkedEntityID: r.LinkedEntityID,
      LinkedRecordID: r.LinkedRecordID,
      BatchID: r.BatchID,
      ReversedByJournalEntryID: r.ReversedByJournalEntryID,
      ReversesJournalEntryID: r.ReversesJournalEntryID,
      GLPostedAt: r.GLPostedAt,
      GLReferenceID: r.GLReferenceID,
    };
  }

  /**
   * Guard the reversal.
   *
   * MUST be synchronous — `EventEmitter.emit()` runs synchronous listeners inline, which is the
   * only reason the composite can read `Cancel` after emitting. An `async` handler would return
   * at its first `await`, the flag would be set too late, and the veto would silently do nothing.
   *
   * Unsaved edits are the one thing this surface knows that the widget cannot: a composite has no
   * concept of a form being dirty.
   */
  public OnBeforeReversal(event: BeforeReversalRequestedEventArgs): void {
    if (this.record?.Dirty) {
      event.Cancel = true;
      event.CancelReason = 'Save or cancel your changes to this entry before reversing it.';
    }
  }

  /** Reload so the reversal back-reference — and the now-blocked reverse verb — show up. */
  public async OnAfterReversal(event: AfterReversalRequestedEventArgs): Promise<void> {
    if (event.Success) await this.record.Load(this.record.ID);
  }

  /** Intent → presentation. The widget named a record; this decides how it opens. */
  public OnRecordOpenRequested(event: RecordOpenRequestedEventArgs): void {
    openBizDetail(this.forms, {
      entityName: event.EntityName,
      primaryKey: CompositeKey.FromID(event.RecordID),
      title: event.Title,
      mode: event.Preference === 'tab' ? 'dialog' : event.Preference,
    });
  }
}

/** Tree-shaking prevention — called from custom-forms.module.ts's load function. */
export function LoadJournalEntryFormComponentExtended(): void {
  // No-op.
}
