import { describe, expect, it } from 'vitest';
import { SaveErrorMessage } from '../lib/custom/shared/save-error-message';

/** A failed save never puts database text on screen (#383). */
describe('SaveErrorMessage', () => {
  const FALLBACK = 'The account was not saved. Try again.';

  it('returns the fallback for an empty message', () => {
    expect(SaveErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(SaveErrorMessage('  ', FALLBACK)).toBe(FALLBACK);
  });

  it.each([
    ['FK_GLAccount_Company', /owning company no longer exists/],
    ['UQ_GLAccount_CompanyID_Code', /already uses this code/],
    ['FK_GLAccount_Parent', /parent account no longer exists/],
    ['CK_GLAccount_NoSelfParent', /cannot be its own parent/],
    ['FK_ACP_ApprovalCFOUser', /selected user no longer exists/],
  ])('turns %s into a sentence', (constraint, sentence) => {
    const raw = `The INSERT statement conflicted with the constraint "${constraint}". Query: EXEC spCreateGLAccount @Code='4000'`;
    const shown = SaveErrorMessage(raw, FALLBACK);
    expect(shown).toMatch(sentence);
    expect(shown).not.toContain(constraint);
  });

  it.each([
    'The UPDATE statement conflicted with the CHECK constraint "CK_Some_Rule". The conflict occurred in database "X", table "Y".',
    "Violation of UNIQUE KEY constraint 'UQ_Other'. Cannot insert duplicate key in object 'Z'.",
    'Error executing spUpdateAccountingCompanyProfile',
    "String or binary data would be truncated in table 'GLAccount', column 'Name'.",
  ])('hides other database text behind the fallback: %s', (raw) => {
    expect(SaveErrorMessage(raw, FALLBACK)).toBe(FALLBACK);
  });

  it('keeps a plain sentence, first line only, and never what follows Query:', () => {
    expect(SaveErrorMessage('Account no longer exists.', FALLBACK)).toBe('Account no longer exists.');
    expect(SaveErrorMessage('Code is required.\nName is required.', FALLBACK)).toBe('Code is required.');
    expect(SaveErrorMessage('Query: SELECT 1', FALLBACK)).toBe(FALLBACK);
  });
});
