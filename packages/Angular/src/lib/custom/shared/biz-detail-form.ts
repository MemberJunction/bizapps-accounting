import { CompositeKey } from '@memberjunction/core';
import { MJFormPresenterService, EntityFormConfig } from '@memberjunction/ng-base-forms';

/**
 * The TWO standardized bizapps detail surfaces (accounting + orders share this):
 *  - 'slide-in'  → the DEFAULT. A right-side panel over the current screen, for viewing/editing a row's detail.
 *  - 'dialog'    → a centered pop-up, for pages that already show the record on-screen (e.g. Company) where a
 *                  slide-in would imply editing the page + panel at once.
 *
 * Both render the SAME MJ form host (metadata-driven, editability from entity metadata) — we only standardize the
 * PRESENTATION + a curated, sleek config: no in-form toolbar (the chrome owns Save/Cancel), related-entity grids
 * hidden (focused + fast to open), a sane width (NOT the old 94vw near-fullscreen modal). Open read-only by default;
 * pass editMode to open straight into editing.
 *
 * Kept in bizapps-accounting/shared and exported so orders (which depends on accounting packages) uses the same two
 * surfaces — one consistent look across the BizApps suite, and a candidate to offer upstream to MJ later.
 */
export type BizDetailMode = 'slide-in' | 'dialog';

export interface BizDetailOptions {
  entityName: string;
  primaryKey: CompositeKey;
  /** Header title; falls back to the form host's default when omitted. */
  title?: string;
  /** 'slide-in' (default) or 'dialog'. */
  mode?: BizDetailMode;
  /** Open directly in edit mode. Default: read-only (existing records), edit-on-demand. */
  editMode?: boolean;
}

/** Curated, sleek config shared by both surfaces — the antidote to the old all-panels 94vw modal. */
const BIZ_DETAIL_CONFIG: EntityFormConfig = {
  Toolbar: null,               // the slide-in / dialog chrome owns Save + Cancel
  ShowRelatedEntities: false,  // keep the detail focused; also makes it open fast
  CollapsibleSections: true,
  EnableRecordLinks: false,
};

/**
 * Open an entity record in the standardized bizapps detail surface. Returns the MJFormOverlayRef
 * (AfterSaved / AfterClosed / Close / Form) so callers can react to save/close.
 */
export function openBizDetail(forms: MJFormPresenterService, opts: BizDetailOptions) {
  const slideIn = (opts.mode ?? 'slide-in') === 'slide-in';
  return forms.Open({
    EntityName: opts.entityName,
    PrimaryKey: opts.primaryKey,
    Title: opts.title,
    Presentation: slideIn ? 'slide-in' : 'dialog',
    ...(slideIn ? { WidthPx: 560 } : { Width: '760px' }),
    Config: { ...BIZ_DETAIL_CONFIG, WidthMode: slideIn ? 'full-width' : 'centered' },
    EditMode: opts.editMode,
    ShowFooter: true,
  });
}


/** Options for {@link openBizCreate} — same surfaces, no key (the form opens on a NEW record). */
export interface BizCreateOptions {
  entityName: string;
  title?: string;
  mode?: BizDetailMode;
  /** Default field values for the new record (e.g. a pre-picked parent). */
  newRecordValues?: Record<string, unknown>;
}

/**
 * Open a CREATE form in the standardized bizapps surface (slide-in by default). Same curated
 * config as {@link openBizDetail}; omitting the key is what puts the MJ form host in new-record
 * mode (new -> edit by default).
 */
export function openBizCreate(forms: MJFormPresenterService, opts: BizCreateOptions) {
  const slideIn = (opts.mode ?? 'slide-in') === 'slide-in';
  return forms.Open({
    EntityName: opts.entityName,
    Title: opts.title,
    NewRecordValues: opts.newRecordValues,
    Presentation: slideIn ? 'slide-in' : 'dialog',
    ...(slideIn ? { WidthPx: 560 } : { Width: '760px' }),
    Config: { ...BIZ_DETAIL_CONFIG, WidthMode: slideIn ? 'full-width' : 'centered' },
    ShowFooter: true,
  });
}
