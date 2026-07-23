/**
 * AccountingEngineBase — the browser-safe accounting metadata cache (plan §2.1, CH-10;
 * modeled on AIEngineBase). Caches the small reference tables so lookups are instant, with
 * BaseEngine's auto-refresh keeping them current on entity save/delete:
 *
 *   GL Accounts · GL Account Roles · GL Account Links (+ their ordered Link Dimensions) ·
 *   Dimensions · Dimension Values · Accounting Company Profiles · Currencies (reference only — FX deferred)
 *
 * Also exposes:
 *   - ResolveLinkedAccount(entityId, recordId, role, asOfDate) — the per-record link primitive
 *     Orders' resolver walks (product → category → company default; the WALK order is Orders'
 *     code, the per-record lookup is ours — plan §2.1).
 *   - CreatePipelineLookups() — the cache-backed lookups the pure draft pipeline consumes.
 *
 * Browser-safe: deps are @memberjunction/core + global + the app's Entities package ONLY.
 *
 * CONNECTS TO:
 *   SERVER:  AccountingEngine (CoreEntitiesServer) wraps this for the write path
 *   PIPELINE: ./pipeline.ts consumes CreatePipelineLookups()
 *   DOC:     plans/accounting-engine-plan.md §2.1
 */
import { BaseEngine, BaseEnginePropertyConfig, IMetadataProvider, UserInfo } from '@memberjunction/core';
import { RegisterForStartup } from '@memberjunction/core';
import type {
  mjBizAppsAccountingAccountingCompanyProfileEntity,
  mjBizAppsAccountingCurrencyEntity,
  mjBizAppsAccountingDimensionEntity,
  mjBizAppsAccountingDimensionValueEntity,
  mjBizAppsAccountingGLAccountEntity,
  mjBizAppsAccountingGLAccountLinkDimensionEntity,
  mjBizAppsAccountingGLAccountLinkEntity,
  mjBizAppsAccountingGLAccountRoleEntity,
} from '@mj-biz-apps/accounting-entities';
import type { PipelineLookups } from './pipeline.js';

const uuidKey = (id: string | null | undefined): string => (id ?? '').trim().toLowerCase();

/** A resolved link: the winning GLAccountLink + its ordered dimension requirements. */
export interface ResolvedLinkedAccount {
  Link: mjBizAppsAccountingGLAccountLinkEntity;
  /** The link's GLAccountLinkDimension rows, ordered by Sequence — the dimensions a JE line built from this link must carry (values come from caller context — OQ-I). */
  Dimensions: mjBizAppsAccountingGLAccountLinkDimensionEntity[];
}

/** The window/status subset of a GLAccountLink that the pure picker needs (unit-testable shape). */
export interface LinkCandidate {
  Status: mjBizAppsAccountingGLAccountLinkEntity['Status'];
  StartedAt: Date | null;
  EndedAt: Date | null;
}

/**
 * Pure link picker: of the candidates, return the index of the Active link whose
 * StartedAt/EndedAt window covers `asOf` (null bounds are open). When several qualify,
 * the LATEST StartedAt wins (most specific window; null StartedAt loses to any dated one).
 * Returns -1 when none qualify. Exported for unit tests.
 */
export function pickActiveLinkIndex(candidates: LinkCandidate[], asOf: Date): number {
  let winner = -1;
  let winnerStarted: number | null = null;
  candidates.forEach((c, i) => {
    if (c.Status !== 'Active') return;
    const started = c.StartedAt ? new Date(c.StartedAt).getTime() : null;
    const ended = c.EndedAt ? new Date(c.EndedAt).getTime() : null;
    const t = asOf.getTime();
    if (started !== null && t < started) return;
    if (ended !== null && t > ended) return;
    if (winner === -1 || (started ?? -Infinity) > (winnerStarted ?? -Infinity)) {
      winner = i;
      winnerStarted = started;
    }
  });
  return winner;
}

@RegisterForStartup()
export class AccountingEngineBase extends BaseEngine<AccountingEngineBase> {
  private _glAccounts: mjBizAppsAccountingGLAccountEntity[] = [];
  private _glAccountRoles: mjBizAppsAccountingGLAccountRoleEntity[] = [];
  private _glAccountLinks: mjBizAppsAccountingGLAccountLinkEntity[] = [];
  private _glAccountLinkDimensions: mjBizAppsAccountingGLAccountLinkDimensionEntity[] = [];
  private _dimensions: mjBizAppsAccountingDimensionEntity[] = [];
  private _dimensionValues: mjBizAppsAccountingDimensionValueEntity[] = [];
  private _companyProfiles: mjBizAppsAccountingAccountingCompanyProfileEntity[] = [];
  private _currencies: mjBizAppsAccountingCurrencyEntity[] = [];

  public static get Instance(): AccountingEngineBase {
    return super.getInstance<AccountingEngineBase>();
  }

  public async Config(forceRefresh?: boolean, contextUser?: UserInfo, provider?: IMetadataProvider): Promise<unknown> {
    const params: Array<Partial<BaseEnginePropertyConfig>> = [
      { PropertyName: '_glAccounts', EntityName: 'MJ_BizApps_Accounting: GL Accounts' },
      { PropertyName: '_glAccountRoles', EntityName: 'MJ_BizApps_Accounting: GL Account Roles', OrderBy: 'Sequence ASC' },
      { PropertyName: '_glAccountLinks', EntityName: 'MJ_BizApps_Accounting: GL Account Links' },
      { PropertyName: '_glAccountLinkDimensions', EntityName: 'MJ_BizApps_Accounting: GL Account Link Dimensions', OrderBy: 'Sequence ASC' },
      { PropertyName: '_dimensions', EntityName: 'MJ_BizApps_Accounting: Dimensions' },
      { PropertyName: '_dimensionValues', EntityName: 'MJ_BizApps_Accounting: Dimension Values' },
      { PropertyName: '_companyProfiles', EntityName: 'MJ_BizApps_Accounting: Accounting Company Profiles' },
      { PropertyName: '_currencies', EntityName: 'MJ_BizApps_Accounting: Currencies' },
    ];
    return await this.Load(params, provider as IMetadataProvider, forceRefresh ?? false, contextUser);
  }

