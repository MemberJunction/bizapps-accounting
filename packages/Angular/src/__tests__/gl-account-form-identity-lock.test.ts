/**
 * @fileoverview orders#112 — the GL Account form must agree with the server, and must not silently
 * lose fields the generated form had.
 *
 * ── THE BUG THIS PINS ──
 *
 * `GLAccount.CompanyID` is NOT NULL with no default. The custom form registered over the generated one
 * via `@RegisterClass`, and the generated form's `CompanyID` field went with it — so the only control
 * that could set a company was never rendered. QA reported "there is no place to specify Company" and
 * then hit a NOT NULL failure on save. Both symptoms were that one omission.
 *
 * ── AND THE ROOT CAUSE IS THE MECHANISM, NOT THE FIELD ──
 *
 * `CompanyID` was not the only casualty. The custom form rendered 7 fields where the generated one has
 * 16. Restoring `CompanyID` alone fixed the reported symptom and left the same silent-drop mechanism in
 * place for the next regenerated field. `DELIBERATELY_OMITTED` below is the answer to that: every field
 * the generated form has and this one does not must be named there WITH a reason, so a dropped field is
 * a reviewed decision instead of an accident nobody sees.
 *
 * ── WHY THIS IS A CONTRACT TEST AND NOT A SNAPSHOT ──
 *
 * The fix is not just "render the fields". `GLAccountEntityServer.LOCKED_IDENTITY_FIELDS` freezes
 * CompanyID / Code / AccountType / CurrencyCode, so a plainly editable control on a saved record offers
 * an edit the server ALWAYS rejects — which is the first version of this fix, and it was wrong.
 *
 * But the lock is not uniform, and copying one gate to all four would be wrong in the other direction.
 * `ValidateAsync` skips a locked field whose OLD value was null:
 *
 *     if (oldValue === null || oldValue === undefined) return false;
 *
 * So for a NOT NULL locked field, "saved" and "has a value" coincide and `!record.IsSaved` is exact.
 * For a NULLABLE locked field it is too strict — it would permanently prevent setting a value the
 * server would accept. `CurrencyCode` is exactly that case, and every account on the recording host had
 * it null (18 of 18) precisely because the form never rendered it.
 *
 * ── CONFIRMED IN THE BROWSER, 2026-08-28 ──
 *
 * Explorer at localhost:4341, a SAVED GL Account (4000 / Sales), read straight off the rendered form.
 * In view mode all fields are read-only, as expected. In EDIT mode:
 *
 *   Company        editable=false     <- locked
 *   Account Code   editable=false     <- locked
 *   Account Type   editable=false     <- locked
 *   Account Name   editable=true
 *   Parent Account editable=true
 *   Is Active      editable=true
 *   Description    editable=true
 *
 * Re-run after restoring the three dropped fields, same saved account, ten fields now:
 *
 *   Currency            editable=TRUE   <- locked but NULL, so the server would accept a value
 *   External System     editable=true
 *   External Account ID editable=true
 *
 * Currency reading editable on a SAVED record is the point: a strict `!record.IsSaved` gate would have
 * rendered it false and frozen a field that has never had a value. The checks below keep that true; the
 * browser runs are what proved it twice.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORM = join(__dirname, '..', 'lib/custom/GLAccount/gl-account-form.component.html');
const GENERATED_FORM = join(
    __dirname,
    '..',
    'lib/generated/Entities/mjBizAppsAccountingGLAccount/mjbizappsaccountingglaccount.form.component.html',
);
const SERVER = join(__dirname, '../../../CoreEntitiesServer/src/GLAccountEntityServer.ts');
const ENTITY = join(__dirname, '../../../Entities/src/generated/entity_subclasses.ts');

/**
 * Fields the generated form offers that this form deliberately does NOT, each with the reason.
 *
 * Adding a name here is the whole point: it makes dropping a field a decision somebody wrote down and
 * a reviewer can disagree with, rather than something that happens silently when a custom form replaces
 * a generated one. If CodeGen adds a field tomorrow, the test fails until someone chooses.
 */
const DELIBERATELY_OMITTED: Record<string, string> = {
    IsSystemSeeded: 'system-managed; NOT NULL with a 0 default, and not a user decision',
    RootParentGLAccountID: 'hierarchy helper computed by the view, not an input',
    ParentGLAccountIDChildCount: 'hierarchy helper computed by the view, not an input',
    ParentGLAccountIDDepth: 'hierarchy helper computed by the view, not an input',
    ParentGLAccountIDIsLeaf: 'hierarchy helper computed by the view, not an input',
    ParentGLAccountIDPath: 'hierarchy helper computed by the view, not an input',
};

function lockedFieldsFromServer(): string[] {
    const src = readFileSync(SERVER, 'utf8');
    const m = src.match(/LOCKED_IDENTITY_FIELDS[^=]*=\s*\[([^\]]+)\]/);
    expect(m, 'LOCKED_IDENTITY_FIELDS must be findable in GLAccountEntityServer').toBeTruthy();
    return (m as RegExpMatchArray)[1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
}

