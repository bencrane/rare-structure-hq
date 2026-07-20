/**
 * MoneyMapView — the macro money map: every dollar obligated since OBBBA
 * signing, ALL work types (no construction filter yet — this is the wide
 * frame), as place-of-performance dots across the country sized by $.
 * A few dots carry callouts: the state's total and what its dominant
 * combo actually is (labor_dim work_summary).
 *
 * Data is a baked sidecar snapshot (txn_events_combo_by_geo, PoP-state
 * grain), artifact-stamped. Dots sit on state centroids — the honest grain
 * for the full ledger (transaction rows carry state/county, not coordinates).
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

import snapshot from "./money-map-obbba.json";

type StateRow = { state: string; oblB: number; topComboB: number | null; topWork: string | null };
type Snap = { since: string; artifact: string; states: StateRow[] };

const DEFAULT_SNAP = snapshot as unknown as Snap;
export type MoneyMapSnap = Snap;

// Interior label points per state (lon, lat) — standard centroid values.
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

// Callouts: a few dots get "$X — what the money is for" (label side per state).
// States whose $ figure is printed by default (the rest reveal on click).
const BIG_LABELS = 8;

const firstClause = (s: string | null) => {
  if (!s) return "";
  const cut = s.split(/[:.]/)[0];
  return cut.length > 52 ? `${cut.slice(0, 50)}…` : cut;
};

export function MoneyMapView({
  snap = DEFAULT_SNAP,
  kicker = "Where the money lands",
  title,
  subtitle,
  scaleMaxB,
}: {
  snap?: Snap;
  kicker?: string;
  title?: string;
  subtitle?: string;
  /** Pin the dot scale (e.g. across a before/after card pair). */
  scaleMaxB?: number;
}) {
  const SNAP = snap;
  const [selected, setSelected] = useState<string | null>(null);
  const total = SNAP.states.reduce((s, r) => s + r.oblB, 0);
  const maxB = scaleMaxB ?? SNAP.states[0]?.oblB ?? 1;
  const dots = SNAP.states
    .map((s) => {
      const c = CENTROIDS[s.state];
      const xy = c ? projectLonLat(c[0], c[1]) : null;
      return xy ? { ...s, xy } : null;
    })
    .filter((s): s is StateRow & { xy: { x: number; y: number } } => s != null);

  const r = (b: number) => 3 + 26 * Math.sqrt(b / maxB);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-4 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            {kicker}
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {title ?? `$${Math.round(total)}B obligated since signing — everywhere, unevenly`}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            {subtitle ?? `all work types · place of performance · since ${SNAP.since}`} ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <svg viewBox="0 0 1000 590" className="w-full" role="img" aria-label="US map of obligations since OBBBA signing, dot size proportional to dollars">
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

          {/* $ dots — biggest last so small states stay clickable visually */}
          {[...dots].reverse().map((s) => (
            <circle
              key={s.state}
              cx={s.xy.x}
              cy={s.xy.y}
              r={r(s.oblB)}
              fill="var(--color-accent-primary)"
              fillOpacity={selected === s.state ? 0.6 : 0.42}
              stroke="var(--color-accent-primary)"
              strokeWidth={selected === s.state ? 1.6 : 1}
              style={{ cursor: "pointer" }}
              onClick={() => setSelected(selected === s.state ? null : s.state)}
            />
          ))}

          {/* Default labels: just the big $ figure on the largest dots. */}
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
              ${s.oblB.toFixed(0)}B
            </text>
          ))}

          {/* Click detail: state · $ + the dominant combo's work language. */}
          {dots
            .filter((s) => s.state === selected)
            .map((s) => {
              const anchor = s.xy.x > 500 ? "end" : "start";
              const lx = s.xy.x + (anchor === "start" ? r(s.oblB) + 10 : -r(s.oblB) - 10);
              const ly = s.xy.y - r(s.oblB) - 16;
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
                    {s.state} · ${s.oblB.toFixed(1)}B
                  </text>
                  {s.topComboB != null ? (
                    <text
                      x={lx}
                      y={ly + 13}
                      textAnchor={anchor}
                      fontSize={10}
                      fontFamily="var(--font-mono, monospace)"
                      fill="var(--color-text-muted)"
                      style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
                    >
                      ${s.topComboB.toFixed(1)}B {firstClause(s.topWork)}
                    </text>
                  ) : null}
                </g>
              );
            })}
        </svg>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-3 text-center uppercase tracking-[0.12em]">
          dot area ∝ obligated $ · click a dot for the state's largest naics×psc combo
        </Text>
      </div>
    </div>
  );
}
