/**
 * ConstrPieView — where federal construction money went, FY23–FY25, as a
 * donut by PSC-family bucket (new buildings / repair & alteration / barrier
 * line / roads / other). Baked sidecar snapshot, artifact-stamped.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./constr-pie-fy23-25.json";

type Slice = { key: string; label: string; sub: string; oblB: number; firms: number };
type Snap = { scope: string; window: string; artifact: string; slices: Slice[] };

const DEFAULT_SNAP = snapshot as unknown as Snap;
export type PieSnap = Snap;

// Slice fills — accent at stepped opacities so the palette stays in-system.
const OPACITIES = [0.9, 0.75, 0.62, 0.5, 0.4, 0.32, 0.25, 0.19, 0.14, 0.1];

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) => {
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOuter, a0);
  const o1 = polar(cx, cy, rOuter, a1);
  const i0 = polar(cx, cy, rInner, a1);
  const i1 = polar(cx, cy, rInner, a0);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i0.x} ${i0.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
};

export function ConstrPieView({
  snap = DEFAULT_SNAP,
  kicker = "The base period",
  title,
  subtitle,
  centerLabel = "fy23–fy25",
  pctDecimals = 0,
}: {
  snap?: Snap;
  kicker?: string;
  title?: string;
  subtitle?: string;
  centerLabel?: string;
  pctDecimals?: number;
}) {
  const SNAP = snap;
  const [selected, setSelected] = useState<string | null>(null);
  const total = SNAP.slices.reduce((s, x) => s + x.oblB, 0);

  let angle = 0;
  const slices = SNAP.slices.map((s, i) => {
    const sweep = (s.oblB / total) * 360;
    const out = { ...s, a0: angle, a1: angle + sweep, opacity: OPACITIES[i % OPACITIES.length] };
    angle += sweep;
    return out;
  });

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-6 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The base period
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {title ?? `$${Math.round(total)}B of construction — where it went`}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            {subtitle ?? `${SNAP.window} · naics 23 · psc-family buckets`} ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="flex items-center justify-center gap-12">
          <svg viewBox="0 0 360 360" className="w-[340px] shrink-0" role="img" aria-label="Donut chart of FY23–25 federal construction obligations by work bucket">
            {slices.map((s) => (
              <path
                key={s.key}
                d={arcPath(180, 180, 150, 82, s.a0, s.a1)}
                fill="var(--color-accent-primary)"
                fillOpacity={selected === s.key ? Math.min(s.opacity + 0.15, 1) : s.opacity}
                stroke="var(--color-surface-base)"
                strokeWidth={2}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(selected === s.key ? null : s.key)}
              />
            ))}
            <text
              x={180}
              y={172}
              textAnchor="middle"
              fontSize={30}
              fontWeight={650}
              fontFamily="var(--font-display, sans-serif)"
              fill="var(--color-text-primary)"
            >
              ${Math.round(total)}B
            </text>
            <text
              x={180}
              y={196}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-mono, monospace)"
              fill="var(--color-text-muted)"
              style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              {centerLabel}
            </text>
          </svg>

          <div className="flex min-w-0 flex-col gap-3">
            {slices.map((s) => {
              const pct = (s.oblB / total) * 100;
              const isSel = selected === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelected(isSel ? null : s.key)}
                  className={`flex items-baseline gap-3 border px-4 py-2.5 text-left transition-colors ${
                    isSel
                      ? "border-[color:var(--color-accent-primary)]"
                      : "border-[color:var(--color-border-subtle)]"
                  }`}
                >
                  <span
                    className="mt-0.5 inline-block h-3 w-3 shrink-0 self-center"
                    style={{
                      background: "var(--color-accent-primary)",
                      opacity: s.opacity,
                    }}
                  />
                  <span className="min-w-0">
                    <Text as="span" size="body-sm" color="primary" className="font-semibold">
                      {s.label}
                    </Text>
                    <Text as="span" size="body-sm" color="muted">
                      {s.sub.startsWith("→") ? ` ${s.sub}` : ` — ${s.sub}`}
                    </Text>
                    <Text as="div" size="mono-xs" mono color="muted" className="tabular-nums">
                      ${s.oblB.toFixed(1)}B · {pct.toFixed(pctDecimals)}% · {s.firms.toLocaleString()} firms
                    </Text>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-6 text-center uppercase tracking-[0.12em]">
          slice ∝ obligated $ · click a slice or row to highlight · firms = distinct winning ueis in window
        </Text>
      </div>
    </div>
  );
}
