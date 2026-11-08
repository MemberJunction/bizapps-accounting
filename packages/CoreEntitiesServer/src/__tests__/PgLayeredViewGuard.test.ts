/**
 * @fileoverview The PostgreSQL half of `LayeredViewGuard.test.ts`, for vwJournalEntries.
 *
 * `LayeredViewGuard` reads `migrations/` only, so the PostgreSQL counterpart of #395 shipped the
 * weekday bug that migration exists to remove and nothing looked at it: the first conversion took
 * the T-SQL `DATEDIFF(day, '19000101', …)` literally as a `TIMESTAMPTZ` difference. A `DATE` cast
 * to `TIMESTAMPTZ` is midnight in the SESSION time zone, so across a daylight-saving boundary the
 * difference is N days plus or minus an hour, and `EXTRACT(DAY FROM interval)` keeps only the day
 * component — N - 1. Every weekday then shifts by one and Monday becomes the weekend, in any zone
 * with daylight saving (Europe/London in summer, America/New_York, …), never in UTC.
 *
 * The rule here: the weekday is read from the `DATE` itself (`EXTRACT(ISODOW FROM …)`), never from
 * a zoned timestamp or an interval. The view body is the dollar-quoted `$vsql$` text the converter
 * wraps every PostgreSQL view in, read from the newest migration that defines it, comments
 * stripped so the explanation above the expression cannot trip or satisfy anything.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { migrationFiles, sqlCode } from './helpers/view-definer.js';

const MIGRATIONS_PG = fileURLToPath(new URL('../../../../migrations-pg', import.meta.url));

/** Fragments that must never appear in the view's PostgreSQL body. */
const FORBIDDEN: Record<string, RegExp[]> = {
    vwJournalEntries: [
        // A zoned timestamp makes a calendar-day computation depend on the session time zone.
        /::\s*TIMESTAMPTZ\b/i,
        // The day component of an interval drops a day whenever the interval carries a DST hour.
        /EXTRACT\s*\(\s*DAY\s+FROM\s*\(/i,
    ],
};

/** The `$vsql$`-quoted CREATE VIEW text for `view` in one migration, or `undefined`. */
function pgViewBody(sql: string, view: string): string | undefined {
    const start = new RegExp(String.raw`\$vsql\$CREATE\s+OR\s+REPLACE\s+VIEW\s+(?:"[^"]+"\s*\.\s*)?"${view}"`, 'i');
    const match = start.exec(sql);
    if (match === null) return undefined;
    const end = sql.indexOf('$vsql$', match.index + '$vsql$'.length);
    return sql.slice(match.index + '$vsql$'.length, end < 0 ? sql.length : end);
}

/** The newest PostgreSQL migration that defines `view`, with its body. */
function newestPgDefiner(view: string): { file: string; body: string } | undefined {
    let newest: { file: string; body: string } | undefined;
    for (const file of migrationFiles(MIGRATIONS_PG)) {
        const body = pgViewBody(readFileSync(join(MIGRATIONS_PG, file), 'utf8'), view);
        if (body !== undefined) newest = { file, body: sqlCode(body) };
    }
    return newest;
}

describe('layered views on PostgreSQL: no fragment known to fail silently', () => {
    for (const [view, forbidden] of Object.entries(FORBIDDEN)) {
        it(`${view}: the newest definer computes weekdays from the date, not a zoned timestamp`, () => {
            const definer = newestPgDefiner(view);
            expect(definer, `no migrations-pg file defines ${view}`).toBeDefined();
            for (const pattern of forbidden) {
                expect(definer?.body, `${definer?.file} reintroduced ${pattern}`).not.toMatch(pattern);
            }
        });
    }
});
