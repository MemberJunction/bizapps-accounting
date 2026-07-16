/**
 * TIER 4 setup — headless Angular under jsdom, zoneless, with the console-error keystone.
 *
 * Self-contained ON PURPOSE. MJ ships an equivalent (`vitest.dom.shared.ts` + the
 * `@memberjunction/ng-test-utils` package), but neither is consumable from an open app:
 * the preset is a ROOT-LEVEL file (not exported from any package) and `ng-test-utils` is
 * `"private": true` (never published). Inside a dev-linked instance we happen to sit in MJ's
 * workspace and could reach both — but bizapps-accounting is a STANDALONE repo, and a harness
 * that only runs when dev-linked is a harness that silently stops running in the app's own CI.
 * So we replicate the (small) preset here against PUBLIC packages only.
 *
 * Filed as a request to publish the DOM-test kit so open apps stop re-deriving it.
 */
import '@angular/compiler';
import { provideZonelessChangeDetection, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { platformBrowserTesting, BrowserTestingModule } from '@angular/platform-browser/testing';
import { beforeAll, beforeEach, afterEach, expect } from 'vitest';

/**
 * The keystone (mandatory per TEST-ARCHITECTURE tier 4): any console.error, Angular
 * ErrorHandler hit, or unhandled rejection during a render FAILS the test. This is what catches
 * the silent UI bug — a template that throws into a swallowed promise still renders "fine".
 */
const consoleErrors: string[] = [];
let originalConsoleError: typeof console.error;

class FailingErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    consoleErrors.push(`Angular ErrorHandler: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function onUnhandledRejection(reason: unknown): void {
  consoleErrors.push(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
}

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  process.on('unhandledRejection', onUnhandledRejection);
});

beforeEach(() => {
  consoleErrors.length = 0;
  originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    originalConsoleError(...args);
  };

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: ErrorHandler, useClass: FailingErrorHandler }],
  });

  // jsdom implements none of these; presentational components touch them in constructors.
  // WebRTC/getUserMedia/AudioContext are deliberately NOT stubbed — those are live-tested only.
  stubBrowserApis();
});

afterEach(() => {
  console.error = originalConsoleError;
  const captured = [...consoleErrors];
  consoleErrors.length = 0;

  expect(
    captured,
    `A component logged ${captured.length} error(s) while rendering. Tier 4's keystone treats these ` +
      `as failures — a silent console error is the classic "renders fine, is broken" UI bug:\n  ` +
      captured.join('\n  '),
  ).toEqual([]);
});

function stubBrowserApis(): void {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
  }

  if (!('IntersectionObserver' in globalThis)) {
    class IntersectionObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): [] {
        return [];
      }
    }
    Object.defineProperty(globalThis, 'IntersectionObserver', { writable: true, value: IntersectionObserverStub });
  }
}
