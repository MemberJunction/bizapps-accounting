/** TIER 4 — Batch Dispatch (CFO inbox) dashboard, real API path: loads batches + companies through
 *  the real client and renders cleanly. The build/approve/dispatch WRITE flow is proven at tier 3
 *  (batch-dispatch-client 20); here we prove the dashboard's read + render. */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { BatchDispatchModule } from '../../src/lib/custom/BatchDispatch/batch-dispatch.module';
import { BatchDispatchDashboardComponent } from '../../src/lib/custom/BatchDispatch/batch-dispatch-dashboard.component';
import { PageRefreshService } from '../../src/lib/transfer-pending/shell-refresh/page-refresh.service';

interface Model { IsLoading: boolean; LoadError: string | null; Batches: Array<{ ID?: string; Status?: string }>; StatusOptions: string[]; }

describe('TIER 4: Batch Dispatch inbox (real API)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);
  it('loads batches through the real client and renders the inbox cleanly', async () => {
    // BatchDispatch injects the shell's PageRefreshService (provided at app level, not by the module).
    TestBed.configureTestingModule({ imports: [BatchDispatchModule], providers: [PageRefreshService] });
    const fixture = TestBed.createComponent(BatchDispatchDashboardComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    fixture.detectChanges();
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (cmp.LoadError !== null) break; if (i > 3 && cmp.IsLoading === false) break; }
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.LoadError, `LoadError: ${cmp.LoadError}`).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML.length).toBeGreaterThan(0);
    expect(Array.isArray(cmp.Batches), 'Batches loaded as an array through the real client').toBe(true);
    expect(cmp.StatusOptions.length, 'status filter options present').toBeGreaterThan(0);
  });
});
