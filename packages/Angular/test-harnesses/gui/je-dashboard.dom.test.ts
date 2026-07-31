/**
 * TIER 4 — Journal Entries dashboard, headless on the real client → MJAPI → DB path.
 *
 * Every stat the page shows is cross-checked against an INDEPENDENT count over the same filter —
 * drift-proof exact values (the counts move as fixtures run; the equality cannot).
 *
 * Standing regression: the page previously red-carded because its count batch included the RETIRED
 * 'Scheduled Journal Entries' entity (removed 2026-07-29) — one rejected count killed the whole
 * Promise.all. The LoadError-null assertion is that guard; the stat-id list pins the surviving set.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RunView, RunViewParams } from '@memberjunction/core';
import { bootstrapTier4 } from './tier4-bootstrap';
// NOT ShellModule: the shell's module graph has a circular import that leaves module symbols
// undefined when entered from a test file (hasNgModuleDef crash). The page is declared directly
// with exactly its template's dependencies instead — same compile, no cycle.
import { CommonModule } from '@angular/common';
import {
  MJButtonDirective,
  MJPageHeaderInteriorComponent,
  MJPageBodyInteriorComponent,
  MJLeftNavContentComponent,
  MJEmptyStateComponent,
  MJAlertComponent,
} from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { JeDashboardPageComponent } from '../../src/lib/custom/shell/pages/je-dashboard.page';
import { PageRefreshService } from '../../src/lib/transfer-pending/shell-refresh/page-refresh.service';

const JE_ENTITY = 'MJ_BizApps_Accounting: Journal Entries';

async function count(filter: string): Promise<number> {
  const p: RunViewParams = { EntityName: JE_ENTITY, ExtraFilter: filter, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' };
  const r = await new RunView().RunView(p);
  if (!r.Success) throw new Error(`expectation count failed: ${r.ErrorMessage}`);
  return r.TotalRowCount ?? 0;
}

async function waitFor(fixture: ComponentFixture<JeDashboardPageComponent>, cond: () => boolean, ms = 30_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, 150));
    fixture.detectChanges();
  }
  fixture.detectChanges();
}

describe('JE dashboard (tier 4)', () => {
  beforeAll(async () => {
    await bootstrapTier4();
  }, 120_000);

  it('loads without error and every stat equals an independent count of the same filter', async () => {
    await TestBed.configureTestingModule({
      declarations: [JeDashboardPageComponent],
      imports: [CommonModule, SharedGenericModule, MJButtonDirective, MJPageHeaderInteriorComponent, MJPageBodyInteriorComponent, MJLeftNavContentComponent, MJEmptyStateComponent, MJAlertComponent],
      providers: [PageRefreshService],
    }).compileComponents();
    const fixture = TestBed.createComponent(JeDashboardPageComponent);
    fixture.detectChanges(); // ngOnInit → load
    const comp = fixture.componentInstance;
    await waitFor(fixture, () => !comp.IsLoading);

    expect(comp.LoadError, `dashboard load must not error (was: ${comp.LoadError}) — the retired-SJE red card regression`).toBeNull();

    // The exact surviving stat set after the SJE removal — ids are the page's contract.
    const ids = comp.Stats.map((s) => s.Id).sort();
    expect(ids).toEqual(['awaiting', 'batched', 'glposted', 'month', 'pending']);

    // Cross-check each count independently (scope = All companies by default in a fresh session).
    const by = new Map(comp.Stats.map((s) => [s.Id, s.Value]));
    expect(by.get('pending')).toBe(await count(`Status='Pending'`));
    expect(by.get('batched')).toBe(await count(`Status='Batched'`));
    expect(by.get('glposted')).toBe(await count(`Status='GLPosted'`));
    expect(by.get('awaiting')).toBe(await count(`Status='Pending' AND EntryType='Manual'`));

    // Pipeline breakdown segments are the SAME numbers — header/bar disagreement is a real bug.
    const pipeline = comp.Breakdowns.find((b) => b.Id === 'pipeline');
    expect(pipeline).toBeTruthy();
    const seg = new Map(pipeline!.Segments.map((s) => [s.Id, s.Value]));
    expect(seg.get('pending')).toBe(by.get('pending'));
    expect(seg.get('batched')).toBe(by.get('batched'));
    expect(seg.get('glposted')).toBe(by.get('glposted'));

    // List cards render, capped at their top-N contract.
    expect(comp.Lists.length).toBe(3);
    for (const list of comp.Lists) expect(list.Items.length).toBeLessThanOrEqual(5);
  }, 90_000);
});
