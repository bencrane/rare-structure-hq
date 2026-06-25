/**
 * AggregateView — the chart surface. An aggregate swaps the map for a hand-rolled
 * horizontal bar chart that collapses the universe into one vantage.
 *
 * Two drivers, one renderer:
 *   • `spec`     — a CANNED vantage (federal spend by industry/state/agency); the bars are
 *                  fetched from the BFF's precomputed warm chart endpoints.
 *   • `resolved` — a DYNAMIC aggregate from a free-typed `/ask` query (breakdown / total /
 *                  distribution / top-N over award actions); the bars arrive pre-resolved,
 *                  scoped to exactly the cohort + window the operator asked for.
 *
 * No chart library — the bars are token-styled HTML, the same hand-rolled discipline as the
 * SVG map.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { CommandPill } from "./components/TerminalChrome";
import { aggregateBy } from "./data";
import { fmtUsd } from "./format";
import type { AggregateBar, AggregateSpec, ResolvedAggregate } from "./types";

export function AggregateView({
  spec,
  resolved,
  onInvokeCommand,
}: {
  spec?: AggregateSpec;
  resolved?: ResolvedAggregate;
  onInvokeCommand: () => void;
}) {
  const reduced = !!useReducedMotion();

  // Canned vantage → fetch warm chart bars (3-state load). Dynamic → bars already in hand.
  const [fetched, setFetched] = useState<AggregateBar[]>([]);
  const [loading, setLoading] = useState(!resolved);
  const [error, setError] = useState<string | null>(null);

  const cannedGroupBy = resolved ? undefined : spec?.groupBy;
  useEffect(() => {
    if (!cannedGroupBy) return; // dynamic (resolved) or no spec: nothing to fetch
    let cancelled = false;
    setLoading(true);
    setError(null);
    aggregateBy(cannedGroupBy)
      .then((b) => {
        if (!cancelled) setFetched(b);
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
  }, [cannedGroupBy]);

  const bars = resolved ? resolved.bars : fetched;
  const title = resolved ? resolved.title : (spec?.title ?? "Aggregate");
  const isUsd = resolved ? resolved.unitLabel === "USD obligated" : true; // canned charts are USD
  const max = Math.max(...bars.map((b) => b.total), 1);
  const total = bars.reduce((sum, b) => sum + b.total, 0);
  const dense = bars.length > 10;

  // Header headline + meta line differ by driver.
  const headline = isUsd ? fmtUsd(total) : total.toLocaleString();
  const metaLine = resolved
    ? `${resolved.matchedRows.toLocaleString()} award actions · ${bars.length}${
        resolved.totalGroups > bars.length ? ` of ${resolved.totalGroups}` : ""
      } groups`
    : `${spec?.unitLabel ?? ""} · ${bars.length} groups`;

  return (
    <motion.div
      className="relative flex h-screen w-full flex-col overflow-hidden"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="rs-scanlines pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative flex min-h-0 flex-1 flex-col px-6 pt-8 pb-2 sm:px-10 sm:pt-10">
        <ChartHeader
          title={title}
          headline={headline}
          metaLine={metaLine}
          notApplied={resolved?.notApplied ?? []}
          reduced={reduced}
        />
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
          {!loading && !error && bars.length === 0 && (
            <div className="text-center font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.18em]">
              No matching award actions
            </div>
          )}
          {!loading &&
            !error &&
            bars.map((bar, i) => (
              <BarRow
                key={bar.key}
                bar={bar}
                max={max}
                index={i}
                dense={dense}
                isUsd={isUsd}
                countNoun={resolved ? "action" : "company"}
                reduced={reduced}
              />
            ))}
        </div>
      </div>

      <CommandPill reduced={reduced} idle={false} onClick={onInvokeCommand} />
    </motion.div>
  );
}

function ChartHeader({
  title,
  headline,
  metaLine,
  notApplied,
  reduced,
}: {
  title: string;
  headline: string;
  metaLine: string;
  notApplied: string[];
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
          {title}
        </h2>
        <div className="shrink-0 text-right">
          <div className="font-display font-semibold text-[color:var(--color-text-accent)] text-display-sm leading-none tabular-nums">
            {headline}
          </div>
          <div className="mt-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
            {metaLine}
          </div>
        </div>
      </div>
      {notApplied.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tracking-[0.14em]">
            Not applied:
          </span>
          {notApplied.map((u) => (
            <span
              key={u}
              className="border border-[color:var(--color-border-default)] px-1.5 py-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs"
            >
              {u}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function BarRow({
  bar,
  max,
  index,
  dense,
  isUsd,
  countNoun,
  reduced,
}: {
  bar: AggregateBar;
  max: number;
  index: number;
  dense: boolean;
  isUsd: boolean;
  countNoun: "company" | "action";
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
      <div className="w-36 shrink-0 text-right">
        <div
          className={`font-display font-semibold text-[color:var(--color-text-primary)] tabular-nums ${
            dense ? "text-body-sm" : "text-body-md"
          }`}
        >
          {isUsd ? fmtUsd(bar.total) : bar.total.toLocaleString()}
        </div>
        {!dense && (
          <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
            {bar.count.toLocaleString()}{" "}
            {bar.count === 1 ? countNoun : countNoun === "company" ? "companies" : "actions"}
          </div>
        )}
        {/* Distribution shape per group — only when the aggregate computed it (dynamic /ask). */}
        {!dense && (bar.median != null || bar.p90 != null) && (
          <div className="mt-0.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs tabular-nums">
            {bar.median != null && <>med {fmtUsd(bar.median)}</>}
            {bar.median != null && bar.p90 != null && " · "}
            {bar.p90 != null && <>p90 {fmtUsd(bar.p90)}</>}
          </div>
        )}
      </div>
    </div>
  );
}
