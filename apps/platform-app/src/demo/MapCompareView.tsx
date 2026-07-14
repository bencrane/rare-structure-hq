/**
 * MapCompareView — before/after money map: federal construction $ by
 * place-of-performance state in the 12 months BEFORE the OBBBA signature vs
 * everything SINCE. One toggle; dot scale is shared across both modes so the
 * border detonation reads honestly. Click a dot for before → since → multiple.
 *
 * Data is a baked sidecar snapshot (txn_events_combo_by_geo, PoP-state grain),
 * artifact-stamped. Trailing months undercount DoD-heavy states (~90-day FPDS
 * publish lag) — disclosed on the card.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

import snapshot from "./map-constr-before-since.json";

type StateRow = { state: string; beforeB: number; sinceB: number };
type Snap = {
  scope: string;
  beforeWindow: string;
  since: string;
  artifact: string;
  caveat: string;
  states: StateRow[];
};

const SNAP = snapshot as unknown as Snap;

const CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.8, 32.8], AK: [-152.0, 64.0], AZ: [-111.7, 34.3], AR: [-92.4, 34.9],
  CA: [-119.7, 36.8], CO: [-105.5, 39.0], CT: [-72.7, 41.6], DE: [-75.5, 39.0],
  DC: [-77.02, 38.9], FL: [-81.7, 28.1], GA: [-83.4, 32.7], HI: [-157.5, 20.3],
  ID: [-114.6, 44.4], IL: [-89.2, 40.0], IN: [-86.3, 39.9], IA: [-93.5, 42.1],
  KS: [-98.4, 38.5], KY: [-85.3, 37.5], LA: [-92.0, 31.1], ME: [-69.2, 45.4],
  MD: [-76.8, 39.0], MA: [-71.8, 42.3], MI: [-84.7, 43.4], MN: [-94.3, 46.3],
  MS: [-89.7, 32.8], MO: [-92.5, 38.4], MT: [-109.6, 47.0], NE: [-99.8, 41.5],
  NV: [-116.6, 39.3], NH: [-71.6, 43.7], NJ: [-74.7, 40.2], NM: [-106.1, 34.4],
  NY: [-75.5, 43.0], NC: [-79.4, 35.6], ND: [-100.5, 47.5], OH: [-82.8, 40.3],
  OK: [-97.5, 35.6], OR: [-120.6, 43.9], PA: [-77.8, 40.9], RI: [-71.5, 41.7],
  SC: [-80.9, 33.9], SD: [-100.2, 44.4], TN: [-86.3, 35.9], TX: [-99.3, 31.4],
  UT: [-111.7, 39.3], VT: [-72.7, 44.1], VA: [-78.8, 37.5], WA: [-120.4, 47.4],
  WV: [-80.6, 38.6], WI: [-89.8, 44.6], WY: [-107.6, 43.0], PR: [-66.4, 18.2],
};

const BIG_LABELS = 6;

export function MapCompareView() {
  const [mode, setMode] = useState<"before" | "since">("before");
  const [selected, setSelected] = useState<string | null>(null);

  const val = (s: StateRow) => (mode === "before" ? s.beforeB : s.sinceB);
  // Shared scale across both modes — the whole point of the toggle.
  const maxB = Math.max(...SNAP.states.map((s) => s.sinceB));
  const total = SNAP.states.reduce((sum, s) => sum + val(s), 0);

  const dots = SNAP.states
    .map((s) => {
      const c = CENTROIDS[s.state];
      const xy = c ? projectLonLat(c[0], c[1]) : null;
      return xy ? { ...s, xy } : null;
    })
    .filter((s): s is StateRow & { xy: { x: number; y: number } } => s != null)
    .sort((a, b) => val(b) - val(a));

  const r = (b: number) => 3 + 26 * Math.sqrt(Math.max(b, 0) / maxB);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-4 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The wave, on the ground
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {mode === "before"
              ? `Construction, the year before — $${Math.round(total)}B, scattered`
              : `Since the signature — $${Math.round(total)}B, detonating at the border`}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            {mode === "before" ? SNAP.beforeWindow : `since ${SNAP.since}`} · naics 23 · place of
            performance · {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="mb-3 flex items-center justify-center gap-2">
          {(["before", "since"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`border px-4 py-1.5 font-mono text-mono-xs uppercase tracking-[0.12em] transition-colors ${
                mode === m
                  ? "border-[color:var(--color-accent-primary)] text-[color:var(--color-text-accent)]"
                  : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-default)]"
              }`}
            >
              {m === "before" ? "12 months before" : "since signing"}
            </button>
          ))}
        </div>

        <svg
          viewBox="0 0 1000 590"
          className="w-full"
          role="img"
          aria-label="US map of construction obligations, dot size proportional to dollars, toggling before vs since OBBBA signing"
        >
          {STATE_PATHS.map((s) => (
            <path
              key={s.id}
              d={s.d}
              fill="var(--color-surface-sunken)"
              stroke="var(--color-border-subtle)"
              strokeWidth={0.7}
              strokeLinejoin="round"
            />
          ))}

          {[...dots].reverse().map((s) => (
            <circle
              key={s.state}
              cx={s.xy.x}
              cy={s.xy.y}
              r={r(val(s))}
              fill="var(--color-accent-primary)"
              fillOpacity={selected === s.state ? 0.6 : 0.42}
              stroke="var(--color-accent-primary)"
              strokeWidth={selected === s.state ? 1.6 : 1}
              style={{ cursor: "pointer", transition: "r 480ms ease" }}
              onClick={() => setSelected(selected === s.state ? null : s.state)}
            />
          ))}

          {dots.slice(0, BIG_LABELS).map((s) => (
            <text
              key={`lbl-${s.state}`}
              x={s.xy.x}
              y={s.xy.y + 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fontFamily="var(--font-mono, monospace)"
              fill="var(--color-text-primary)"
              pointerEvents="none"
            >
              ${val(s) >= 10 ? val(s).toFixed(0) : val(s).toFixed(1)}B
            </text>
          ))}

          {dots
            .filter((s) => s.state === selected)
            .map((s) => {
              const anchor = s.xy.x > 500 ? "end" : "start";
              const lx = s.xy.x + (anchor === "start" ? r(val(s)) + 10 : -r(val(s)) - 10);
              const ly = s.xy.y - r(val(s)) - 16;
              const mult = s.beforeB > 0 ? s.sinceB / s.beforeB : null;
              return (
                <g key={`sel-${s.state}`} pointerEvents="none">
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={anchor}
                    fontSize={13}
                    fontWeight={600}
                    fontFamily="var(--font-mono, monospace)"
                    fill="var(--color-text-primary)"
                  >
                    {s.state} · ${s.beforeB.toFixed(1)}B → ${s.sinceB.toFixed(1)}B
                  </text>
                  <text
                    x={lx}
                    y={ly + 13}
                    textAnchor={anchor}
                    fontSize={10}
                    fontFamily="var(--font-mono, monospace)"
                    fill="var(--color-text-muted)"
                    style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
                  >
                    {mult ? `${mult.toFixed(1)}× the prior year` : "no prior-year base"}
                  </text>
                </g>
              );
            })}
        </svg>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-3 text-center uppercase tracking-[0.12em]">
          dot area ∝ obligated $ · shared scale across both views · click a dot for before → since ·{" "}
          {SNAP.caveat}
        </Text>
      </div>
    </div>
  );
}
