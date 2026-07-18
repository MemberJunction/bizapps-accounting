/** TIER 4 (4c) — GL-resolution PREVIEW component. Pure presentational (@Input Result), no data path,
 *  so faked-input is the correct form. Proves the UI surfaces the engine's resolution result: the
 *  resolved code/name AND the "does not resolve" state + the chain steps. */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GlResolutionPreviewComponent } from '../../src/lib/custom/shared/gl-resolution-preview.component';

function render(result: unknown): HTMLElement {
  TestBed.configureTestingModule({ imports: [GlResolutionPreviewComponent] });
  const f = TestBed.createComponent(GlResolutionPreviewComponent);
  (f.componentInstance as unknown as { Result: unknown }).Result = result;
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('TIER 4: GL resolution preview (presentational)', () => {
  it('renders a RESOLVED result — role, resolved code + name, and a winning chain step', () => {
    const el = render({
      Role: 'Sales', ResolvedCode: '40100', ResolvedName: 'Sales Revenue',
      Chain: [{ Scope: 'Product', AccountCode: '40100', AccountName: 'Sales Revenue', Won: true }],
    });
    expect(el.querySelector('.glr__role')?.textContent).toContain('Sales');
    expect(el.querySelector('.glr__mono')?.textContent).toContain('40100');
    expect(el.textContent).toContain('resolves to');
    expect(el.querySelector('.glr--unresolved'), 'resolved result is NOT the unresolved variant').toBeNull();
  });

  it('renders an UNRESOLVABLE result — the "does not resolve" state', () => {
    const el = render({ Role: 'Deferred Revenue', ResolvedCode: null, ResolvedName: null, Chain: [{ Scope: 'Product', AccountCode: null, AccountName: null, Won: false }] });
    expect(el.querySelector('.glr--unresolved'), 'unresolved variant rendered').not.toBeNull();
    expect(el.querySelector('.glr__none')?.textContent).toContain('does not resolve');
  });
});
