/**
 * Server-side subclass of GLAccountLink — the write-time tie guard for account resolution.
 *
 * THE RULE (the retained half of the BA-D32 package): no ambiguous tie per
 * (record, role, company, window). Overlapping windows are legitimate and necessary — that is how
 * a link is superseded (`pickActiveLinkIndex`: latest StartedAt wins). What is NOT legitimate is
 * two Active links for the same (EntityID, RecordID, GLAccountRoleID) whose accounts belong to
 * the SAME company and that share the SAME StartedAt (both dated alike, or both null): the
 * tie-break is a strict `>`, so resolution silently returns whichever row the cache lists first —
 * an arbitrary choice between two different GL accounts that both produce balanced entries.
 *
 * Cardinality=Many roles (BankAccount, BA-D34) skip this guard: N Active same-window links
 * are the point. ResolveLinkedAccount refuses those roles; ResolveLinkedAccounts returns the set.
 *
 * COMPANY IS DERIVED, NOT STORED: the link's company is its GLAccount's
 * CompanyID, read through the FK. Safe because GLAccount identity fields are immutable from
 * creation (GLAccountEntityServer), so the derivation can never drift. Links to DIFFERENT
 * companies' accounts may share a window freely — that is exactly the multi-company case
 * `ResolveLinkedAccount(..., forCompanyID)` disambiguates.
 *
 * This is entity-layer validation (a readable message for the human configuring links); the
 * raw-SQL trigger backstop is a hardening-backlog item (overlap windows are not expressible as a
 * UNIQUE index in SQL Server — issue #30).
 *
 * CONNECTS TO:
 *   ENGINE:  AccountingEngineBase.ResolveLinkedAccount (the reader this protects)
 *   SIBLING: GLAccountEntityServer (the immutable-identity lock the derivation relies on)
 *   DOC:     plans/donor-audit.md (BA-D32 rev. 2026-07-29) · GitHub issue #30
 */
import { BaseEntity, IRunViewProvider, ValidationResult, ValidationErrorInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsAccountingGLAccountLinkEntity } from '@mj-biz-apps/accounting-entities';
import { isSqlGuid, sqlGuidLiteral } from './SqlGuards.js';

const LINK_ENTITY = 'MJ_BizApps_Accounting: GL Account Links';
const GL_ENTITY = 'MJ_BizApps_Accounting: GL Accounts';
const ROLE_ENTITY = 'MJ_BizApps_Accounting: GL Account Roles';

@RegisterClass(BaseEntity, LINK_ENTITY)
export class GLAccountLinkEntityServer extends mjBizAppsAccountingGLAccountLinkEntity {
  /** BaseEntity SKIPS ValidateAsync by default — opt in, or the tie guard never runs on Save. */
  public override get DefaultSkipAsyncValidation(): boolean {
    return false;
  }

  public override async ValidateAsync(): Promise<ValidationResult> {
    const result = await super.ValidateAsync();
    const fail = (message: string) => {
      result.Success = false;
      result.Errors.push(new ValidationErrorInfo('GLAccountLinkEntityServer.ValidateAsync', message, null));
    };
    await this.checkNoAmbiguousTie(fail);
    return result;
  }

