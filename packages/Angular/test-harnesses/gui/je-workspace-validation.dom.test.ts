/** TIER 4 — JE workspace INPUT VALIDATION (the everyday-use gate).
 *
 *  The golden-path campaign's bar: the FRONTEND must allow only valid input (block/disable invalid)
 *  AND the engine must enforce the same rules. Tier-1 (je-draft.test) proves the pure gate LOGIC;
 *  tier-3 (engine-op-client) proves the ENGINE rejects bad drafts. This tier proves the missing
 *  middle: the real FORM COMPONENT actually WIRES the gate (the Create button is truly disabled on
 *  invalid input) and STRUCTURALLY prevents bad accounts (the picker only offers the company's active
 *  accounts, so a cross-company / inactive / unknown account is unbuildable — never even submittable).
 *
 *  Read-only: it drives the in-memory draft and reads demo accounts for the picker; it NEVER submits,
 *  so it creates no JE and mutates no shared data (CO1–CO3 untouched). Structured as ONE test (one
 *  component) — the tier-4 harness reconfigures the TestBed per test, so a file uses one component.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { Metadata } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';
import { bootstrapTier4 } from './tier4-bootstrap';
import { AccountingShellModule } from '../../src/lib/custom/shell/shell.module';
import { JEWorkspacePageComponent } from '../../src/lib/custom/shell/pages/je-workspace.page';
import { PageRefreshService } from '../../src/lib/transfer-pending/shell-refresh/page-refresh.service';

describe('TIER 4: JE workspace INPUT VALIDATION (frontend gate + structural prevention)', () => {
  let companyId = '';
  let acctA = '';
  let acctB = '';

  beforeAll(async () => {
    await bootstrapTier4();
    // Load the engine's GL-account cache (the picker's source) — read-only demo data.
    const provider = Metadata.Provider;
    await AccountingEngineBase.Instance.Config(false, provider.CurrentUser, provider);
    const active = AccountingEngineBase.Instance.GLAccounts.filter((a) => a.IsActive);
    const byCompany = new Map<string, string[]>();
    for (const a of active) {
      const arr = byCompany.get(a.CompanyID) ?? [];
      arr.push(a.ID);
      byCompany.set(a.CompanyID, arr);
    }
    for (const [cid, ids] of byCompany) {
      if (ids.length >= 2) { companyId = cid; acctA = ids[0]; acctB = ids[1]; break; }
    }
  }, 180000);

  it('blocks every invalid-input class + lets valid input through, and scopes the account picker', async () => {
    expect(companyId, 'a demo company with >= 2 active accounts must exist for the valid-input cases').not.toBe('');

    TestBed.configureTestingModule({ imports: [AccountingShellModule], providers: [PageRefreshService] });
    const fixture: ComponentFixture<JEWorkspacePageComponent> = TestBed.createComponent(JEWorkspacePageComponent);
    const cmp = fixture.componentInstance;
    fixture.detectChanges();
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (cmp.Draft) break; }
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cmp.Draft, 'a fresh draft opened').not.toBeNull();

    /** The real Create button; its `disabled` is bound to `!CanSubmit`, so it IS the frontend gate. */
    const createBtn = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.mj-btn--primary');
    const setLine = (i: number, glId: string | null, debit: string, credit: string) => {
      const l = cmp.Draft!.Lines[i];
      l.GLAccountID = glId; l.Debit = debit; l.Credit = credit;
    };
    /** Sync the draft + flush change detection so the button's [disabled] reflects CanSubmit. */
    const apply = async () => {
      cmp.touch();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const freshValid = async () => {
      cmp.openNewDraft();
      cmp.Draft!.CompanyID = companyId;
      cmp.OnCompanyChanged();
      setLine(0, acctA, '100', '');
      setLine(1, acctB, '', '100');
      await apply();
    };

    // ── 1. Fresh empty draft (no company, empty lines) → BLOCKED, button disabled ──
    cmp.openNewDraft();
    await apply();
    expect(cmp.CanSubmit, '[empty] not submittable').toBe(false);
    expect(cmp.SubmitBlockedReason, '[empty] a blocking reason is surfaced').toBeTruthy();
    expect(createBtn()?.disabled, '[empty] Create button disabled in the DOM').toBe(true);

    // ── 2. No company picked → accounts un-choosable, "pick a company" reason ──
    cmp.openNewDraft();
    cmp.Draft!.CompanyID = null;
    await apply();
    expect(cmp.AccountOptions.length, '[no-company] no accounts offered').toBe(0);
    expect(cmp.Issues.some((i) => /pick a company/i.test(i)), '[no-company] gate names it').toBe(true);
    expect(cmp.CanSubmit).toBe(false);

    // ── 3. Valid balanced entry → ENABLED (gate lets valid input through). NOT submitted. ──
    await freshValid();
    expect(cmp.Issues, '[valid] no blocking issues').toEqual([]);
    expect(cmp.IsBalanced, '[valid] balanced').toBe(true);
    expect(cmp.CanSubmit, '[valid] submittable').toBe(true);
    expect(createBtn()?.disabled, '[valid] Create button ENABLED in the DOM').toBe(false);

    // ── 4. Unbalanced (Dr 100 / Cr 50) → BLOCKED, strip says Not balanced ──
    await freshValid();
    setLine(1, acctB, '', '50');
    await apply();
    expect(cmp.IsBalanced, '[unbalanced] not balanced').toBe(false);
    expect(cmp.Issues.some((i) => /must equal credits/i.test(i)), '[unbalanced] gate names it').toBe(true);
    expect(cmp.CanSubmit).toBe(false);
    expect(createBtn()?.disabled, '[unbalanced] button disabled').toBe(true);
    expect((fixture.nativeElement as HTMLElement).innerHTML.includes('Not balanced'), '[unbalanced] live strip shows it').toBe(true);

    // ── 5. Fewer than two lines → BLOCKED ──
    await freshValid();
    cmp.RemoveLine(cmp.Draft!.Lines[1].Key);
    await apply();
    expect(cmp.Issues.some((i) => /two lines/i.test(i)), '[one-line] gate requires >= 2').toBe(true);
    expect(cmp.CanSubmit).toBe(false);
    expect(createBtn()?.disabled).toBe(true);

    // ── 6. Missing posting/effective date → BLOCKED ──
    await freshValid();
    cmp.Draft!.EffectiveDate = '';
    await apply();
    expect(cmp.Issues.some((i) => /date/i.test(i)), '[no-date] gate requires a date').toBe(true);
    expect(cmp.CanSubmit).toBe(false);
    expect(createBtn()?.disabled).toBe(true);

    // ── 7. Line missing its account → BLOCKED (can't submit a line with no account) ──
    await freshValid();
    setLine(0, null, '100', '');
    await apply();
    expect(cmp.Issues.some((i) => /account/i.test(i)), '[no-account] gate requires an account').toBe(true);
    expect(cmp.CanSubmit).toBe(false);

    // ── 8. STRUCTURAL: the picker offers ONLY the company's ACTIVE accounts (bad accounts unbuildable) ──
    cmp.openNewDraft();
    cmp.Draft!.CompanyID = companyId;
    cmp.OnCompanyChanged();
    await apply();
    const opts = cmp.AccountOptions;
    expect(opts.length, '[picker] the chosen company offers accounts').toBeGreaterThan(0);
    const all = AccountingEngineBase.Instance.GLAccounts;
    for (const o of opts) {
      const acct = all.find((a) => UUIDsEqual(a.ID, o.ID));
      expect(acct, `[picker] offered account ${o.ID} exists`).toBeTruthy();
      expect(UUIDsEqual(acct!.CompanyID, companyId), '[picker] account belongs to the picked company (no cross-company)').toBe(true);
      expect(acct!.IsActive, '[picker] account is active (no inactive offered)').toBe(true);
    }

    // ── 9. Changing the company CLEARS line accounts (no stale cross-company account survives) ──
    cmp.openNewDraft();
    cmp.Draft!.CompanyID = companyId;
    cmp.OnCompanyChanged();
    setLine(0, acctA, '100', '');
    await apply();
    expect(cmp.Draft!.Lines[0].GLAccountID, '[switch] account set first').toBe(acctA);
    cmp.Draft!.CompanyID = null;
    cmp.OnCompanyChanged();
    await apply();
    expect(cmp.Draft!.Lines.every((l) => l.GLAccountID === null), '[switch] accounts cleared on company change').toBe(true);
  });
});
