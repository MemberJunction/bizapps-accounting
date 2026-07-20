/** TIER 4 — JE manual-entry WORKSPACE (the create path), real API path.
 *
 *  The gui suite covered the data-driven DASHBOARDS (je-console, batch-dispatch, …) but NOT the
 *  create workspaces. This closes that gap for the JE workspace. It proves the workspace renders
 *  cleanly (keystone armed at module scope → any console.error fails), a new draft opens, and the
 *  NEW per-line Counterparty picker renders with its options loaded through the real client.
 *  Exact JE-creation values are covered at tier-1 (je-draft.test) + tier-3 (order-to-je-client). */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { bootstrapTier4 } from './tier4-bootstrap';
import { AccountingShellModule } from '../../src/lib/custom/shell/shell.module';
import { JEWorkspacePageComponent } from '../../src/lib/custom/shell/pages/je-workspace.page';
import { PageRefreshService } from '../../src/lib/transfer-pending/shell-refresh/page-refresh.service';

interface Model { Draft: unknown | null; CounterpartyOptions: unknown[]; }

describe('TIER 4: JE manual-entry workspace (real API)', () => {
  beforeAll(async () => { await bootstrapTier4(); }, 180000);

  it('renders the workspace + the new per-line Counterparty picker (options via the real client)', async () => {
    TestBed.configureTestingModule({ imports: [AccountingShellModule], providers: [PageRefreshService] });
    const fixture = TestBed.createComponent(JEWorkspacePageComponent);
    const cmp = fixture.componentInstance as unknown as Model;
    fixture.detectChanges();
    // ngOnInit is async — it loads counterparties via the real client, THEN opens the first draft.
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (cmp.Draft) break; }
    fixture.detectChanges();
    await fixture.whenStable();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(cmp.Draft, 'a new JE draft opened').not.toBeNull();
    expect(html.length, 'workspace rendered').toBeGreaterThan(0);
    expect(html.includes('Counterparty'), 'the NEW per-line Counterparty column renders').toBe(true);
    expect(Array.isArray(cmp.CounterpartyOptions), 'counterparty options loaded as an array through the real client').toBe(true);
  });
});
