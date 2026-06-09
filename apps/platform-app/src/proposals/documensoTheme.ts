/**
 * Documenso embed theming — `cssVars` mapped to Rare Structure's design tokens so the signing
 * surface (two-column: sign panel + document) reads native on our domain. Custom CSS + cssVars
 * are honored on the Documenso Platform tier; below it the embed renders in stock styling.
 *
 * Values mirror @rare-structure-hq/tokens (surface/border/text/accent), kept as literal hex
 * because the embed renders inside an iframe and cannot read our CSS custom properties.
 */
export const DOCUMENSO_CSS_VARS = {
  background: "#0a0e1a", // surface.base
  foreground: "#e4e4e7", // text.default
  muted: "#141827", // surface.raised
  mutedForeground: "#a1a1aa", // text.muted
  popover: "#141827",
  popoverForeground: "#e4e4e7",
  card: "#050812", // surface.sunken
  cardForeground: "#e4e4e7",
  cardBorder: "#1c2333", // border.subtle
  border: "#2d3548", // border.default
  input: "#050812",
  primary: "#1e3a6e", // accent.primary
  primaryForeground: "#fafafa", // text.onAccent
  secondary: "#141827",
  secondaryForeground: "#e4e4e7",
  accent: "#1e3a6e",
  accentForeground: "#fafafa",
  ring: "#7b9fd4", // text.accent — visible focus ring
  radius: "0px",
} as const;

export const DOCUMENSO_DEFAULT_HOST = "https://app.documenso.com";
