/** TIER 4 (4e) — the "not built yet" shell placeholder page. Presentational (@Input PageName). */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ShellPagePendingComponent } from '../../src/lib/custom/shell/pages/shell-page-pending.component';

describe('TIER 4: shell pending page (presentational)', () => {
  it('renders the page name with the "not built yet" suffix', () => {
    TestBed.configureTestingModule({ imports: [ShellPagePendingComponent] });
    const f = TestBed.createComponent(ShellPagePendingComponent);
    (f.componentInstance as unknown as { PageName: string }).PageName = 'Dimension P&L';
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Dimension P&L — not built yet');
  });
});
