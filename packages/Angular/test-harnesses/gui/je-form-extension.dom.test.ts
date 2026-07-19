/**
 * TIER 4 (4e-iii) — the JournalEntry custom-form EXTENSION (`JournalEntryFormComponentExtended`).
 * It ADDS app behavior on top of the generated form (that's why it must be tested, per the coverage
 * doctrine): the reversal-affordance GATE (`CanReverse`) and the status `Timeline`.
 *
 * ⛔ SKIPPED — BLOCKED on a tier-4 scaffold gap (filed to MJDEV-ISSUES 2026-07-19). The scaffold's
 * locale fix (1.3.0) cleared the currency-pipe crash, but a SECOND gap remains for ENTITY FORMS:
 * instantiating a `BaseFormComponent`-derived form in the headless harness throws an unhandled
 * rejection `SyntaxError: The URL '' is invalid.` — consistent with the base form opening a
 * record-change WEBSOCKET subscription against the tier-4 provider's deliberately-blank WSURL. It
 * fires on `TestBed.createComponent(...)` alone (before any detectChanges); the 16 dashboard specs
 * never hit it because they don't subclass the entity form. The assertions below are CORRECT and
 * ready — un-skip the moment the scaffold no-ops/guards the blank-WSURL subscription for forms.
 * (Likely the same gap under validation for 4e-ii customer-ar-base / je-detail-panel.)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata } from '@memberjunction/core';
import { MJFormPresenterService } from '@memberjunction/ng-base-forms';
import { bootstrapTier4 } from './tier4-bootstrap';
import { CustomFormsModule } from '../../src/lib/custom/custom-forms.module';
import { JournalEntryFormComponentExtended } from '../../src/lib/custom/JournalEntry/journal-entry-form.component';
import type { mjBizAppsAccountingJournalEntryEntity } from '@mj-biz-apps/accounting-entities';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

interface TimelineStep { Key: string; Current: boolean; Done: boolean }
interface ExtModel {
  record: mjBizAppsAccountingJournalEntryEntity;
  CanReverse: boolean;
  Timeline: TimelineStep[];
}

describe.skip('TIER 4 (4e-iii): JournalEntry form extension — reversal gate + timeline [BLOCKED: tier-4 blank-WSURL entity-form gap]', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);

  // We instantiate the REAL extended form component (so the extension's code runs against the real
  // generated base + the real entity type), then assert the EXTENSION's added getters. We deliberately
  // do NOT drive the base form's full change-detection lifecycle: the generated form's render (its
  // websocket/provider wiring) is MJ-CORE's layer, not this app's — forcing it here would re-test a
  // lower layer's internals (and trips a blank-WSURL rejection in the headless harness). The gate +
  // timeline are pure over `record`, which is exactly the app-authored behavior 4e-iii must cover.
  it('gates CanReverse on GLPosted-and-not-reversed, and the timeline tracks status', async () => {
    TestBed.configureTestingModule({ imports: [CustomFormsModule], providers: [MJFormPresenterService] });
    const f = TestBed.createComponent(JournalEntryFormComponentExtended);
    const c = f.componentInstance as unknown as ExtModel;

    const md = new Metadata();
    const je = await md.GetEntityObject<mjBizAppsAccountingJournalEntryEntity>(JE_ENTITY);
    je.NewRecord();
    c.record = je;

    // 1. GLPosted + not reversed → reversible.
    je.Status = 'GLPosted';
    je.ReversedByJournalEntryID = null;
    expect(c.CanReverse, 'GLPosted + not reversed ⇒ CanReverse').toBe(true);
    expect(c.Timeline.find((s) => s.Key === 'GLPosted')?.Current, 'timeline current = GLPosted').toBe(true);
    expect(c.Timeline.find((s) => s.Key === 'GLPosted')?.Done, 'GLPosted step marked done').toBe(true);

    // 2. Pending → NOT reversible; timeline current = Pending, GLPosted not yet reached.
    je.Status = 'Pending';
    expect(c.CanReverse, 'Pending ⇒ not reversible').toBe(false);
    expect(c.Timeline.find((s) => s.Key === 'Pending')?.Current, 'timeline current = Pending').toBe(true);
    expect(c.Timeline.find((s) => s.Key === 'GLPosted')?.Done, 'GLPosted not reached from Pending').toBe(false);

    // 3. GLPosted but ALREADY reversed → NOT reversible (no double reversal).
    je.Status = 'GLPosted';
    je.ReversedByJournalEntryID = '00000000-0000-4000-8000-000000000abc';
    expect(c.CanReverse, 'already-reversed GLPosted ⇒ not reversible').toBe(false);
  });
});
