/**
 * Host-tunable bag on AccountingEngineExtension.Configuration.
 *
 * Stored as JSON on `__mj_BizAppsAccounting.AccountingEngineExtension`.
 * CodeGen emits a typed `ConfigurationObject` accessor on the entity
 * returning `IAccountingEngineExtensionConfiguration | null`.
 *
 * Hook participation is NOT here — that lives on
 * `BaseAccountingEngineExtension` getters (`RunAfterSyncMasterData`, …)
 * and Before/After method overrides. This bag is host knobs only.
 *
 * Extension-specific keys may be present in the stored JSON; the owning
 * class documents them. They are not declared on this common interface.
 */
export interface IAccountingEngineExtensionConfiguration {
    /**
     * ISO date (YYYY-MM-DD) the extension should use when the engine did
     * not pass an as-of. NULL/omit = engine context (typically today UTC).
     */
    AsOf?: string | null;

    /**
     * When the triggering engine verb names objects (SyncMasterData), skip
     * this extension unless the intersection is non-empty. NULL/omit = always
     * run for a participating verb.
     */
    Objects?: Array<'accounts' | 'dimensions' | 'dimensionValues'> | null;

    /**
     * If true, a thrown extension does not fail the engine verb. Default
     * false — fail closed, matching the rest of the accounting engine.
     */
    ContinueOnError?: boolean | null;
}
