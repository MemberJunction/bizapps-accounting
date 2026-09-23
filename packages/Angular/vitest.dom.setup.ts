/**
 * Setup for `vitest.dom.config.ts`: zoneless Angular TestBed under jsdom.
 *
 * `@angular/compiler` is imported so the partial-compiled (Ivy) MJ libraries link under AOT.
 * Every spec gets `provideZonelessChangeDetection()`, so drive change detection explicitly with
 * `fixture.detectChanges()` / `await fixture.whenStable()`.
 */
import '@angular/compiler';
import { provideZonelessChangeDetection } from '@angular/core';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeEach } from 'vitest';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
});
