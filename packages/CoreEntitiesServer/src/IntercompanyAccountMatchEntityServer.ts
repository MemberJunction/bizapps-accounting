/**
 * Server-side subclass of IntercompanyAccountMatch — invariants for the Due To / Due From pair.
 *
 * WHY THIS CLASS EXISTS AT ALL, GIVEN THE TRIGGERS
 * The DB triggers (50024–50026) are the backstop: they cannot be bypassed, not even by an SA-level
 * direct write, and that is exactly the right place for the account-ownership and account-type
 * rules. But a trigger surfaces as a raw SQL error, and this table is edited by humans configuring
 * an intercompany agreement — people who need to be told what they got wrong, not handed a
 * constraint number. So the two ownership/type rules are ALSO checked here, cheaply and with a
 * readable message. They are duplicated on purpose.
 *
 * THE RULE ONLY THIS CLASS ENFORCES: no ambiguous tie.
 * Overlapping effective windows are legitimate and necessary — pre-entering "the new mapping starts
 * Aug 1" leaves the old open-ended row overlapping it, and `pickActiveLinkIndex` resolves that
 * correctly because the later StartedAt wins. What is NOT legitimate is two Active rows for the same
 * company pair sharing the SAME StartedAt (both dated alike, or both null). The tie-break is a
 * strict `>`, so the winner is whichever the cache happens to list first — an arbitrary choice
 * between two different account pairs, stable-looking in test and liable to flip in production.
 * Nothing downstream would notice: both pairs balance.
 *
 * CONNECTS TO:
 *   ENGINE:  AccountingEngineBase.ResolveIntercompanyAccounts (the reader this protects)
 *   DB:      trg_IAM_AccountIntegrity (50024-50026)
 *   DOC:     plans/bizapps-accounting-master.md BA-D26..BA-D28
 */
import { BaseEntity, IRunViewProvider, ValidationResult, ValidationErrorInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingIntercompanyAccountMatchEntity } from '@mj-biz-apps/accounting-entities';

const IAM_ENTITY = 'MJ_BizApps_Accounting: Intercompany Account Matches';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';

/** The GL account fields these checks need. */
interface AccountShape {
  ID: string;
  Code: string;
  CompanyID: string;
  AccountType: string;
}

