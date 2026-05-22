/**
 * Display formatters for the Rare Structure cockpit. Kept local to `src/demo/**`.
 */

/** Compact USD — 12_400_000 → "$12.4M", 1_900_000_000 → "$1.9B". */
export function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

/** Full USD with thousands separators — "$12,400,000". */
export function fmtUsdFull(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Integer with thousands separators. */
export function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** ISO date → "May 12, 2026". */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** ISO date → "May 2026". */
export function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
