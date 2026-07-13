/**
 * PrimesView — the "who holds the money, and where it will actually go" stage
 * card. Top primes on the local equipment-scope open money, each with:
 * what's already been subbed on those awards, their HISTORICAL sub-out rate on
 * these combo types (relaxed: same NAICS or same PSC family; FSRS-reported
 * subawards ÷ their prime obligations on the same set), and the resulting
 * PROJECTED sub-out of today's open money — the work that lands with
 * subawardees long before the reporting shows it.
 *
 * Primes with no reported history are shown honestly as "unreported" (FSRS
 * under-reporting ≠ self-performing). Click a row for the preferred partners.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./primes-79925-100.json";

type Partner = { name: string; subM: number; edges: number; last: string };

type PrimeRow = {
  prime: string;
  uei: string;
  awards: number;
  openM: number;
  onAwardSubs: number;
  onAwardSubM: number;
  histEdges: number;
  histSubM: number;
  histPartners: number;
  lastSub: string | null;
  primeBaseM: number;
  rate: number | null;
  projectedM: number | null;
  topPartners: Partner[];
};

type Snapshot = {
  anchor: { zip: string; radius_mi: number };
  artifact: string;
  rows: PrimeRow[];
};

const SNAP = snapshot as unknown as Snapshot;
const ROWS = SNAP.rows;

const fmtM = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${m.toFixed(1)}M`);
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s(/&.-])[a-z]/g, (c) => c.toUpperCase());

export function PrimesView() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const projTotal = ROWS.reduce((s, r) => s + (r.projectedM ?? 0), 0);
  const maxOpen = ROWS[0]?.openM ?? 1;

  return (
    <div className="flex h-full flex-col px-10 py-8">
      <div className="mb-4 text-center">
        <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
          Who holds it — and who does the work
        </Text>
        <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
          Top primes · {SNAP.anchor.zip} · {SNAP.anchor.radius_mi} mi
        </Text>
        <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
          ≥{fmtM(projTotal)} projected to flow to subs · fsrs history, naics/psc-family relaxed ·{" "}
          {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
        </Text>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border border-[color:var(--color-border-subtle)]">
        <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_8rem_8.5rem_7rem] gap-3 border-[color:var(--color-border-subtle)] border-b bg-[color:var(--color-surface-sunken)] px-4 py-2">
          {["#", "prime", "open $", "subbed already", "hist. sub-out rate", "projected →subs"].map(
            (h, i) => (
              <Text
                key={h}
                as="div"
                size="mono-xs"
                mono
                color="subtle"
                className={`uppercase tracking-[0.12em] ${i >= 2 ? "text-right" : ""}`}
              >
                {h}
              </Text>
            ),
          )}
        </div>

        {ROWS.map((r, i) => {
          const isOpen = expanded === r.uei;
          const pct = Math.max((r.openM / maxOpen) * 100, 0.75);
          return (
            <div key={r.uei} className="border-[color:var(--color-border-subtle)] border-b">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : r.uei)}
                className={`relative grid w-full grid-cols-[2.5rem_minmax(0,1fr)_6rem_8rem_8.5rem_7rem] items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--color-surface-raised)] ${
                  isOpen ? "bg-[color:var(--color-surface-raised)]" : ""
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-[color:var(--color-accent-soft)] opacity-40"
                  style={{ width: `${pct}%` }}
                />
                <Text as="span" size="mono-xs" mono color="subtle" className="relative tabular-nums">
                  {i + 1}
                </Text>
                <span className="relative min-w-0">
                  <Text as="span" size="body-sm" color="primary" className="block truncate font-semibold">
                    {titleCase(r.prime)}
                  </Text>
                  <Text as="span" size="mono-xs" mono color="subtle" className="block truncate">
                    {r.awards} local award{r.awards === 1 ? "" : "s"}
                    {r.histEdges > 0 &&
                      ` · ${r.histEdges.toLocaleString()} lifetime subawards · ${r.histPartners} partners`}
                  </Text>
                </span>
                <Text as="span" size="body-sm" color="primary" className="relative text-right font-semibold tabular-nums">
                  {fmtM(r.openM)}
                </Text>
                <Text
                  as="span"
                  size="body-sm"
                  color={r.onAwardSubM > 0 ? "primary" : "subtle"}
                  className="relative text-right tabular-nums"
                >
                  {r.onAwardSubM > 0 ? `${fmtM(r.onAwardSubM)} · ${r.onAwardSubs}` : "—"}
                </Text>
                <Text
                  as="span"
                  size="body-sm"
                  color={r.rate != null ? "primary" : "subtle"}
                  className="relative text-right tabular-nums"
                >
                  {r.rate != null
                    ? `${(r.rate * 100).toFixed(1)}% of ${fmtM(r.primeBaseM)}`
                    : "unreported"}
                </Text>
                <Text
                  as="span"
                  size="body-sm"
                  color={r.projectedM != null ? "accent" : "subtle"}
                  className="relative text-right font-semibold tabular-nums"
                >
                  {r.projectedM != null ? `≥${fmtM(r.projectedM)}` : "—"}
                </Text>
              </button>

              {/* Preferred partners — the people actually doing the work. */}
              {isOpen && r.topPartners.length > 0 && (
                <div className="border-[color:var(--color-border-subtle)] border-t bg-[color:var(--color-surface-sunken)] px-4 py-3 pl-16">
                  <Text as="div" size="mono-xs" mono color="subtle" className="mb-2 uppercase tracking-[0.14em]">
                    preferred partners on these work types
                  </Text>
                  {r.topPartners.map((p) => (
                    <div key={p.name} className="flex items-baseline gap-4 py-0.5">
                      <Text as="span" size="body-sm" color="primary" className="min-w-0 flex-1 truncate">
                        {titleCase(p.name)}
                      </Text>
                      <Text as="span" size="mono-xs" mono color="muted" className="tabular-nums">
                        {fmtM(p.subM)} · {p.edges} subaward{p.edges === 1 ? "" : "s"} · last {p.last}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
              {isOpen && r.topPartners.length === 0 && (
                <div className="border-[color:var(--color-border-subtle)] border-t bg-[color:var(--color-surface-sunken)] px-4 py-3 pl-16">
                  <Text as="div" size="mono-xs" mono color="subtle" className="uppercase tracking-[0.12em]">
                    no fsrs-reported subawards on these work types — under-reporting is common;
                    absence here is not evidence of self-performance
                  </Text>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Text as="div" size="mono-xs" mono color="subtle" className="mt-3 text-center uppercase tracking-[0.12em]">
        projected = open $ × historical sub-out rate (floored at already-subbed) · click a prime for
        its partners
      </Text>
    </div>
  );
}
