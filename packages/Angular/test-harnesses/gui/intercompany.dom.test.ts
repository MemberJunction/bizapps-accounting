/** TIER 4 — Intercompany Flow dashboard (ReadModelDashboardBase), real API path, pinned to CO2 which
 *  OWNS the seeded intercompany leg (matches tier-3 readmodels-client scoping). Asserts the leg loads
 *  through the real client with the right EntryType — the drift-proof invariant, not liveness. */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { ReadModelsModule } from '../../src/lib/custom/shared/read-models.module';
import { IntercompanyFlowDashboardComponent } from '../../src/lib/custom/Intercompany/intercompany-flow-dashboard.component';

const CO2 = 'a55c0de1-0002-4000-8000-000000000002'; // owns the seeded intercompany leg
interface Model { SelectedCompanyID: string | null; IsLoading: boolean; LoadError: string | null; Legs: Array<{ EntryType: string }>; }

describe('TIER 4: Intercompany Flow (real API, CO2)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);
  it('CO2 loads its intercompany leg through the real client (drift-proof EntryType)', async () => {
    TestBed.configureTestingModule({ imports: [ReadModelsModule] });
    const fixture = TestBed.createComponent(IntercompanyFlowDashboardComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    cmp.SelectedCompanyID = CO2;
    fixture.detectChanges();
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (cmp.LoadError !== null) break; if (i > 3 && cmp.IsLoading === false) break; }
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.LoadError, `LoadError: ${cmp.LoadError}`).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML.length).toBeGreaterThan(0);
    expect(cmp.Legs.length, 'CO2 owns >= 1 intercompany leg').toBeGreaterThan(0);
    expect(cmp.Legs.every((l) => l.EntryType === 'IntercompanyFlow'), 'every leg is EntryType IntercompanyFlow').toBe(true);
  });
});
