/**
 * The batch-operator Authorization (#448) as a provider's catalog carries it, for specs that render
 * the batch actions. The pages show Build, Dispatch, Regenerate and Archive only to its holders.
 */
import type { AuthorizationInfo, UserInfo } from '@memberjunction/core';
import { JOURNAL_ENTRY_BATCH_OPERATE_AUTH } from '@mj-biz-apps/accounting-engine-base';

/** A catalog holding the Authorization, granted to `holders`, or to every user when omitted. */
export function BatchOperatorCatalog(holders?: readonly string[]): AuthorizationInfo[] {
  const auth = {
    ID: 'AUTH-BATCH-OPERATE',
    Name: JOURNAL_ENTRY_BATCH_OPERATE_AUTH,
    ParentID: null,
    UserCanExecute: (user: UserInfo) => !holders || holders.includes(user.ID),
  };
  return [auth] as unknown as AuthorizationInfo[];
}
