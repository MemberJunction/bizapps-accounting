import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { RunView } from '@memberjunction/core';
import { BusinessTimeZoneEngine, type InstanceConfigurationRow } from '@mj-biz-apps/common-entities';
import { AccountingBatchesPageComponent } from './accounting-batches.component';
import {
  JournalEntryBatchDispatchClient,
  PreviewJournalEntryBatchOptionsInput,
} from '../JournalEntryBatchDispatch/journal-entry-batch-dispatch.client';

/**
 * The Build Batch modal's default cutoff is the BUSINESS day, not the UTC day.
 *
 * 2026-09-01T03:30:00Z is 22:30 CDT on 31 August in Chicago (the business zone) but already
 * 1 September in UTC. The old default, `new Date().toISOString().slice(0, 10)`, answered
 * '2026-09-01' here and swept entries dated the next business day into tonight's batch.
 */
const INSTANT = new Date('2026-09-01T03:30:00.000Z');
const BUSINESS_DAY = '2026-08-31';

describe('AccountingBatchesPageComponent — Build Batch modal cutoff (DOM)', () => {
  // The engine is a singleton; set its loaded state directly (as `batch-status-window.test.ts`
  // does) so it answers a chosen zone with no IMetadataProvider, then restore it.
  const engine = BusinessTimeZoneEngine.Instance as unknown as { _configurations: InstanceConfigurationRow[]; _loaded: boolean };
  const original = { rows: engine._configurations, loaded: engine._loaded };
  let previewCalls: PreviewJournalEntryBatchOptionsInput[];

  beforeEach(() => {
    engine._configurations = [
      { FeatureKey: 'BizApps.BusinessTimeZone', Value: '{"iana":"America/Chicago","sql":"Central Standard Time"}', DefaultValue: '{"iana":"UTC","sql":"UTC"}' },
    ];
    engine._loaded = true;
    // Only Date is faked: Angular's zoneless scheduler and whenStable() still need real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(INSTANT);

    // The page's batch list (ngOnInit) reads through the global RunView; answer it empty.
    vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({ Success: true, Results: [], TotalRowCount: 0 } as never);
    previewCalls = [];
    vi.spyOn(JournalEntryBatchDispatchClient.prototype, 'PreviewJournalEntryBatch').mockImplementation(async (options) => {
      previewCalls.push(options ?? {});
      return { Success: true, Candidates: [], TotalDebits: 0, TotalCredits: 0, OutOfOrderSkipCount: 0 };
    });
  });

  afterEach(() => {
    engine._configurations = original.rows;
    engine._loaded = original.loaded;
    vi.useRealTimers();
  });

  async function render(): Promise<ComponentFixture<AccountingBatchesPageComponent>> {
    const fixture = TestBed.createComponent(AccountingBatchesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function openModal(fixture: ComponentFixture<AccountingBatchesPageComponent>): Promise<HTMLInputElement> {
    await fixture.componentInstance.OpenBuildBatchModal();
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[aria-label="Effective Date Cutoff"]') as HTMLInputElement | null;
    expect(input, 'the modal renders its cutoff date input').not.toBeNull();
    return input!;
  }

  it('defaults an empty cutoff to the business day, sends it to the preview, and shows it in the date input', async () => {
    const fixture = await render();
    const input = await openModal(fixture);

    expect(fixture.componentInstance.BuildCutoffDate).toBe(BUSINESS_DAY);
    expect(previewCalls.map(c => c.Cutoff)).toEqual([BUSINESS_DAY]);
    expect(input.value).toBe(BUSINESS_DAY);
  });

  it('keeps a cutoff the user already chose when the modal is reopened', async () => {
    const fixture = await render();
    fixture.componentInstance.BuildCutoffDate = '2026-07-15';
    const input = await openModal(fixture);

    expect(fixture.componentInstance.BuildCutoffDate).toBe('2026-07-15');
    expect(previewCalls.map(c => c.Cutoff)).toEqual(['2026-07-15']);
    expect(input.value).toBe('2026-07-15');
  });
});
