/**
 * Tailwind safelist sink — LITERAL class strings only.
 *
 * The layout primitives (Stack/Inline/Grid in @rare-structure-hq/ui) build their
 * gap / padding / grid-cols classes at runtime (`gap-${token}` via utils.ts space.*),
 * so Tailwind v4's source scanner never sees those classes as literals and silently
 * drops any value not also hand-written somewhere — e.g. `gap-8` (the CockpitPage
 * section rhythm) and `gap-10/12` were never generated, collapsing every section gap
 * to 0 (the cramped-sections bug across all /app pages).
 *
 * This file enumerates the full spacing scale (packages/tokens spacing keys) and the
 * responsive grid-cols the primitives can emit, as plain literal strings the scanner
 * picks up. It is intentionally NOT imported anywhere — Tailwind scans source files
 * directly. Keep every entry a literal (no template interpolation), or the scanner
 * misses it. (`@source inline(...)` would be cleaner but is unsupported in the pinned
 * Tailwind v4 beta.)
 */
export const TAILWIND_SAFELIST = [
  "gap-0 gap-1 gap-2 gap-3 gap-4 gap-5 gap-6 gap-8 gap-10 gap-12 gap-16 gap-20 gap-24",
  "p-0 p-1 p-2 p-3 p-4 p-5 p-6 p-8 p-10 p-12 p-16 p-20 p-24",
  "px-0 px-1 px-2 px-3 px-4 px-5 px-6 px-8 px-10 px-12 px-16 px-20 px-24",
  "py-0 py-1 py-2 py-3 py-4 py-5 py-6 py-8 py-10 py-12 py-16 py-20 py-24",
  "mt-0 mt-1 mt-2 mt-3 mt-4 mt-5 mt-6 mt-8 mt-10 mt-12 mt-16 mt-20 mt-24",
  "mb-0 mb-1 mb-2 mb-3 mb-4 mb-5 mb-6 mb-8 mb-10 mb-12 mb-16 mb-20 mb-24",
  "grid-cols-1 grid-cols-2 grid-cols-3 grid-cols-4 grid-cols-5 grid-cols-6 grid-cols-12",
  "sm:grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 sm:grid-cols-4 sm:grid-cols-5 sm:grid-cols-6 sm:grid-cols-12",
  "md:grid-cols-1 md:grid-cols-2 md:grid-cols-3 md:grid-cols-4 md:grid-cols-5 md:grid-cols-6 md:grid-cols-12",
  "lg:grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 lg:grid-cols-4 lg:grid-cols-5 lg:grid-cols-6 lg:grid-cols-12",
];
