/**
 * @fileoverview The guard that would have caught bizapps-contracts PR #59, for vwJournalEntries.
 *
 * `vwJournalEntries` had no guard of any kind, is defined with `DROP VIEW` + `CREATE VIEW`, and its
 * seven derived columns include an AGGREGATE JOIN — the one shape where a lost predicate is both
 * invisible and arithmetically wrong. It has been re-created four times already (the schema dump,
 * the CodeGen scoped-objects run, the GLAccountRole cardinality change, the engine extension) and
 * went layered on the fifth, so re-typing it is the established habit here rather than a risk.
 *
 * Three assertions, and they fail for different reasons on purpose.
 *
 * 1. THE NEWEST DEFINER IS THE ONE WE THINK IT IS. `newestViewDefiner` matches any DDL naming the
 *    view and throws if a later migration carries view DDL naming it without matching. The previous
 *    generation of these guards matched only `CREATE OR ALTER VIEW`; every definer in this repo's
 *    history uses `DROP` + `CREATE`, so such a selector would have resolved NOTHING here and any
 *    guard built on it would have been green and empty from the first day.
 *
 * 2. THE LOAD-BEARING PREDICATES SURVIVE. Curated, because only a person knows which ones carry
 *    meaning. The aggregate's `LEFT OUTER JOIN`, its `GROUP BY`, and the `ISNULL(..., 0)` wrappers
 *    are each a silent numeric defect when dropped — not an error, a different number.
 *
 * 3. A RE-CREATION MAY ADD COLUMNS BUT NEVER DROP ONE. Cheap and needs no curation.
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
    derivedColumns,
    newestViewDefiner,
    producedColumns,
    readMigration,
    viewBody,
} from './helpers/view-definer.js';

const MIGRATIONS = fileURLToPath(new URL('../../../../migrations', import.meta.url));

/**
 * Predicates that must survive every re-creation, per view. Matched against the view's own body
 * with comments stripped, so a copied comment block cannot satisfy one — and this file's SQL has a
 * long explanatory comment block sitting directly above the expression it describes, which is
 * exactly the text a stale retype copies forward without the code.
 */
const REQUIRED: Record<string, RegExp[]> = {
    vwJournalEntries: [
        // The outer view must read the CodeGen base view, never the JournalEntry table. Reaching
        // past it means restating the seven FK display joins, and a foreign key added later then
        // loses its display column by being ABSENT rather than wrong.
        /FROM\s+\[\$\{flyway:defaultSchema\}\]\.\[vwJournalEntriesGenerated\]/i,
        // ANOMALYOUTCOME IS THREE DISJUNCTS UNDER ONE COLUMN NAME, which makes it the precise shape
        // #59 destroyed: drop any one and rows silently reclassify to 'Normal'. Nothing errors,
        // nothing changes type, and the model retrains on a quietly different label.
        /g\.ReversesJournalEntryID\s+IS\s+NOT\s+NULL/i,
        /g\.ReversedByJournalEntryID\s+IS\s+NOT\s+NULL/i,
        /\(\s*g\.LinkedRecordID\s+IS\s+NULL\s+AND\s+g\.LinkedEntityID\s+IS\s+NULL\s*\)/i,
        // THE AGGREGATE MUST STAY AN OUTER JOIN. An INNER join here does not change a number, it
        // DELETES ROWS: every journal entry with no lines disappears from the view entirely, which
        // reads as clean data rather than as missing data.
        /LEFT\s+OUTER\s+JOIN\s*\(\s*SELECT/i,
        // GROUP BY is what makes it one row per entry. Without it the join fans out over every
        // line and TotalDebitAmount, LineCount and every inherited column multiply with it.
        /GROUP\s+BY\s+jel\.JournalEntryID/i,
        /SUM\(\s*jel\.DebitAmount\s*\)/i,
        // ISNULL is the difference between "this entry has no lines" and "unknown". Dropped, a
        // line-less entry reports NULL, and NULL silently poisons every SUM and comparison
        // downstream instead of contributing zero.
        /ISNULL\(\s*agg\.TotalDebitAmount\s*,\s*0\s*\)/i,
        /ISNULL\(\s*agg\.LineCount\s*,\s*0\s*\)/i,
        // IsWeekend names the Saturday/Sunday pair explicitly because DATEPART(weekday) is
        // DATEFIRST-dependent. A re-creation that "tidies" the set to (6, 7) is a one-character
        // diff that mislabels every row.
        /DATEPART\(\s*weekday\s*,\s*g\.EffectiveDate\s*\)\s+IN\s*\(\s*1\s*,\s*7\s*\)/i,
    ],
};

describe('layered views: the newest definer is resolvable and loses nothing', () => {
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

            it('drops no column a previous definer produced', () => {
                const { chain } = newestViewDefiner(MIGRATIONS, view);
                if (chain.length < 2) return;
                const previous = chain[chain.length - 2];
                const before = derivedColumns(viewBody(readMigration(MIGRATIONS, previous), view));
                const now = producedColumns(MIGRATIONS, view);
                const lost = before.filter((column) => !now.includes(column));
                expect(lost, `columns ${previous} produced and the newest definer does not`).toEqual([]);
            });
        });
    }
});
