import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IsKnownTimeZone } from '@mj-biz-apps/common-entities';

/**
 * The scheduled jobs' `Timezone` is load-bearing, and nothing else in the suite notices if it moves.
 *
 * `resolveCutoff` reads the BUSINESS day at the firing instant. If a job fires on a clock that has
 * not rolled over into that day yet, the cutoff lands a day early — and for PriorMonth that means
 * the month being closed is skipped entirely and waits for the next month's run (all of August
 * posting in October). That is the state this branch originally shipped in: cron on UTC, cutoff on
 * Central.
 *
 * The unit tests beside this one pin `resolveCutoff` at the instants these jobs fire, but they
 * hardcode those instants — flip `Timezone` back to UTC and they would all still pass while the
 * product silently skipped a month. This file is the guard: it reads the committed job metadata and
 * fails if the two jobs stop agreeing on a zone, or name one the runtime cannot resolve.
 *
 * What it deliberately does NOT assert is a specific zone. These rows ship to every deployment, and
 * the correct value is whichever zone that instance sets as `BizApps.BusinessTimeZone` — the same
 * reason OwnerUserID/NotifyUserID stay NULL in these files. A host in another zone changes it.
 */
const JOBS = [
    '.accounting-post-orders-payments-nightly.json',
    '.accounting-post-subscriptions-monthly.json',
] as const;

const jobFields = (file: string): { CronExpression: string; Timezone: string } => {
    const path = resolve(__dirname, '../../../../metadata/scheduled-jobs', file);
    const [record] = JSON.parse(readFileSync(path, 'utf8')) as Array<{ fields: { CronExpression: string; Timezone: string } }>;
    return record.fields;
};

describe('the posting jobs schedule on the business clock, not UTC', () => {
    it('both jobs name the same time zone', () => {
        const zones = JOBS.map((f) => jobFields(f).Timezone);
        expect(new Set(zones).size).toBe(1);
    });

    it('the zone is one the runtime can actually resolve', () => {
        for (const file of JOBS) {
            expect(IsKnownTimeZone(jobFields(file).Timezone)).toBe(true);
        }
    });

    it('each job still declares a six-field cron, seconds first', () => {
        for (const file of JOBS) {
            expect(jobFields(file).CronExpression.trim().split(/\s+/)).toHaveLength(6);
        }
    });
});