  // ─── cached collections ────────────────────────────────────────────────────

  public get GLAccounts(): mjBizAppsAccountingGLAccountEntity[] {
    return this._glAccounts;
  }
  public get GLAccountRoles(): mjBizAppsAccountingGLAccountRoleEntity[] {
    return this._glAccountRoles;
  }
  public get GLAccountLinks(): mjBizAppsAccountingGLAccountLinkEntity[] {
    return this._glAccountLinks;
  }
  public get GLAccountLinkDimensions(): mjBizAppsAccountingGLAccountLinkDimensionEntity[] {
    return this._glAccountLinkDimensions;
  }
  public get Dimensions(): mjBizAppsAccountingDimensionEntity[] {
    return this._dimensions;
  }
  public get DimensionValues(): mjBizAppsAccountingDimensionValueEntity[] {
    return this._dimensionValues;
  }
  public get CompanyProfiles(): mjBizAppsAccountingAccountingCompanyProfileEntity[] {
    return this._companyProfiles;
  }
  public get Currencies(): mjBizAppsAccountingCurrencyEntity[] {
    return this._currencies;
  }

  // ─── point lookups ─────────────────────────────────────────────────────────

  public GLAccountByID(glAccountId: string): mjBizAppsAccountingGLAccountEntity | undefined {
    const key = uuidKey(glAccountId);
    return this.GLAccounts.find(a => uuidKey(a.ID) === key);
  }

  public GLAccountByCompanyAndCode(companyId: string, code: string): mjBizAppsAccountingGLAccountEntity | undefined {
    const companyKey = uuidKey(companyId);
    const codeKey = (code ?? '').trim();
    return this.GLAccounts.find(a => uuidKey(a.CompanyID) === companyKey && a.Code === codeKey);
  }

  public GLAccountRoleByName(name: string): mjBizAppsAccountingGLAccountRoleEntity | undefined {
    const key = (name ?? '').trim().toLowerCase();
    return this.GLAccountRoles.find(r => r.Name.trim().toLowerCase() === key);
  }

  // ─── the link primitive (plan §2.1) ────────────────────────────────────────

  /**
   * The Active GLAccountLink for a polymorphic record (EntityID + RecordID) in a given role,
   * whose StartedAt/EndedAt window covers `asOfDate` — plus its ordered dimension requirements.
   * `role` accepts a GLAccountRole ID or Name. Returns null when no link qualifies (the caller
   * walks its own fallback chain — product → category → company default is Orders' code).
   */
  public ResolveLinkedAccount(entityId: string, recordId: string, role: string, asOfDate: Date): ResolvedLinkedAccount | null {
    const roleId = uuidKey(this.GLAccountRoles.find(r => uuidKey(r.ID) === uuidKey(role))?.ID ?? this.GLAccountRoleByName(role)?.ID);
    if (!roleId) return null;
    const entityKey = uuidKey(entityId);
    const recordKey = (recordId ?? '').trim().toLowerCase();
    const candidates = this.GLAccountLinks.filter(l =>
      uuidKey(l.EntityID) === entityKey &&
      (l.RecordID ?? '').trim().toLowerCase() === recordKey &&
      uuidKey(l.GLAccountRoleID) === roleId,
    );
    const winner = pickActiveLinkIndex(
      candidates.map(l => ({ Status: l.Status, StartedAt: l.StartedAt, EndedAt: l.EndedAt })),
      asOfDate,
    );
    if (winner === -1) return null;
    const link = candidates[winner];
    const linkKey = uuidKey(link.ID);
    const dimensions = this.GLAccountLinkDimensions
      .filter(d => uuidKey(d.GLAccountLinkID) === linkKey)
      .sort((a, b) => a.Sequence - b.Sequence);
    return { Link: link, Dimensions: dimensions };
  }

  // ─── pipeline adapter ──────────────────────────────────────────────────────

  /** Cache-backed lookups for the pure draft pipeline (./pipeline.ts). */
  public CreatePipelineLookups(): PipelineLookups {
    const accounts = new Map(this.GLAccounts.map(a => [uuidKey(a.ID), a]));
    const dimensions = new Set(this.Dimensions.map(d => uuidKey(d.ID)));
    const valuesByDimension = new Map<string, Set<string>>();
    for (const v of this.DimensionValues) {
      const dimKey = uuidKey(v.DimensionID);
      const set = valuesByDimension.get(dimKey) ?? new Set<string>();
      set.add(uuidKey(v.ID));
      valuesByDimension.set(dimKey, set);
    }
    return {
      accountByID: (id) => {
        const a = accounts.get(uuidKey(id));
        return a ? { ID: a.ID, CompanyID: a.CompanyID, IsActive: a.IsActive } : undefined;
      },
      dimensionExists: (id) => dimensions.has(uuidKey(id)),
      dimensionValueBelongs: (dimensionId, valueId) => valuesByDimension.get(uuidKey(dimensionId))?.has(uuidKey(valueId)) ?? false,
    };
  }
}
