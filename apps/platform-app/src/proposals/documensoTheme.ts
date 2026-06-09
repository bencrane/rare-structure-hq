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

// Raw CSS injected into the embed (Platform). Two concerns:
//   1. Type face + dark scrollbars — identity touches `cssVars` can't express.
//   2. LAYOUT of Documenso's internal two-column. `.embed--DocumentContainer { row-reverse }` puts
//      the SIGN panel on the left and the agreement PDF on the right; `.embed--Root` caps the
//      content width. These internal class names are VERIFIED against a live Platform embed
//      (`revenue-engineer-v3/src/app/native-proposal/page.tsx`), not guessed — they only take
//      effect on Platform (where raw `css` is honored), which is also the only tier that renders
//      the surface at all.
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
  @media (min-width: 768px) {
    .embed--DocumentContainer { flex-direction: row-reverse; }
    .embed--Root { max-width: 72rem; }
  }
`;

export const DOCUMENSO_DEFAULT_HOST = "https://app.documenso.com";
