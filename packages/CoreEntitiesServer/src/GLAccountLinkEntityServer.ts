/**
 * Server-side subclass of GLAccountLink — the write-time tie guard for account resolution.
 *
 * THE RULE (Amith 2026-07-29, the retained half of the BA-D32 package): no ambiguous tie per
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
 * COMPANY IS DERIVED, NOT STORED (Amith 2026-07-29): the link's company is its GLAccount's
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
    if (await this.roleIsMany(this.GLAccountRoleID)) return;

    const myCompanyId = await this.companyOfAccount(this.GLAccountID);
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
      throw new Error(`GLAccountLinkEntityServer: failed to check for a conflicting active link: ${res.ErrorMessage ?? 'unknown error'}`);
    }

    // Same StartedAt is only a TIE when the sibling's account belongs to MY company (derived
    // through the GLAccount FK) — per-company links for a shared record are the supported case.
    for (const sibling of res.Results ?? []) {
      const siblingCompanyId = await this.companyOfAccount(sibling.GLAccountID);
      if (siblingCompanyId && siblingCompanyId.toLowerCase() === myCompanyId.toLowerCase()) {
        fail(
          `Another Active link already exists for this record + role + company with the same StartedAt ` +
            `(${startedAt ?? 'unset'}). Resolution picks the latest StartedAt, so two rows sharing one would ` +
            `resolve arbitrarily between two accounts. To supersede the existing link, set its EndedAt and ` +
            `give this row a later StartedAt.`,
        );
        return;
      }
    }
  }

  /**
   * Many-cardinality roles (BankAccount) are allowed N Active same-window links.
   * Fail closed: a role-read error throws rather than skipping the One-role guard.
   * Missing Cardinality (should not happen after BA-D34) is treated as One.
   */
  private async roleIsMany(roleId: string): Promise<boolean> {
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ Cardinality: string }>(
      {
        EntityName: ROLE_ENTITY,
        ExtraFilter: `ID=${sqlGuidLiteral(roleId, 'GLAccountLinkEntityServer.roleIsMany')}`,
        Fields: ['Cardinality'],
        MaxRows: 1,
        ResultType: 'simple',
        BypassCache: true,
      },
      this.ContextCurrentUser,
    );
    if (!res.Success) {
      throw new Error(
        `GLAccountLinkEntityServer: failed to read role cardinality for ${roleId}: ${res.ErrorMessage ?? 'unknown error'}`,
      );
    }
    return (res.Results?.[0]?.Cardinality ?? 'One') === 'Many';
  }

  /** The company a GL account belongs to — the link's derived company (no denormalized column). */
  private async companyOfAccount(glAccountId: string): Promise<string | null> {
    const provider = this.ProviderToUse as unknown as IRunViewProvider;
    const res = await provider.RunView<{ CompanyID: string }>(
      { EntityName: GL_ENTITY, ExtraFilter: `ID=${sqlGuidLiteral(glAccountId, 'GLAccountLinkEntityServer.companyOfAccount')}`, Fields: ['CompanyID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
      this.ContextCurrentUser,
    );
    if (!res.Success) {
      throw new Error(`GLAccountLinkEntityServer: failed to resolve the account's company for ${glAccountId}: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    return res.Results?.[0]?.CompanyID ?? null;
  }
}

/** Tree-shaking anchor — imported by ./index.ts so the @RegisterClass registration survives bundling. */
export function LoadGLAccountLinkEntityServer(): void {
  // intentionally empty
}
