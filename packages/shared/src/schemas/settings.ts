/**
 * Operator cockpit settings (the Settings tab).
 *
 * `renderMode` selects the originate pathway at "Confirm & Originate". It is resolved
 * SERVER-SIDE by the BFF from `public.operator_settings` and forwarded to edge_api — never
 * trusted from the client at confirm time.
 *   - 'through-docraptor'   (default): render the agreement PDF (DocRaptor) → Documenso envelope.
 *   - 'direct-to-documenso'          : the no-DocRaptor pathway (wired separately).
 */
export type RenderMode = "through-docraptor" | "direct-to-documenso";

/** The allowed values, runtime-usable for validation (BFF) and the toggle (frontend). */
export const RENDER_MODES: readonly RenderMode[] = ["through-docraptor", "direct-to-documenso"];

export const DEFAULT_RENDER_MODE: RenderMode = "through-docraptor";

/**
 * The direct-to-documenso LANE — a SECOND, INDEPENDENT sub-selector that only applies when
 * `renderMode === 'direct-to-documenso'`. It picks which direct-to-documenso lane "Confirm &
 * Originate" uses. Ignored under `through-docraptor`.
 *   - 'envelope-distribute'  (default — existing behavior): `/envelope/use` + distribute →
 *                            `.../{id}/confirm` (create_document_from_template). Stays the default.
 *   - 'template-prefill-draft'                            : `/api/v2/template/use`,
 *                            distributeDocument:false, prefilled from opportunity_specific_content →
 *                            `.../{id}/originate-prefilled-draft` (create_draft_document_from_template).
 *                            The new document stays DRAFT.
 */
export type DirectToDocumensoLane = "envelope-distribute" | "template-prefill-draft";

/** The allowed lane values, runtime-usable for validation (BFF) and the sub-selector (frontend). */
export const DIRECT_TO_DOCUMENSO_LANES: readonly DirectToDocumensoLane[] = [
  "envelope-distribute",
  "template-prefill-draft",
];

export const DEFAULT_DIRECT_TO_DOCUMENSO_LANE: DirectToDocumensoLane = "envelope-distribute";

export interface OperatorSettings {
  renderMode: RenderMode;
  /** The direct-to-documenso sub-lane. Only meaningful when `renderMode === 'direct-to-documenso'`. */
  directToDocumensoLane: DirectToDocumensoLane;
}
