/**
 * trigger-preflight.ts — a fast, shared guard the live harnesses run at bootstrap.
 *
 * WHY: the raw-SQL "bypass" tests are only meaningful if the financial-invariant DB triggers actually
 * exist AND are ENABLED. If one were dropped (broken migrate) or left DISABLED (a prior harness crashed
 * mid-teardown — teardown toggles DISABLE/ENABLE TRIGGER ALL), the "cheat" SQL would succeed and the test
 * would fail with a cryptic "expected an error but none was thrown". This pre-flight fails FAST instead,
 * with an actionable message naming exactly which triggers are missing/disabled and how to fix it — so a
 * future agent (or AI consumer) lands right on the problem instead of debugging the symptom.
 *
 * It is one lightweight `sys.triggers` query; call it once per harness, right after the pool connects.
 */
import sql from 'mssql';

/** The 14 hand-authored financial-invariant triggers from the baseline migration (NOT CodeGen's trgUpdate*). */
export const INVARIANT_TRIGGERS = [
  'trg_JournalEntry_BalancedOnLock',
  'trg_JEL_RecheckParentBalance',
  'trg_JournalEntry_Immutability',
  'trg_JEL_Immutability',
  'trg_JournalEntry_PeriodClose',
  'trg_JEBatch_Immutability',
  'trg_ACP_NoChains',
  'trg_AccountingPeriod_NoOverlap',
  'trg_JE_ReversalConsistency',
  'trg_JEBLI_Immutability',
  'trg_JEBatch_SummaryReconciles',
  'trg_JEBLDimension_Immutability',
  'trg_SJE_Immutability',
  'trg_SJELI_Immutability',
] as const;

/**
 * Assert every invariant trigger is present + enabled in `schema`. Throws an actionable error otherwise.
 * `LIKE 'trg[_]%'` uses a literal-underscore character class so it matches `trg_<Name>` but NOT CodeGen's
 * `trgUpdate<Entity>` timestamp triggers (a plain `trg_%` would, since `_` is a wildcard).
 */
export async function assertInvariantTriggers(pool: sql.ConnectionPool, schema = '__mj_BizAppsAccounting'): Promise<void> {
  const res = await pool.request().query(`
    SELECT t.name AS name, t.is_disabled AS is_disabled
    FROM sys.triggers t
    WHERE t.parent_id IN (SELECT object_id FROM sys.objects WHERE schema_id = SCHEMA_ID('${schema}'))
      AND t.name LIKE 'trg[_]%'`);
  const state = new Map<string, boolean>((res.recordset as Array<{ name: string; is_disabled: boolean }>).map(r => [r.name, r.is_disabled]));
  const missing = INVARIANT_TRIGGERS.filter(n => !state.has(n));
  const disabled = INVARIANT_TRIGGERS.filter(n => state.get(n) === true);
  if (missing.length === 0 && disabled.length === 0) return;

  throw new Error(
    `TRIGGER PRE-FLIGHT FAILED — the financial-invariant floor on ${schema} is not intact, so the raw-SQL ` +
    `bypass tests would be MEANINGLESS (a dropped/disabled trigger lets the "cheat" SQL succeed).\n` +
    `  Missing  (${missing.length}/${INVARIANT_TRIGGERS.length}): ${missing.join(', ') || 'none'}\n` +
    `  Disabled (${disabled.length}/${INVARIANT_TRIGGERS.length}): ${disabled.join(', ') || 'none'}\n` +
    `  FIX: if MISSING, re-run 'mjdev app migrate <slug> bizapps-accounting' to recreate the baseline triggers. ` +
    `If DISABLED, a prior harness run likely crashed between its teardown's DISABLE and ENABLE TRIGGER ALL — ` +
    `re-enable with 'ENABLE TRIGGER ALL ON ${schema}.<table>' (or just re-run a clean harness, which re-enables on teardown).`,
  );
}
