/**
 * Market surface shared bits — the house control classes (same treatments as
 * TemplateEditor/Research) plus the small formatting helpers the audience
 * builder's components share. No components here; just constants + pure fns.
 */

import type { EntityRow } from "./api";

export const inputCls =
  "w-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2.5 text-[color:var(--color-text-primary)] text-body-sm outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]";

export const selectCls = `${inputCls} cursor-pointer`;

export const primaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-4 py-2.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)] disabled:cursor-not-allowed disabled:opacity-40";

export const secondaryBtnCls =
  "flex items-center justify-center gap-2 border border-[color:var(--color-border-default)] px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em] transition-colors hover:border-[color:var(--color-text-accent)] hover:text-[color:var(--color-text-accent)] disabled:cursor-not-allowed disabled:opacity-40";

export const labelCls =
  "block font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

export const thCls =
  "px-4 py-2.5 text-left font-mono font-normal text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]";

// ── Formatting ───────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmtUsd = (n: number | null | undefined): string => (n == null ? "—" : usd.format(n));
export const fmtNum = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("en-US");

/**
 * Parse a money input with $-shorthand: "250k" → 250_000, "1.5m" → 1_500_000,
 * "2b" → 2_000_000_000, plain digits (commas/$ tolerated) pass through.
 * Returns undefined for empty/unparseable input (= no filter).
 */
export function parseMoney(raw: string): number | undefined {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[$,\s]/g, "");
  if (!s) return undefined;
  const m = s.match(/^([0-9]*\.?[0-9]+)([kmb])?$/);
  if (!m) return undefined;
  const n = Number.parseFloat(m[1]);
  if (Number.isNaN(n)) return undefined;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  return Math.round(n * mult);
}

/** Comma/space-separated state codes → uppercase list (empty → undefined). */
export function parseStates(raw: string): string[] | undefined {
  const list = raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

// ── Designation badges ───────────────────────────────────────────────────────

/**
 * Short designation labels from the row's verbatim flags: `dsbs_certs` (array or
 * comma string) when present, else any truthy `dsbs_*` / `fsrs_*` boolean flag.
 */
export function designations(row: EntityRow): string[] {
  const out: string[] = [];
  const certs = row.dsbs_certs;
  if (Array.isArray(certs)) {
    for (const c of certs) out.push(String(c).toUpperCase());
  } else if (typeof certs === "string" && certs.trim()) {
    for (const c of certs.split(",")) if (c.trim()) out.push(c.trim().toUpperCase());
  } else {
    for (const [k, v] of Object.entries(row)) {
      if (v === true && k.startsWith("dsbs_") && k !== "dsbs_certs") {
        out.push(k.slice(5).toUpperCase());
      }
    }
  }
  for (const [k, v] of Object.entries(row)) {
    if (v === true && k.startsWith("fsrs_")) {
      out.push(k === "fsrs_any_designation" ? "FSRS" : k.slice(5).toUpperCase());
    }
  }
  return [...new Set(out)];
}
