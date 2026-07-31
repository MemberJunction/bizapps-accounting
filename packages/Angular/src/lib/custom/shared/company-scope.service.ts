import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NormalizeUUID } from '@memberjunction/global';
import { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { AccountingEngineBase } from '@mj-biz-apps/accounting-engine-base';

/** A company the app can be scoped to. Id is the Company/ACP PK (IsA — same UUID). */
export interface ScopeCompany {
  ID: string;
  Name: string;
  CompanyCode: string;
}

/**
 * App-wide company scope (UI plan §8.0 — the rail-top scope chip).
 *
 * Holds the user's selected company scope and persists it per user via UserInfoEngine (MJ CLAUDE.md
 * rule 9 — never localStorage, so the scope follows the user across devices). Every list, dashboard
 * and report filters by `SelectedIDs`.
 *
 * **Empty selection means ALL companies**, not "none" — a brand-new user must see data, not an empty
 * app. Callers use `FilterFor()` rather than reading SelectedIDs directly so that rule is applied in
 * exactly one place.
 *
 * The company LIST comes from `AccountingEngineBase`'s cache (it already loads Accounting Company
 * Profiles at Config) — no extra round-trip, per MJ's "check the registry before you query".
 *
 * This is deliberately NOT in transfer-pending/: it binds to accounting entities, so it is
 * accounting-owned. The nav rail projects it through a content slot instead.
 */
@Injectable({ providedIn: 'root' })
export class CompanyScopeService {
  /** UserInfoEngine settings key. Versioned so the shape can evolve (rule 9 convention). */
  public static readonly SettingKey = 'mj.bizappsacct.companyScope.v1';

  private selectedIDs$ = new BehaviorSubject<string[]>([]);
  private companies$ = new BehaviorSubject<ScopeCompany[]>([]);
  private loaded = false;

  /** All accounting-enabled companies (those with an Accounting Company Profile). */
  public get Companies(): ScopeCompany[] {
    return this.companies$.value;
  }
  public get Companies$(): Observable<ScopeCompany[]> {
    return this.companies$.asObservable();
  }

  /** The scoped company IDs. EMPTY = all companies (see FilterFor). */
  public get SelectedIDs(): string[] {
    return this.selectedIDs$.value;
  }
  public get SelectedIDs$(): Observable<string[]> {
    return this.selectedIDs$.asObservable();
  }

  public get IsAllCompanies(): boolean {
    return this.selectedIDs$.value.length === 0;
  }

  /**
   * Load the company roster + the persisted scope. Idempotent — every consumer calls it at entry and
   * only the first call does work (the BaseEngine lazy-load pattern).
   */
  public async Load(contextUser?: UserInfo, provider?: IMetadataProvider): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    await AccountingEngineBase.Instance.Config(false, contextUser, provider);
    // REACTIVE roster, not a one-shot snapshot (Marcelo 2026-07-30 — the stale-company-picker/FK
    // ghost fix): ObserveProperty emits the current array on subscribe AND re-emits on every
    // client-side ACP save/delete, so a company created in the New-company dialog appears in the
    // scope chip and every picker fed from this service immediately. (The service is a root
    // singleton living for the app session, so the subscription is deliberately never torn down.)
    AccountingEngineBase.Instance
      .ObserveProperty<InstanceType<typeof AccountingEngineBase>['CompanyProfiles'][number]>('_companyProfiles')
      .subscribe((profiles) => {
        // DEDUPE by normalized ID (Marcelo 2026-07-30): MJ-core's BaseEngine event-upsert compares
        // PKs with raw `===`, so a client-created row (lowercase UUID) and its server-refreshed
        // copy (uppercase) can BOTH sit in the engine array — filed upstream (MJ-UPSTREAM.md,
        // GH-likely); until that lands we keep the LAST copy (the freshest upsert) per company.
        const byId = new Map<string, ScopeCompany>();
        for (const p of profiles) byId.set(NormalizeUUID(p.ID), { ID: p.ID, Name: p.Name, CompanyCode: p.CompanyCode });
        const companies: ScopeCompany[] = [...byId.values()].sort((a, b) => a.Name.localeCompare(b.Name));
        this.companies$.next(companies);
      });

    this.selectedIDs$.next(this.readPersistedScope(this.companies$.value));
  }

  /** Replace the scope. Pass [] for "all companies". */
  public SetScope(ids: string[]): void {
    // Drop ids that no longer resolve (a company can be removed after the setting was written) —
    // otherwise a stale id would silently filter every list down to nothing.
    const known = new Set(this.companies$.value.map((c) => c.ID));
    const cleaned = ids.filter((id) => known.has(id));

    this.selectedIDs$.next(cleaned);
    UserInfoEngine.Instance.SetSettingDebounced(CompanyScopeService.SettingKey, JSON.stringify(cleaned));
  }

  public Toggle(id: string): void {
    const current = this.selectedIDs$.value;
    this.SetScope(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  public SelectAll(): void {
    this.SetScope([]);
  }

  /** The chip caption: "All companies" / "Acme Co." / "Acme Co. +2". */
  public get Label(): string {
    const ids = this.selectedIDs$.value;
    if (ids.length === 0) return 'All companies';

    const first = this.companies$.value.find((c) => c.ID === ids[0]);
    const name = first?.Name ?? 'Unknown';
    return ids.length === 1 ? name : `${name} +${ids.length - 1}`;
  }

  /**
   * The scope's contribution to a RunView ExtraFilter, or null when unscoped (= all companies).
   * Callers AND their tests go through this so the empty-means-all rule lives in one place.
   *
   * @param columnName the CompanyID-ish column on the entity being filtered.
   */
  public FilterFor(columnName = 'CompanyID'): string | null {
    const ids = this.selectedIDs$.value;
    if (ids.length === 0) return null;
    return `${columnName} IN (${ids.map((id) => `'${id}'`).join(',')})`;
  }

  /** Compose the scope filter with a caller's own filter. Either side may be null/empty. */
  public ComposeFilter(ownFilter: string | null | undefined, columnName = 'CompanyID'): string {
    const scope = this.FilterFor(columnName);
    const parts = [ownFilter?.trim(), scope].filter((p): p is string => !!p && p.length > 0);
    return parts.map((p) => `(${p})`).join(' AND ');
  }

  private readPersistedScope(companies: ScopeCompany[]): string[] {
    const raw = UserInfoEngine.Instance.GetSetting(CompanyScopeService.SettingKey);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const known = new Set(companies.map((c) => c.ID));
      return parsed.filter((x): x is string => typeof x === 'string' && known.has(x));
    } catch {
      // A corrupt setting must degrade to "all companies", never to a broken app.
      return [];
    }
  }
}
