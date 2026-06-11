/**
 * AggregateView — the chart surface. An aggregate command swaps the map for
 * this: a hand-rolled horizontal bar chart that collapses the company
 * universe into one vantage (federal spend by industry, or by state).
 *
 * No chart library — the bars are token-styled HTML, the same hand-rolled
 * discipline as the SVG map. It proves the cockpit can take any vantage on
 * the data, not just the geographic one.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { CommandPill } from "./components/TerminalChrome";
import { aggregateBy } from "./data";
import { fmtUsd } from "./format";
import type { AggregateBar, AggregateSpec } from "./types";

export function AggregateView({
  spec,
  onInvokeCommand,
}: {
  spec: AggregateSpec;
  onInvokeCommand: () => void;
}) {
  const reduced = !!useReducedMotion();

  // The bars are LIVE — fetched from the BFF's precomputed chart endpoints. 3-state load
  // (loading / error / data), re-fetched when the grouping changes. Guarded against an
  // out-of-order resolve clobbering a newer grouping.
  const [bars, setBars] = useState<AggregateBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    aggregateBy(spec.groupBy)
      .then((b) => {
        if (!cancelled) setBars(b);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "chart failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spec.groupBy]);

  const max = Math.max(...bars.map((b) => b.total), 1);
  const total = bars.reduce((sum, b) => sum + b.total, 0);
  const dense = bars.length > 10;

  return (
    <motion.div
      className="relative flex h-screen w-full flex-col overflow-hidden"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="rs-scanlines pointer-events-none absolute inset-0 opacity-60" />

      {/* No TerminalHeader here: the LIVE / entities-tracked badge belongs to the live
          map only. Dropping it also lifts the chart heading to the top of the page. */}
      <div className="relative flex min-h-0 flex-1 flex-col px-6 pt-8 pb-2 sm:px-10 sm:pt-10">
        <ChartHeader spec={spec} total={total} groups={bars.length} reduced={reduced} />
        <div
          className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-5"
          style={{ gap: dense ? 6 : 12 }}
        >
          {loading && (
            <div className="text-center font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.18em]">
              Loading live federal data…
            </div>
          )}
          {error && !loading && (
            <div className="text-center font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.18em]">
              Live federal feed unavailable
            </div>
          )}
          {!loading &&
            !error &&
            bars.map((bar, i) => (
              <BarRow key={bar.key} bar={bar} max={max} index={i} dense={dense} reduced={reduced} />
            ))}
        </div>
      </div>

      <CommandPill reduced={reduced} idle={false} onClick={onInvokeCommand} />
    </motion.div>
  );
}

function ChartHeader({
  spec,
  total,
  groups,
  reduced,
}: {
  spec: AggregateSpec;
  total: number;
  groups: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      className="shrink-0 border-[color:var(--color-border-subtle)] border-b pb-4"
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduced ? 0 : 0.15 }}
    >
      <div className="font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase tracking-[0.18em]">
        Aggregate view
      </div>
      <div className="mt-2 flex items-end justify-between gap-6">
        <h2 className="font-display font-semibold text-[color:var(--color-text-primary)] text-display-sm uppercase leading-tight tracking-tight">
          {spec.title}
        </h2>
        <div className="shrink-0 text-right">
          <div className="font-display font-semibold text-[color:var(--color-text-accent)] text-display-sm leading-none tabular-nums">
            {fmtUsd(total)}
          </div>
          <div className="mt-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
            {spec.unitLabel} · {groups} groups
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BarRow({
  bar,
  max,
  index,
  dense,
  reduced,
}: {
  bar: AggregateBar;
  max: number;
  index: number;
  dense: boolean;
  reduced: boolean;
}) {
  const pct = Math.max((bar.total / max) * 100, 1.5);
  const rowH = dense ? 26 : 44;

  return (
    <div className="flex items-center gap-4">
      <div
        className={`shrink-0 truncate text-right font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase ${
          dense ? "w-56" : "w-72"
        }`}
      >
        {bar.label}
      </div>
      <div
        className="relative flex-1 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-base)]"
        style={{ height: rowH }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-[color:var(--color-accent-primary)]"
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{
            duration: reduced ? 0 : 0.7,
            delay: reduced ? 0 : 0.2 + index * 0.05,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      </div>
      <div className="w-28 shrink-0 text-right">
        <div
          className={`font-display font-semibold text-[color:var(--color-text-primary)] tabular-nums ${
            dense ? "text-body-sm" : "text-body-md"
          }`}
        >
          {fmtUsd(bar.total)}
        </div>
        {!dense && (
          <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
            {bar.count} compan{bar.count === 1 ? "y" : "ies"}
          </div>
        )}
      </div>
    </div>
  );
}
