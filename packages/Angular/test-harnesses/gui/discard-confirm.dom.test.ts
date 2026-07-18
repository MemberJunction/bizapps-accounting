/** TIER 4 (4e) — discard-changes confirm dialog. Static presentation + Keep/Discard outputs. */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DiscardConfirmComponent } from '../../src/lib/transfer-pending/dialog-dismiss/discard-confirm.component';

describe('TIER 4: discard-confirm dialog (presentational)', () => {
  it('renders the discard prompt with Keep + Discard actions', () => {
    TestBed.configureTestingModule({ imports: [DiscardConfirmComponent] });
    const f = TestBed.createComponent(DiscardConfirmComponent);
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Discard your changes?');
    expect(text).toContain('Keep editing');
  });
});
