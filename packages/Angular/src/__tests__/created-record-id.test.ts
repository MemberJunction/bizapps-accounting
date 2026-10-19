import { describe, it, expect } from 'vitest';
import { CompositeKey } from '@memberjunction/core';
import { createdRecordId } from '../lib/custom/CompanySetup/created-record-id';

/**
 * Tier 1 for the key a just-created company is selected by.
 *
 * On MJ 6.1.x a new Accounting Company Profile (IsA MJ: Companies) comes back from its save with
 * `.ID` holding the browser's key, which was never written, while `PrimaryKey` holds the key the
 * server wrote. Selecting by `.ID` matched no row in the reload, so the new company was not selected.
 */
describe('createdRecordId', () => {
  const WRITTEN = '7F220478-2A4B-43C0-94F7-2F88E9727D22';
  const UNWRITTEN = 'c7afc84f-f956-4627-b4fd-1f84b176bffa';

  it('returns the key PrimaryKey carries, not the one .ID reports', () => {
    const record = { ID: UNWRITTEN, PrimaryKey: CompositeKey.FromKeyValuePair('ID', WRITTEN) };
    expect(createdRecordId(record)).toBe(WRITTEN);
  });

  it('returns null when the record carries no key, rather than the string "undefined"', () => {
    expect(createdRecordId({ PrimaryKey: new CompositeKey() })).toBeNull();
  });
});
