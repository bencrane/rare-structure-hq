/**
 * Documenso embed theming — the signing surface dressed in Rare Structure's identity so it reads
 * as part of our proposal viewer, not a foreign widget. Two levers, both Platform-tier:
 *
 *   DOCUMENSO_CSS_VARS — the full `cssVars` role map (surfaces / borders / text / accent / radius).
 *                        Notably includes the `widget*` (left sign panel) and `fieldCard*` (the
 *                        signature/date field cards) roles, the surfaces that make the embed
 *                        actually look native rather than just recoloring the outer chrome.
 *   DOCUMENSO_EMBED_CSS — raw CSS injected into the iframe for what `cssVars` can't express
 *                        (type face, dark scrollbars). Kept to element + pseudo selectors only —
 *                        no betting on Documenso's internal class names.
 *
 * Values are LITERAL hex mirrored from `@rare-structure-hq/tokens` (`packages/tokens/src/tokens.ts`)
 * because the embed renders cross-origin in an iframe and cannot read our CSS custom properties.
 * Keep this file in lockstep with the token source of truth.
 *
 * Honored on the Documenso Platform tier; below it the embed renders in stock styling (and shows
 * the plan-gate), so the brand activates the moment Platform is live — no code change needed.
 */

// Token map (semantic role → hex), inlined for the cross-origin iframe:
//   surface.base #0a0e1a · raised #141827 · sunken #050812
//   border.subtle #1c2333 · default #2d3548
//   text.primary #fafafa · default #e4e4e7 · muted #a1a1aa · subtle #82828c · accent #7b9fd4
//   accent.primary #1e3a6e · onAccent #fafafa · state.error #f87171 · state.warn #fbbf24
export const DOCUMENSO_CSS_VARS = {
  background: "#0a0e1a", // surface.base
  foreground: "#e4e4e7", // text.default
  muted: "#141827", // surface.raised
  mutedForeground: "#a1a1aa", // text.muted
  popover: "#141827", // surface.raised
  popoverForeground: "#e4e4e7", // text.default
  card: "#050812", // surface.sunken — the document backdrop
  cardForeground: "#e4e4e7", // text.default
  cardBorder: "#1c2333", // border.subtle
  cardBorderTint: "#2d3548", // border.default
  fieldCard: "#141827", // surface.raised — signature/date field cards
  fieldCardBorder: "#2d3548", // border.default
  fieldCardForeground: "#e4e4e7", // text.default
  widget: "#141827", // surface.raised — the left signing widget panel
  widgetForeground: "#e4e4e7", // text.default
  border: "#2d3548", // border.default
  input: "#050812", // surface.sunken
  primary: "#1e3a6e", // accent.primary
  primaryForeground: "#fafafa", // text.onAccent
  secondary: "#141827", // surface.raised
  secondaryForeground: "#e4e4e7", // text.default
  accent: "#1e3a6e", // accent.primary
  accentForeground: "#fafafa", // text.onAccent
  destructive: "#f87171", // state.error
  destructiveForeground: "#0a0e1a", // surface.base — dark text on light red
  ring: "#7b9fd4", // text.accent — visible focus ring
  radius: "0px", // sharp-edge house style
  warning: "#fbbf24", // state.warn
} as const;

// Raw CSS injected into the embed (Platform). Three concerns:
//   1. Type face + dark scrollbars — identity touches `cssVars` can't express.
//   2. LAYOUT of Documenso's internal two-column. `.embed--DocumentContainer { row-reverse }` puts
//      the SIGN panel on the left and the agreement PDF on the right; `.embed--Root` caps the width.
//   3. CHROME the prospect shouldn't see: the header's document-title + role badge (the
//      "AO_Term_Plain_v1.pdf · Signer" cluster) and the "Full Name" signer field (the participant
//      name is already prefilled + locked into the body, so the signer only applies the signature).
//      The "N Field Remaining / Next Field" nav is intentionally KEPT.
// Class names + element ids are VERIFIED against Documenso's live embed bundle (header `<nav>`'s first
// child = title/badge group; the name input is `#full-name`), not guessed. They only take effect on
// Platform (where raw `css` is honored), the only tier that renders the surface at all.
export const DOCUMENSO_EMBED_CSS = `
  body, button, input, textarea, select {
    font-family: "Geist Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI",
      Helvetica, Arial, sans-serif;
  }
  * { scrollbar-color: #2d3548 #0a0e1a; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: #0a0e1a; }
  ::-webkit-scrollbar-thumb { background: #2d3548; border: 2px solid #0a0e1a; }
  ::-webkit-scrollbar-thumb:hover { background: #3f4b63; }

  /* No layout CSS: the V2 signing UI renders the sign panel left + PDF right by default and fills the
     iframe (the host route caps the outer width). The old V1 @media row-reverse / max-width rules
     were verified no-ops in V2 (row-reverse hit the PDF column, not the row parent; max-width was
     ignored by the inner full-bleed row) and were removed. */

  /* Hide the document title + role badge. In V2, .embed--DocumentWidgetHeader is the top app <nav>;
     its FIRST child is the left cluster (the <h1> document title + the "Signer"/"Approver" Badge).
     Hiding that cluster keeps the right-hand "N Fields Remaining" + Complete cluster (a separate flex
     child) intact; the Documenso logo here is already auto-hidden in embed mode. NOTE: Documenso
     exposes NO documented hook or id for the title/badge — this is necessarily a structural selector,
     verified against the Documenso V2 source (envelope-signer-header). Re-verify on Documenso upgrades. */
  .embed--DocumentWidgetHeader > div:first-child { display: none !important; }

  /* Keep the retained right-side cluster (Fields Remaining + Complete) pinned right once the left
     cluster above is hidden. */
  .embed--DocumentWidgetHeader { justify-content: flex-end !important; }

  /* Hide the signer "Full Name" field. Version-agnostic: target the stable #full-name id directly. The
     V2 signing UI does NOT wrap the field in .embed--DocumentWidgetForm (that class only wraps an
     assistant-mode fieldset in V2), so the old scoped selectors matched nothing and the field showed.
     Safe to hide because the name is prefilled from the recipient AND locked via lockName on the
     embed — the field stays populated, so signing/completion is unaffected. */
  label[for="full-name"],
  #full-name,
  :has(> #full-name) { display: none !important; }

  /* Hide the quick-actions panel (Download PDF / attachments). .embed--Actions is a documented embed
     theming hook (docs.documenso.com/developers/embedding/css-variables), stable across the V1/V2
     signing UIs — V1 has no Download action, so this is a no-op there. */
  .embed--Actions { display: none !important; }
`;

export const DOCUMENSO_DEFAULT_HOST = "https://app.documenso.com";
