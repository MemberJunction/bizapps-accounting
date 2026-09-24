/**
 * Setup for `vitest.dom.config.ts`: zoneless Angular TestBed under jsdom, plus an error guard.
 *
 * `@angular/compiler` is imported so the partial-compiled (Ivy) MJ libraries link under AOT.
 * Every spec gets `provideZonelessChangeDetection()`, so drive change detection explicitly with
 * `fixture.detectChanges()` / `await fixture.whenStable()`.
 */
import '@angular/compiler';
import { ErrorHandler, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach, expect } from 'vitest';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// ── Error guard: fail any test that surfaces an error through console.error, Angular's
// ErrorHandler, or an unhandled promise rejection. A component that catches and logs renders an
// empty state that a spec inspecting some other part of the page would otherwise pass over; async
// component errors route through the ErrorHandler or a rejection, not console.error, so all three
// channels are watched.
let errors: string[] = [];
const describeError = (channel: string, detail: unknown): string =>
  `[${channel}] ${detail instanceof Error ? (detail.stack ?? detail.message) : String(detail)}`;

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]): void => {
  errors.push(describeError('console.error', args.map(a => (a instanceof Error ? a.stack ?? a.message : String(a))).join(' ')));
  originalConsoleError(...args);
};
process.on('unhandledRejection', (reason: unknown) => errors.push(describeError('unhandledRejection', reason)));

class GuardErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    errors.push(describeError('ErrorHandler', error));
  }
}

beforeEach(() => {
  errors = [];
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: ErrorHandler, useClass: GuardErrorHandler }],
  });
});

afterEach(async () => {
  // Let a pending rejection surface before asserting.
  await new Promise(resolve => setTimeout(resolve, 0));
  const seen = errors;
  errors = [];
  expect(seen, `error(s) surfaced during the test:\n${seen.join('\n')}`).toHaveLength(0);
});
