/**
 * @fileoverview The guard that would have caught bizapps-contracts PR #59, for vwJournalEntries.
 *
 * `vwJournalEntries` had no guard of any kind, is defined with `DROP VIEW` + `CREATE VIEW`, and its
 * seven derived columns include an AGGREGATE JOIN — the one shape where a lost predicate is both
 * invisible and arithmetically wrong. It has been re-created four times already (the schema dump,
 * the CodeGen scoped-objects run, the GLAccountRole cardinality change, the engine extension) and
 * went layered on the fifth, so re-typing it is the established habit here rather than a risk.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT A CURATED PREDICATE IS ALLOWED TO BE. Adversarial review found the previous list failing in
 * BOTH directions, which is the worst place a guard can be: it passed semantics-breaking rewrites
 * and failed semantics-preserving ones.
 *
 * So only two kinds of thing are curated here, because only two kinds survive a legitimate rewrite:
 *
 *   - A STRING LITERAL. `'Anomalous'` is the same nine characters however the SQL around it is
 *     formatted, and it cannot be reformatted away. If it is gone, the meaning changed.
 *   - A REFERENCED OBJECT NAME, matched through `references()` — the selector's own name matcher, so
 *     bracketed, bare and `${...}`-qualified spellings are all the same name, because to the
 *     database they are.
 *
 * Everything that was SYNTAX is gone, each entry for a measured reason:
 *
 *   - `LEFT OUTER JOIN ( SELECT` and `GROUP BY jel.JournalEntryID` pinned join keywords and an
 *     alias. `LEFT JOIN` is the identical operator and renaming `jel` is a no-op to the database,
 *     yet both failed red.
 *   - `ISNULL(agg.TotalDebitAmount, 0)` pinned a function spelling AND an alias. `COALESCE` is the
 *     same answer here and was a red build.
 *   - `g.ReversesJournalEntryID IS NOT NULL` and its two siblings pinned an alias and a keyword
 *     order; bracketing the column or commuting the `OR`s changed nothing and failed.
 *   - `SUM(jel.DebitAmount)` — same alias problem, and the column it protects is already covered by
 *     `producedColumns`.
 *   - `DATEPART(weekday, g.EffectiveDate) IN (1, 7)` is DROPPED OUTRIGHT, and the comment that
 *     called it the safe form had it BACKWARDS. `DATEPART(weekday, …)` is the `DATEFIRST`-dependent
 *     expression: `1` means Sunday only when `@@DATEFIRST` is 7, which is the US English default
 *     and not a guarantee. The correct fix is a `@@DATEFIRST`-aware expression, and this predicate
 *     would have REJECTED it — a guard actively standing in the way of the repair.
 *   - `FROM \[\$\{flyway:defaultSchema\}\]\.\[vwJournalEntriesGenerated\]` pinned one spelling of a
 *     name CodeGen writes both ways.
 *
 * WHAT THIS DELIBERATELY NO LONGER CATCHES, so nobody is surprised: a rewrite that keeps every
 * literal and every object name but changes the aggregate's CARDINALITY — turning the outer join
 * inner so line-less entries vanish, or dropping the `GROUP BY` so the join fans out — passes here.
 * That is not an oversight, it is the price of a list that never fails correct work.
 * `producedColumns` covers the "a column vanished" half; the row-count half belongs to a test with
 * a database behind it, not to a regex over DDL.
 *
 * Four assertions, and they fail for different reasons on purpose.
 *
 * 1. THE NEWEST DEFINER IS THE ONE WE THINK IT IS. `newestViewDefiner` matches any DDL naming the
 *    view and throws if a later migration carries view DDL naming it without matching. The previous
 *    generation of these guards matched only `CREATE OR ALTER VIEW`; every definer in this repo's
 *    history uses `DROP` + `CREATE`, so such a selector would have resolved NOTHING here and any
 *    guard built on it would have been green and empty from the first day.
 *
 * 2. THE LOAD-BEARING LITERALS AND NAMES SURVIVE. Curated, because only a person knows which ones
 *    carry meaning. `AnomalyOutcome`'s two labels ARE its output vocabulary: rename either and
 *    every consumer that compares against `'Anomalous'` silently stops matching, with no error and
 *    no type change.
 *
 * 3. A FRAGMENT KNOWN TO FAIL SILENTLY NEVER COMES BACK — nothing is forbidden for this view today,
 *    and the assertion SKIPS out loud rather than passing on an empty list.
 *
 * 4. A RE-CREATION MAY ADD COLUMNS BUT NEVER DROP ONE. Cheap and needs no curation. Both sides of
 *    the comparison are read through `producedColumns`, so the columns inherited through `g.*` from
 *    the generated inner view are protected too — an alias-only BEFORE left every one of them free
 *    to disappear the moment a re-creation spelled the star out as an explicit list.
 *
 * There is no business-day assertion here: this view does not join `fnBusinessToday()`, and an
 * assertion about a predicate a view does not have would pass forever without reading anything.
 *
 * NOTE FOR WHOEVER READS A FAILURE: nothing in this repo's CI runs vitest. `build.yml` runs
 * `pnpm run build:packages` and `changes.yml` validates migration filenames and changesets; there
 * is no test step in any workflow. This file is only as good as a local `pnpm test` until that
 * changes.
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
    newestViewDefiner,
    producedColumns,
    references,
    viewBody,
} from './helpers/view-definer.js';

const MIGRATIONS = fileURLToPath(new URL('../../../../migrations', import.meta.url));

/**
 * Literals and object names that must survive every re-creation, per view. Matched against the
 * view's own body with comments stripped, so a copied comment block cannot satisfy one — and this
 * file's SQL has a long explanatory comment block sitting directly above the expression it
 * describes, which is exactly the text a stale retype copies forward without the code.
 *
 * String literals are matched CASE-SENSITIVELY: under a case-sensitive collation `'anomalous'` and
 * `'Anomalous'` are different values, so a guard that accepted either would be lying about which.
 */
