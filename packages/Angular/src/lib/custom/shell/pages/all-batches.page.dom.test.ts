import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RunView, RunViewParams } from '@memberjunction/core';
import { AllBatchesPageComponent } from './all-batches.page';
import { PageRefreshService } from '../../../transfer-pending/shell-refresh/page-refresh.service';
import { CompanyScopeService } from '../../shared/company-scope.service';
import { viewResult } from '../../../../__tests__/support/business-clock';

/**
 * #407: the All batches page's status chips and counts cover every batch status, Archived included.
 * The list is built from a record keyed by the generated Status union, so a status the CHECK
 * constraint gains fails compilation until it is placed. The grid is not under test, so the
 * template is replaced; the chips and counts are component state.
 */
const ARCHIVED_COUNT = 3;

describe('AllBatchesPageComponent — status chips (#407)', () => {
  beforeEach(async () => {
    vi.spyOn(CompanyScopeService.prototype, 'Load').mockResolvedValue(undefined);
    // One count per status after the total; Archived answers 3, everything else 0.
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) =>
      params.map((p) => viewResult([], String(p.ExtraFilter ?? '').includes("Status='Archived'") ? ARCHIVED_COUNT : 0)),
    );
    await TestBed.configureTestingModule({
      declarations: [AllBatchesPageComponent],
      providers: [PageRefreshService],
    })
      .overrideComponent(AllBatchesPageComponent, { set: { template: '' } })
      .compileComponents();
  });

  async function render(): Promise<AllBatchesPageComponent> {
    const fixture = TestBed.createComponent(AllBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('lists every status in journey order, Archived last', async () => {
    const page = await render();
    expect(page.Statuses).toEqual(['Pending', 'Approved', 'Sent', 'Posted', 'Failed', 'Cancelled', 'Archived']);
  });

  it('counts archived batches and offers them as a filter chip', async () => {
    const page = await render();
    await vi.waitFor(() => expect(page.StatusCount('Archived')).toBe(ARCHIVED_COUNT));
    expect(page.StatusChips).toContainEqual({ Key: 'Archived', Label: 'Archived', Count: ARCHIVED_COUNT });

    page.OnPresetToggled('Archived');
    expect(page.GridParams.ExtraFilter).toContain("Status IN ('Archived')");
  });
});
