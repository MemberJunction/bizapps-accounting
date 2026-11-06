/**
 * Who may move a company's two posting cutoffs on its Accounting Company Profile: the holders of an
 * MJ Authorization each, granted to the Finance role in metadata/ (bc-aidp-next-golive#316, #447).
 * Shared by the profile's server entity (the authority) and the Periods page (browser, which only
 * decides what shows).
 *
 *   - BooksClosedThroughDate: closing a month moves it forward, reopening one moves it back.
 *   - PostingStartDate: moving it earlier puts the entries dated before it into batches; moving it
 *     later holds them back. Either is as consequential as reopening a month.
 */
import { AuthorizationEvaluator, type AuthorizationInfo, type UserInfo } from '@memberjunction/core';

/** Set or move a company's BooksClosedThroughDate. Held by the Finance role. */
export const BOOKS_CLOSED_THROUGH_SET_AUTH = 'MJ.BizApps.Accounting.BooksClosedThroughDate.Set';

/** Set, move or clear a company's PostingStartDate. Held by the Finance role. */
export const POSTING_START_DATE_SET_AUTH = 'MJ.BizApps.Accounting.PostingStartDate.Set';

/**
 * True when `user` holds the Authorization named `authName`, directly or through an ancestor. Fails
 * closed: an Authorization missing from `catalog` is held by nobody.
 */
function userHolds(authName: string, user: UserInfo | null | undefined, catalog: AuthorizationInfo[] | null | undefined): boolean {
  if (!user) return false;
  const auths = catalog ?? [];
  const auth = auths.find(a => a.Name === authName);
  return !!auth && new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, auths);
}

/** True when `user` may set or move a company's BooksClosedThroughDate. */
export function UserCanSetBooksClosedThroughDate(user: UserInfo | null | undefined, catalog: AuthorizationInfo[] | null | undefined): boolean {
  return userHolds(BOOKS_CLOSED_THROUGH_SET_AUTH, user, catalog);
}

/** True when `user` may set, move or clear a company's PostingStartDate. */
export function UserCanSetPostingStartDate(user: UserInfo | null | undefined, catalog: AuthorizationInfo[] | null | undefined): boolean {
  return userHolds(POSTING_START_DATE_SET_AUTH, user, catalog);
}