const REQUIRED: Record<string, RegExp[]> = {
    vwJournalEntries: [
        // The outer view must read the CodeGen base view, never the JournalEntry table. Reaching
        // past it means restating the seven FK display joins, and a foreign key added later then
        // loses its display column by being ABSENT rather than wrong.
        references('vwJournalEntriesGenerated'),
        // TotalDebitAmount and LineCount are an aggregate over the LINES. Aggregate anything else
        // and both columns keep their names, their types and their plausibility while counting a
        // different population.
        references('JournalEntryLine'),
        // ANOMALYOUTCOME'S OUTPUT VOCABULARY. These two strings are the column's whole contract with
        // every consumer — a model trains on them, a filter compares against them. Change either
        // and nothing errors, nothing changes type, and every downstream comparison quietly stops
        // matching.
        /'Anomalous'/,
        /'Normal'/,
    ],
};

/**
 * Fragments that must NEVER appear, per view. Nothing qualifies for `vwJournalEntries` today: there
 * is no known-bad spelling this view has ever regressed to. The entry is ABSENT rather than empty,
 * and the assertion below skips rather than passing — an empty list would have been a green tick
 * over zero assertions.
 */
const FORBIDDEN: Record<string, RegExp[]> = {};

describe('layered views: the newest definer is resolvable and loses nothing', () => {
    /**
     * A forbidden entry that names a view nobody guards, or that is present but empty, asserts
     * nothing while looking like it does. Both are caught here rather than by a silently empty loop.
     */
    it('curates no forbidden list for a view this file does not guard', () => {
        for (const [view, forbidden] of Object.entries(FORBIDDEN)) {
            expect(REQUIRED[view], `FORBIDDEN names ${view}, which is not a guarded view`).toBeDefined();
            expect(forbidden, `FORBIDDEN[${view}] is empty — remove it or fill it in`).not.toEqual([]);
        }
    });

    for (const view of Object.keys(REQUIRED)) {
        describe(view, () => {
            it('resolves a newest definer, and nothing later redefines it unseen', () => {
                const definer = newestViewDefiner(MIGRATIONS, view);
                expect(definer.file).toBeTruthy();
                expect(definer.chain.length).toBeGreaterThan(0);
            });

            it('keeps every predicate that must survive a re-creation', () => {
                const { code, file } = newestViewDefiner(MIGRATIONS, view);
                const body = viewBody(code, view);
                expect(body, `${file} has no CREATE VIEW body for ${view}`).toBeTruthy();
                for (const required of REQUIRED[view]) {
                    expect(body, `${file} lost ${required}`).toMatch(required);
                }
            });

            it('never reintroduces a fragment known to fail silently', (context) => {
                const forbidden = FORBIDDEN[view];
                // NOT `?? []`. A view with no forbidden entry used to run this test with an empty
                // loop and report a PASS — a green tick standing for zero assertions, which on a
                // results page is indistinguishable from a check that actually ran.
                if (forbidden === undefined) {
                    context.skip(`nothing is forbidden for ${view}, so this asserts nothing`);
                    return;
                }
                const { code, file } = newestViewDefiner(MIGRATIONS, view);
                const body = viewBody(code, view);
                expect(body, `${file} has no CREATE VIEW body for ${view}`).toBeTruthy();
                for (const pattern of forbidden) {
                    expect(body, `${file} reintroduced ${pattern}`).not.toMatch(pattern);
                }
            });

            it('drops no column a previous definer produced', (context) => {
                const { chain } = newestViewDefiner(MIGRATIONS, view);
                // A view with a single definer has no BEFORE to compare a re-creation against. This
                // used to `return` quietly and report a pass, so the day someone consolidated the
                // history into one migration the column guard would have switched itself off with
                // nothing in the output to say so.
                if (chain.length < 2) {
                    context.skip(`${view} has one definer (${chain[0]}) — there is no BEFORE to compare`);
                    return;
                }
                const previous = chain[chain.length - 2];
                // BOTH SIDES ARE READ THE SAME WAY: own columns plus the ones inherited through
                // `g.*`, each measured as of the migration it belongs to. Comparing an alias-only
                // BEFORE against an inheritance-aware NOW left every inherited column unprotected —
                // a re-creation that replaced `g.*` with an explicit list minus one column passed.
                const before = producedColumns(MIGRATIONS, view, previous);
                expect(before, `${previous} produced no readable columns — this check is vacuous`).not.toEqual([]);
                const now = producedColumns(MIGRATIONS, view);
                const lost = before.filter((column) => !now.includes(column));
                expect(lost, `columns ${previous} produced and the newest definer does not`).toEqual([]);
            });
        });
    }
});
