/**
 * Who may move the profile's posting cutoffs (bc-aidp-next-golive#316, #447): one Authorization each,
 * shared by the profile's server entity and the Periods page.
 */
import { describe, it, expect } from 'vitest';
import type { AuthorizationInfo, UserInfo } from '@memberjunction/core';
import {
  BOOKS_CLOSED_THROUGH_SET_AUTH,
  POSTING_START_DATE_SET_AUTH,
  UserCanSetBooksClosedThroughDate,
  UserCanSetPostingStartDate,
} from '../profile-date-authorizations.js';

const FINANCE = { ID: 'U-FINANCE' } as UserInfo;
const OTHER = { ID: 'U-OTHER' } as UserInfo;

function catalog(...names: string[]): AuthorizationInfo[] {
  return names.map((Name, i) => ({ ID: `AUTH-${i}`, Name, ParentID: null, UserCanExecute: (u: UserInfo) => u.ID === FINANCE.ID })) as unknown as AuthorizationInfo[];
}

describe('UserCanSetPostingStartDate', () => {
  it('is true for a holder and false for anyone else', () => {
    expect(UserCanSetPostingStartDate(FINANCE, catalog(POSTING_START_DATE_SET_AUTH))).toBe(true);
    expect(UserCanSetPostingStartDate(OTHER, catalog(POSTING_START_DATE_SET_AUTH))).toBe(false);
  });

  it('fails closed without the Authorization in the catalog, or without a user', () => {
    expect(UserCanSetPostingStartDate(FINANCE, catalog(BOOKS_CLOSED_THROUGH_SET_AUTH))).toBe(false);
    expect(UserCanSetPostingStartDate(FINANCE, undefined)).toBe(false);
    expect(UserCanSetPostingStartDate(null, catalog(POSTING_START_DATE_SET_AUTH))).toBe(false);
  });
});

describe('UserCanSetBooksClosedThroughDate', () => {
  it('reads its own Authorization, not the posting-start one', () => {
    expect(UserCanSetBooksClosedThroughDate(FINANCE, catalog(BOOKS_CLOSED_THROUGH_SET_AUTH))).toBe(true);
    expect(UserCanSetBooksClosedThroughDate(FINANCE, catalog(POSTING_START_DATE_SET_AUTH))).toBe(false);
    expect(UserCanSetBooksClosedThroughDate(OTHER, catalog(BOOKS_CLOSED_THROUGH_SET_AUTH))).toBe(false);
  });
});