  /**
   * Refuse a second Active link for the same (record, role, company) with the same StartedAt.
   * Gated cheapest-first: only Active rows are ever ambiguous, and the sibling scan is one
   * filtered read on the (EntityID, RecordID, RoleID) shape resolution itself uses.
   */
  private async checkNoAmbiguousTie(fail: (message: string) => void): Promise<void> {
    if (this.Status !== 'Active') return;
    if (!this.EntityID || !this.RecordID || !this.GLAccountRoleID || !this.GLAccountID) return;
    // These client-set FK values are interpolated into the sibling-scan filter below — a malformed
    // one can never be a valid FK, so refuse it with a readable message before it reaches SQL.
    for (const [name, value] of [['EntityID', this.EntityID], ['GLAccountRoleID', this.GLAccountRoleID], ['GLAccountID', this.GLAccountID]] as const) {
      if (!isSqlGuid(value)) {
        fail(`${name} '${value}' is not a valid UUID.`);
        return;
      }
    }
    const [roleRes, accountRes] = await (this.ProviderToUse as unknown as IRunViewProvider).RunViews(
      [
        {
          EntityName: ROLE_ENTITY,
          ExtraFilter: `ID=${sqlGuidLiteral(this.GLAccountRoleID, 'GLAccountLinkEntityServer.checkNoAmbiguousTie')}`,
          Fields: ['Cardinality'],
          MaxRows: 1,
          ResultType: 'simple',
          BypassCache: true,
        },
        {
          EntityName: GL_ENTITY,
          ExtraFilter: `ID=${sqlGuidLiteral(this.GLAccountID, 'GLAccountLinkEntityServer.checkNoAmbiguousTie')}`,
          Fields: ['CompanyID'],
          MaxRows: 1,
          ResultType: 'simple',
          BypassCache: true,
        },
      ],
      this.ContextCurrentUser,
    );
    if (!roleRes?.Success) {
      throw new Error(`Could not read account role ${this.GLAccountRoleID}: ${roleRes?.ErrorMessage ?? 'unknown error'}`);
    }
    if (((roleRes.Results?.[0] as { Cardinality?: string } | undefined)?.Cardinality ?? 'One') === 'Many') return;
    if (!accountRes?.Success) {
      throw new Error(`Could not find the company of GL account ${this.GLAccountID}: ${accountRes?.ErrorMessage ?? 'unknown error'}`);
    }
    const myCompanyId = (accountRes.Results?.[0] as { CompanyID?: string } | undefined)?.CompanyID ?? null;
    if (!myCompanyId) return; // a missing account is the FK's job to reject

    const startedAt = this.StartedAt ? new Date(this.StartedAt).toISOString() : null;
    const sameStart = startedAt === null ? `StartedAt IS NULL` : `StartedAt = '${startedAt}'`;
    const notSelf = this.IsSaved ? ` AND ID <> '${this.ID}'` : '';
    const filter =
      `EntityID = '${this.EntityID}' AND RecordID = '${this.RecordID.replace(/'/g, "''")}' ` +
      `AND GLAccountRoleID = '${this.GLAccountRoleID}' AND Status = 'Active' AND ${sameStart}${notSelf}`;

    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ ID: string; GLAccountID: string }>(
      { EntityName: LINK_ENTITY, ExtraFilter: filter, Fields: ['ID', 'GLAccountID'], ResultType: 'simple', BypassCache: true },
      this.ContextCurrentUser,
    );
    // Loud on failure: silently answering "no tie" would let the ambiguity through, and the whole
    // point of this guard is that the ambiguity is otherwise invisible (both accounts balance).
    if (!res.Success) {
      throw new Error(`Could not check for a conflicting active account link: ${res.ErrorMessage ?? 'unknown error'}`);
    }

    const siblings = res.Results ?? [];
    if (siblings.length === 0) return;

    // Same StartedAt is only a TIE when a sibling's account belongs to MY company (derived
    // through the GLAccount FK) — load every distinct sibling account in ONE batched query.
    const siblingAccountIds = [...new Set(siblings.map((s) => s.GLAccountID).filter((id) => isSqlGuid(id)))];
    if (siblingAccountIds.length === 0) return;
    const companyByAccountId = await this.companiesOfAccounts(siblingAccountIds);
    for (const sibling of siblings) {
      const siblingCompanyId = companyByAccountId.get(sibling.GLAccountID.toLowerCase());
      if (siblingCompanyId && siblingCompanyId.toLowerCase() === myCompanyId.toLowerCase()) {
        fail(
          `Another active link already exists for this record, role and company with the same start date ` +
            `(${startedAt ?? 'none'}). The account is picked by the latest start date, so two links sharing one would ` +
            `pick between two accounts at random. To replace the existing link, give it an end date and ` +
            `give this one a later start date.`,
        );
        return;
      }
    }
  }

  /** The company each GL account belongs to, loaded in a single batched query. */
  private async companiesOfAccounts(glAccountIds: string[]): Promise<Map<string, string>> {
    const inList = glAccountIds
      .map((id) => sqlGuidLiteral(id, 'GLAccountLinkEntityServer.companiesOfAccounts'))
      .join(',');
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ ID: string; CompanyID: string }>(
      {
        EntityName: GL_ENTITY,
        ExtraFilter: `ID IN (${inList})`,
        Fields: ['ID', 'CompanyID'],
        ResultType: 'simple',
        BypassCache: true,
      },
      this.ContextCurrentUser,
    );
    if (!res.Success) {
      throw new Error(`Could not find the companies of GL accounts: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    return new Map((res.Results ?? []).map((row) => [row.ID.toLowerCase(), row.CompanyID]));
  }
}

/** Tree-shaking anchor — imported by ./index.ts so the @RegisterClass registration survives bundling. */
export function LoadGLAccountLinkEntityServer(): void {
  // intentionally empty
}
