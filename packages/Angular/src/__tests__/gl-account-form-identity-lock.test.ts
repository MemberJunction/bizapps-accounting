/**
 * @fileoverview orders#112 — the GL Account form must agree with the server about what is editable.
 *
 * ── THE BUG THIS PINS ──
 *
 * `GLAccount.CompanyID` is NOT NULL with no default. The custom form registered over the generated one
 * via `@RegisterClass`, and the generated form's `CompanyID` field went with it — so the only control
 * that could set a company was never rendered. QA reported "there is no place to specify Company" and
 * then hit a NOT NULL failure on save. Both symptoms were that one omission.
 *
 * ── WHY THIS IS A CONTRACT TEST AND NOT A SNAPSHOT ──
 *
 * The fix is not just "render CompanyID". `GLAccountEntityServer.LOCKED_IDENTITY_FIELDS` freezes
 * CompanyID / Code / AccountType / CurrencyCode from the moment a record is created, so a plainly
 * editable control on a saved record offers an edit the server ALWAYS rejects — which is the first
 * version of this fix, and it was wrong. Asserting the template alone would not catch that.
 *
 * So this reads BOTH files and checks they agree:
 *
 *   · every locked field the form renders is gated on `!record.IsSaved`
 *   · every field the form renders that the server does NOT lock stays plainly editable
 *   · `CompanyID` is rendered at all — the original defect
 *
 * ── CONFIRMED IN THE BROWSER, 2026-08-28 ──
 *
 * Explorer at localhost:4341, a SAVED GL Account (4000 / Sales), read straight off the rendered form.
 * In view mode all seven fields are read-only, as expected. In EDIT mode:
 *
 *   Company        editable=false     <- locked
 *   Account Code   editable=false     <- locked
 *   Account Type   editable=false     <- locked
 *   Account Name   editable=true
 *   Parent Account editable=true
 *   Is Active      editable=true
 *   Description    editable=true
 *
 * Which is LOCKED_IDENTITY_FIELDS exactly, and Company is rendered at all — the omission the issue was
 * filed for. The checks below are what keep that true; the browser run is what proved it once.
 *
 * That way the test fails if someone adds a locked field to the form without gating it, if the server's
 * locked list grows and the form is not updated, or if a cosmetic field is gated by mistake and made
 * uneditable for no reason. A snapshot would catch none of those; it would just need re-blessing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORM = join(
    __dirname,
    '..',
    'lib/custom/GLAccount/gl-account-form.component.html',
);
const SERVER = join(
    __dirname,
    '../../../CoreEntitiesServer/src/GLAccountEntityServer.ts',
);

/** The server's own list, read from the source rather than restated here. */
function lockedFieldsFromServer(): string[] {
    const src = readFileSync(SERVER, 'utf8');
    const m = src.match(/LOCKED_IDENTITY_FIELDS[^=]*=\s*\[([^\]]+)\]/);
    expect(m, 'LOCKED_IDENTITY_FIELDS must be findable in GLAccountEntityServer').toBeTruthy();
    return (m as RegExpMatchArray)[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
}

/** Each `mj-form-field` in the template, as { field, editModeBinding }. */
function formFields(): Array<{ field: string; editMode: string }> {
    const html = readFileSync(FORM, 'utf8');
    const out: Array<{ field: string; editMode: string }> = [];
    // Tags can span lines, so match the whole element then pull its attributes.
    for (const tag of html.match(/<mj-form-field[\s\S]*?><\/mj-form-field>/g) ?? []) {
        const field = tag.match(/FieldName="([A-Za-z]+)"/)?.[1];
        const editMode = tag.match(/\[EditMode\]="([^"]*)"/)?.[1];
        if (field) {
            out.push({ field, editMode: editMode ?? '' });
        }
    }
    return out;
}

describe('#112 — the GL Account form agrees with the server about editability', () => {
    it('renders CompanyID at all — the omission that caused the issue', () => {
        const names = formFields().map((f) => f.field);
        expect(
            names,
            'CompanyID is NOT NULL with no default; without a control for it the record cannot be saved',
        ).toContain('CompanyID');
    });

    it('gates every LOCKED field it renders on !record.IsSaved', () => {
        const locked = lockedFieldsFromServer();
        expect(locked.length, 'the server must declare some locked fields').toBeGreaterThan(0);

        const offenders = formFields()
            .filter((f) => locked.includes(f.field))
            .filter((f) => !f.editMode.includes('!record.IsSaved'));

        expect(
            offenders.map((o) => `${o.field} -> [EditMode]="${o.editMode}"`),
            'these fields are frozen by GLAccountEntityServer.ValidateAsync once IsSaved, so an '
            + 'ungated control offers an edit the server always rejects',
        ).toEqual([]);
    });

    it('leaves the fields the server does NOT lock plainly editable', () => {
        const locked = lockedFieldsFromServer();

        // The mirror of the check above, and the reason it exists: over-gating is as wrong as
        // under-gating. Name, Description and IsActive are explicitly cosmetic and stay editable
        // for the life of the account — that is what makes deactivation and renaming possible.
        const overGated = formFields()
            .filter((f) => !locked.includes(f.field))
            .filter((f) => f.editMode.includes('!record.IsSaved'));

        expect(
            overGated.map((o) => o.field),
            'these are not locked by the server, so freezing them on the form removes an edit the '
            + 'server would have accepted',
        ).toEqual([]);
    });

    it('does not offer to CREATE a company from the account form', () => {
        const html = readFileSync(FORM, 'utf8');
        const companyTag = (html.match(/<mj-form-field[\s\S]*?><\/mj-form-field>/g) ?? [])
            .find((t) => /FieldName="CompanyID"/.test(t));
        expect(companyTag, 'the CompanyID field must exist').toBeTruthy();
        expect(
            companyTag as string,
            'the picker otherwise offers Create "<text>" — creating a COMPANY as a side effect of '
            + 'adding a GL account is not something this form should permit',
        ).toMatch(/\[AllowFKCreate\]="false"/);
    });
});
