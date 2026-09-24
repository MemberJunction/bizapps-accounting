import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Metadata, ValidationResult } from '@memberjunction/core';
import {
  MJDropdownComponent,
  MJLeftNavContentComponent,
  MJPageBodyInteriorComponent,
  MJStatBadgeComponent,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import type { JournalEntryEntity } from '@mj-biz-apps/accounting-entities';
import { JEWorkspacePageComponent } from './je-workspace.page';
import { WorkspaceCardComponent } from '../../../transfer-pending/workspace-tabs/workspace-card.component';
import { WorkspaceTipDirective } from '../../../transfer-pending/workspace-tabs/workspace-tip.directive';
import { AUGUST_CLOSE_IN_CHICAGO, stubbedReadsProvider, useBusinessClock } from '../../../../__tests__/support/business-clock';

/**
 * A new journal entry is stamped with the BUSINESS day as its effective date — the ledger fact
 * itself, which decides the period the entry posts to. See AUGUST_CLOSE_IN_CHICAGO: the business
 * day is 31 August; stamping the instant (`new Date()`) instead would read back as 1 September and
 * file an August entry into September.
 *
 * The stored value is UTC midnight of the calendar day, the shape a DATE column round-trips as,
 * and the date input reads it back from UTC parts.
 */
const BUSINESS_DAY = '2026-08-31';

/**
 * The members of a JournalEntryEntity (and its lines) that opening a blank draft touches: the page
 * stamps defaults, adds two blank lines, and validates on render. Nothing here is saved or loaded.
 *
 * This is a fake of an entity, which MJ's Angular testing guide cautions against; it is kept to
 * exactly what `defaultDraft()` and the empty-draft template read. A new method call on the entity
 * throws and fails the test through the error guard; a new property read does not, since it just
 * returns `undefined`, so add any member the page starts to read here. The cast is confined here.
 */
function blankDraftEntry(): JournalEntryEntity {
  const ok = (): ValidationResult => {
    const result = new ValidationResult();
    result.Success = true;
    return result;
  };
  let lineSeq = 0;
  const items: object[] = [];
  const entry = {
    CompanyID: null,
    EffectiveDate: null,
    Status: null,
    EntryTypeID: null,
    EntryNumber: null,
    Description: null,
    NewRecord: () => true,
    Validate: ok,
    Lines: {
      Items: items,
      Create: async () => {
        const line = {
          ID: `line-${++lineSeq}`,
          IsEmpty: true,
          GLAccountID: null,
          DebitAmount: null,
          CreditAmount: null,
          Description: null,
          Dimensions: { Items: [] },
          Validate: ok,
        };
        items.push(line);
        return line;
      },
    },
  };
  return entry as unknown as JournalEntryEntity;
}

describe('JEWorkspacePageComponent — new entry effective date (DOM)', () => {
  useBusinessClock(AUGUST_CLOSE_IN_CHICAGO);
  let entry: JournalEntryEntity;

  beforeEach(async () => {
    entry = blankDraftEntry();
    vi.spyOn(Metadata.prototype, 'GetEntityObject').mockResolvedValue(entry);

    // Declared with its template's dependencies from CustomFormsModule rather than the module itself.
    await TestBed.configureTestingModule({
      declarations: [JEWorkspacePageComponent],
      imports: [
        CommonModule,
        FormsModule,
        SharedGenericModule,
        MJDropdownComponent,
        MJLeftNavContentComponent,
        MJPageBodyInteriorComponent,
        MJStatBadgeComponent,
        WorkspaceCardComponent,
        WorkspaceTipDirective,
      ],
    }).compileComponents();
  });

  it('stamps the business day on a new draft and shows it in the entry-date input', async () => {
    const fixture = TestBed.createComponent(JEWorkspacePageComponent);
    fixture.componentRef.setInput('Provider', stubbedReadsProvider());
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.Draft).not.toBeNull());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(entry.EffectiveDate?.toISOString()).toBe(`${BUSINESS_DAY}T00:00:00.000Z`);
    const input = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(input, 'the draft renders its entry-date input').not.toBeNull();
    expect(input!.value).toBe(BUSINESS_DAY);
  });
});
