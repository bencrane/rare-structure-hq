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

export interface OperatorSettings {
  renderMode: RenderMode;
}
