import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { ReadModelsModule } from '../../src/lib/custom/shared/read-models.module';
import { BatchStatusDashboardComponent } from '../../src/lib/custom/BatchStatus/batch-status-dashboard.component';

describe('tier-4: real BatchStatus dashboard loads real data', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);
  it('loadData runs against the real API without error + renders content', async () => {
    TestBed.configureTestingModule({ imports: [ReadModelsModule] });
    const fixture = TestBed.createComponent(BatchStatusDashboardComponent);
    const cmp = fixture.componentInstance as unknown as { IsLoading: boolean; LoadError: string | null };
    fixture.detectChanges(); // ngOnInit -> loadData (async, in flight)
    // bounded wait for the async load to settle (localhost API is fast)
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (cmp.LoadError !== null) break;               // errored → stop
      if (i > 4 && cmp.IsLoading === false) break;     // completed
    }
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.LoadError, `dashboard LoadError: ${cmp.LoadError}`).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML.length).toBeGreaterThan(0);
  });
});
