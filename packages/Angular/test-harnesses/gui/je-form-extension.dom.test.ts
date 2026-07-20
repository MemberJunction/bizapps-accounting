/**
 * TIER 4 (4e-iii) — the JournalEntry custom-form EXTENSION (`JournalEntryFormComponentExtended`).
 * It ADDS app behavior on top of the generated form (that's why it must be tested, per the coverage
 * doctrine): the reversal-affordance GATE (`CanReverse`) and the status `Timeline`.
 *
 * (History: briefly blocked on a tier-4 blank-WSURL entity-form gap — instantiating a
 * BaseFormComponent-derived form threw `SyntaxError: The URL '' is invalid.` from its record-change
 * websocket subscription. Fixed in scaffold v1.5.0, which points the tier-4 provider at the real
 * MJAPI WS endpoint, ADR-033. Live again.)
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

describe('TIER 4 (4e-iii): JournalEntry form extension — reversal gate + timeline', () => {
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
