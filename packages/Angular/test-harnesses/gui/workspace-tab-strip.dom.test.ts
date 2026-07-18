/** TIER 4 (4e) — workspace tab strip. Presentation over the tab store (@Input Tabs/ActiveId). */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { WorkspaceTabStripComponent } from '../../src/lib/transfer-pending/workspace-tabs/workspace-tab-strip.component';

describe('TIER 4: workspace tab strip (presentational)', () => {
  it('renders a tab per input tab with its label + marks the active one', () => {
    TestBed.configureTestingModule({ imports: [WorkspaceTabStripComponent] });
    const f = TestBed.createComponent(WorkspaceTabStripComponent);
    const c = f.componentInstance as unknown as { Tabs: unknown[]; ActiveId: string };
    c.Tabs = [ { Id: 't1', Label: 'JE-1001', Dirty: false }, { Id: 't2', Label: 'JE-1002', Dirty: true } ];
    c.ActiveId = 't1';
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('.ws-tab__label')).map((n) => n.textContent?.trim());
    expect(labels).toEqual(['JE-1001', 'JE-1002']);
    expect(el.querySelector('.ws-tab--active'), 'the active tab is marked').not.toBeNull();
    expect(el.querySelector('.ws-tab__dirty'), 'the dirty tab shows the unsaved marker').not.toBeNull();
  });
});