@RegisterClass(BaseEntity, IAM_ENTITY)
export class IntercompanyAccountMatchEntityServer extends mjBizAppsAccountingIntercompanyAccountMatchEntity {
  /**
   * BaseEntity SKIPS ValidateAsync by default (DefaultSkipAsyncValidation = true) — opt in, or
   * every cross-record check below silently never runs on Save.
   */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();
    const fail = (message: string) => {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('IntercompanyAccountMatchEntityServer.ValidateAsync', message, null));
    };

    await this.checkAccountOrientation(fail);
    await this.checkNoAmbiguousTie(fail);

    return result;
  }

  /**
   * DueTo belongs to Source and is a Liability; DueFrom belongs to Target and is an Asset.
   *
   * This is the check that matters most and is hardest to notice the absence of: a pair with the
   * companies swapped still produces a perfectly balanced journal entry. The books simply end up
   * wrong on both sides, with no failing assertion anywhere to say so.
   */
  private async checkAccountOrientation(fail: (message: string) => void): Promise<void> {
    if (!this.DueToGLAccountID || !this.DueFromGLAccountID) return;

    const accounts = await this.loadAccounts([this.DueToGLAccountID, this.DueFromGLAccountID]);
    const dueTo = accounts.get(this.DueToGLAccountID.toLowerCase());
    const dueFrom = accounts.get(this.DueFromGLAccountID.toLowerCase());

    // A missing account is the FK's job to reject; saying nothing here avoids a confusing
    // second error alongside the referential one.
    if (dueTo) {
      if (!sameID(dueTo.CompanyID, this.SourceCompanyID)) {
        fail(
          `DueTo account ${dueTo.Code} belongs to a different company than SourceCompanyID. ` +
            `The Due To liability sits on the books of the company that COLLECTED the cash and therefore owes. ` +
            `If the pair looks backwards, swap SourceCompanyID and TargetCompanyID rather than the accounts.`,
        );
      }
      if (dueTo.AccountType !== 'Liability') {
        fail(`DueTo account ${dueTo.Code} is ${dueTo.AccountType}; an intercompany payable must be a Liability account.`);
      }
    }

    if (dueFrom) {
      if (!sameID(dueFrom.CompanyID, this.TargetCompanyID)) {
        fail(
          `DueFrom account ${dueFrom.Code} belongs to a different company than TargetCompanyID. ` +
            `The Due From receivable sits on the books of the company that OWNS the line the cash settled.`,
        );
      }
      if (dueFrom.AccountType !== 'Asset') {
        fail(`DueFrom account ${dueFrom.Code} is ${dueFrom.AccountType}; an intercompany receivable must be an Asset account.`);
      }
    }
  }

  /**
   * Refuse a second Active row for the same company pair with the same StartedAt.
   *
   * Overlapping windows are fine — that is how a mapping is superseded. Identical StartedAt is not:
   * resolution breaks the tie with a strict `>`, so it silently returns whichever row came back
   * first from the cache.
   */
  private async checkNoAmbiguousTie(fail: (message: string) => void): Promise<void> {
    if (this.Status !== 'Active') return;
    if (!this.SourceCompanyID || !this.TargetCompanyID) return;

    const startedAt = this.StartedAt ? new Date(this.StartedAt).toISOString() : null;
    const sameStart = startedAt === null ? `StartedAt IS NULL` : `StartedAt = '${startedAt}'`;
    const notSelf = this.IsSaved ? ` AND ID <> '${this.ID}'` : '';
    const filter =
      `SourceCompanyID = '${this.SourceCompanyID}' AND TargetCompanyID = '${this.TargetCompanyID}' ` +
      `AND Status = 'Active' AND ${sameStart}${notSelf}`;

    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ ID: string }>(
      { EntityName: IAM_ENTITY, ExtraFilter: filter, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
      this.ContextCurrentUser,
    );
    // Loud on failure: silently answering "no duplicate" would let the ambiguity through, and the
    // whole point of this check is that the ambiguity is otherwise invisible.
    if (!res.Success) {
      throw new Error(
        `IntercompanyAccountMatchEntityServer: failed to check for a conflicting active pair: ${res.ErrorMessage ?? 'unknown error'}`,
      );
    }

    if ((res.Results?.length ?? 0) > 0) {
      fail(
        `Another Active intercompany pair already exists for these companies with the same StartedAt ` +
          `(${startedAt ?? 'unset'}). Resolution picks the latest StartedAt, so two rows sharing one would resolve ` +
          `arbitrarily. To supersede the existing mapping, set its EndedAt and give this row a later StartedAt.`,
      );
    }
  }

  private async loadAccounts(ids: string[]): Promise<Map<string, AccountShape>> {
    const quoted = ids.map((id) => `'${id}'`).join(',');
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<AccountShape>(
      {
        EntityName: GL_ENTITY,
        ExtraFilter: `ID IN (${quoted})`,
        Fields: ['ID', 'Code', 'CompanyID', 'AccountType'],
        ResultType: 'simple',
        BypassCache: true,
      },
      this.ContextCurrentUser,
    );
    if (!res.Success) {
      throw new Error(
        `IntercompanyAccountMatchEntityServer: failed to load GL accounts for validation: ${res.ErrorMessage ?? 'unknown error'}`,
      );
    }
    return new Map((res.Results ?? []).map((a) => [String(a.ID).toLowerCase(), a]));
  }
}

/** SQL Server returns uppercase GUIDs, randomUUID() lowercase — compare case-insensitively. */
function sameID(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}