/** Nullability straight off the generated entity class — `| null` on the getter means nullable. */
function isNullable(field: string): boolean {
    const src = readFileSync(ENTITY, 'utf8');
    const i = src.indexOf('class mjBizAppsAccountingGLAccountEntity');
    expect(i, 'the generated GLAccount entity class must exist').toBeGreaterThan(-1);
    const seg = src.slice(i, i + 60_000);
    const m = seg.match(new RegExp(`get ${field}\\(\\):\\s*([^\\{]+)\\{`));
    expect(m, `${field} must have a getter on the generated entity`).toBeTruthy();
    return /\|\s*null/.test((m as RegExpMatchArray)[1]);
}

function fieldsOf(file: string): Array<{ field: string; editMode: string }> {
    const html = readFileSync(file, 'utf8');
    const out: Array<{ field: string; editMode: string }> = [];
    for (const tag of html.match(/<mj-form-field[\s\S]*?><\/mj-form-field>/g) ?? []) {
        const field = tag.match(/FieldName="([A-Za-z]+)"/)?.[1];
        const editMode = tag.match(/\[EditMode\]="([^"]*)"/)?.[1];
        if (field) out.push({ field, editMode: editMode ?? '' });
    }
    return out;
}

const formFields = () => fieldsOf(FORM);

describe('#112 — the custom form keeps what the generated form had', () => {
    it('drops nothing without a written reason', () => {
        const mine = new Set(formFields().map((f) => f.field));
        const dropped = fieldsOf(GENERATED_FORM)
            .map((f) => f.field)
            .filter((f, i, a) => a.indexOf(f) === i)
            .filter((f) => !mine.has(f))
            .filter((f) => !(f in DELIBERATELY_OMITTED));

        expect(
            dropped,
            'this form REPLACES the generated one, so any field it does not render simply disappears — '
            + 'which is how #112 happened. Add each to DELIBERATELY_OMITTED with a reason, or render it.',
        ).toEqual([]);
    });

    it('renders CompanyID — the omission that caused the issue', () => {
        expect(
            formFields().map((f) => f.field),
            'CompanyID is NOT NULL with no default; without a control the record cannot be saved',
        ).toContain('CompanyID');
    });
});

describe('#112 — the form agrees with the server about editability', () => {
    it('gates NOT NULL locked fields on !record.IsSaved', () => {
        const strict = lockedFieldsFromServer().filter((f) => !isNullable(f));
        expect(strict.length, 'some locked fields should be NOT NULL').toBeGreaterThan(0);

        const offenders = formFields()
            .filter((f) => strict.includes(f.field))
            .filter((f) => !f.editMode.includes('!record.IsSaved'));

        expect(
            offenders.map((o) => `${o.field} -> [EditMode]="${o.editMode}"`),
            'frozen by ValidateAsync once IsSaved, so an ungated control offers an edit always rejected',
        ).toEqual([]);
    });

    it('gates NULLABLE locked fields on "creating OR still unset", not on IsSaved alone', () => {
        const lenient = lockedFieldsFromServer().filter((f) => isNullable(f));

        const wrong = formFields()
            .filter((f) => lenient.includes(f.field))
            .filter((f) => !f.editMode.includes(`!record.${f.field}`));

        expect(
            wrong.map((o) => `${o.field} -> [EditMode]="${o.editMode}"`),
            'ValidateAsync skips a locked field whose OLD value was null, so freezing these on save '
            + 'permanently prevents setting a value the server would accept — CurrencyCode is exactly '
            + 'that case, and it is why 18 of 18 accounts had none',
        ).toEqual([]);
    });

    it('leaves the fields the server does NOT lock plainly editable', () => {
        const locked = lockedFieldsFromServer();
        const overGated = formFields()
            .filter((f) => !locked.includes(f.field))
            .filter((f) => f.editMode.includes('!record.IsSaved'));

        expect(
            overGated.map((o) => o.field),
            'not locked by the server, so freezing them removes an edit the server would have accepted',
        ).toEqual([]);
    });

    it('renders the remap pair the server tells users to use', () => {
        // GLAccountEntityServer refuses an identity change with "Remap via
        // ExternalSystem/ExternalAccountID". That advice is impossible to follow if the form does not
        // render them — which it did not.
        const names = formFields().map((f) => f.field);
        expect(names).toContain('ExternalSystem');
        expect(names).toContain('ExternalAccountID');
    });

    it('does not offer to CREATE a company from the account form', () => {
        const companyTag = (readFileSync(FORM, 'utf8').match(/<mj-form-field[\s\S]*?><\/mj-form-field>/g) ?? [])
            .find((t) => /FieldName="CompanyID"/.test(t));
        expect(companyTag, 'the CompanyID field must exist').toBeTruthy();
        expect(
            companyTag as string,
            'the picker otherwise offers Create "<text>" — creating a COMPANY as a side effect of '
            + 'adding a GL account is not something this form should permit',
        ).toMatch(/\[AllowFKCreate\]="false"/);
    });
});
