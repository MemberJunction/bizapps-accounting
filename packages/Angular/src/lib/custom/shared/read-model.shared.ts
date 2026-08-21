/**
 * Shared helpers for the Stage-2 read-model dashboards (Trial Balance / AR,
 * Revenue & Tax, Batch Status, Intercompany Flow). Keeps the AG Grid theme
 * (built ONLY from MJ design tokens — no hardcoded colors) and the money/number
 * value-formatters in one place so the four dashboards stay consistent + DRY.
 */
import { ColDef, ColDefField, Theme, themeAlpine, ValueFormatterParams } from 'ag-grid-community';

/**
 * AG Grid theme expressed entirely with MJ semantic design tokens, so the grids
 * adapt to dark mode / white-labeling and pass the hardcoded-color CI gate.
 * Mirrors the core dashboards' `themeAlpine.withParams(...)` token mapping.
 */
export const READ_MODEL_GRID_THEME: Theme = themeAlpine.withParams({
  backgroundColor: 'var(--mj-bg-surface)',
  foregroundColor: 'var(--mj-text-primary)',
  textColor: 'var(--mj-text-primary)',
  borderColor: 'var(--mj-border-default)',
  chromeBackgroundColor: 'var(--mj-bg-surface-card)',
  headerBackgroundColor: 'var(--mj-bg-surface-card)',
  headerTextColor: 'var(--mj-text-secondary)',
  cellTextColor: 'var(--mj-text-primary)',
  subtleTextColor: 'var(--mj-text-muted)',
  dataBackgroundColor: 'var(--mj-bg-surface)',
  oddRowBackgroundColor: 'var(--mj-bg-surface-card)',
  rowHoverColor: 'var(--mj-bg-surface-hover, color-mix(in srgb, var(--mj-brand-primary) 5%, var(--mj-bg-surface)))',
  selectedRowBackgroundColor: 'color-mix(in srgb, var(--mj-brand-primary) 10%, var(--mj-bg-surface))',
  accentColor: 'var(--mj-brand-primary)',
  borderRadius: 'var(--mj-radius-sm)',
  browserColorScheme: 'inherit',
});

/** Sensible defaults shared by every read-model grid column. */
export const READ_MODEL_DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  resizable: true,
  minWidth: 90,
};

/** Format a numeric cell as a 2-decimal, thousands-grouped amount (en-US, fixed for determinism). */
export function moneyFormatter(params: ValueFormatterParams): string {
  const v = params.value;
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A right-aligned, money-formatted numeric column factory. */
export function moneyColumn<T>(field: ColDefField<T>, headerName: string, width = 130): ColDef<T> {
  return {
    field,
    headerName,
    width,
    type: 'numericColumn',
    valueFormatter: moneyFormatter,
  };
}

/** Format a stored UTC date/datetime string as an ISO date (YYYY-MM-DD), UTC — never local time. */
export function utcDateFormatter(params: ValueFormatterParams): string {
  const v = params.value;
  if (!v) return '';
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}
