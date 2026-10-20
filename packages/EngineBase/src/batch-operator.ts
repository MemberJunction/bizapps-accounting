/**
 * Who may build, regenerate, dispatch or archive a journal entry batch (#448): the holders of one MJ
 * Authorization, granted to the Finance role in metadata/. Shared by the batch Remote Operations
 * (server, the authority) and the batch screens (browser, which only decide what shows).
 */
import { AuthorizationEvaluator, type AuthorizationInfo, type UserInfo } from '@memberjunction/core';

/** The Authorization the batch operations require. Held by the Finance role. */
export const JOURNAL_ENTRY_BATCH_OPERATE_AUTH = 'MJ.BizApps.Accounting.JournalEntryBatches.Operate';

/**
 * True when `user` holds {@link JOURNAL_ENTRY_BATCH_OPERATE_AUTH}, directly or through an ancestor.
 * Fails closed: an Authorization missing from `catalog` is held by nobody.
 */
export function UserCanOperateJournalEntryBatches(user: UserInfo | null | undefined, catalog: AuthorizationInfo[] | null | undefined): boolean {
  if (!user) return false;
  const auths = catalog ?? [];
  const auth = auths.find(a => a.Name === JOURNAL_ENTRY_BATCH_OPERATE_AUTH);
  return !!auth && new AuthorizationEvaluator().UserCanExecuteWithAncestors(auth, user, auths);
}
