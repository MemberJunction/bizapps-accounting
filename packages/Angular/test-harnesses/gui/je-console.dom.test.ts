/** TIER 4 — Journal Entries console dashboard, real API path. Proves it loads JEs through the real
 *  client and renders cleanly. Exact JE values are tier-2/3's job; here: data path + clean render. */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { JournalEntryConsoleModule } from '../../src/lib/custom/JournalEntryConsole/je-console.module';
import { JournalEntryConsoleDashboardComponent } from '../../src/lib/custom/JournalEntryConsole/je-console-dashboard.component';

interface Model { IsLoading?: boolean; LoadError: string | null; AllEntries: Array<{ ID?: string }>; }

describe('TIER 4: Journal Entries console (real API)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);
  it('loads journal entries through the real client and renders cleanly', async () => {
    TestBed.configureTestingModule({ imports: [JournalEntryConsoleModule] });
    const fixture = TestBed.createComponent(JournalEntryConsoleDashboardComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    fixture.detectChanges();
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (cmp.LoadError !== null) break; if (i > 3 && cmp.IsLoading === false) break; }
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.LoadError, `LoadError: ${cmp.LoadError}`).toBeNull();
    expect((fixture.nativeElement as HTMLElement).innerHTML.length).toBeGreaterThan(0);
    expect(Array.isArray(cmp.AllEntries), 'AllEntries loaded as an array through the real client').toBe(true);
    expect(cmp.AllEntries.every((e) => e == null || typeof e === 'object'), 'entries well-formed').toBe(true);
  });
});
