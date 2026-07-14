/**
 * FacilitiesAwardsMapView — a dozen real, active facilities awards on the US
 * map: exact place of performance, $ obligated to date, and what the work
 * actually is ("guarding the Smithsonian", "feeding Sheppard AFB"). The
 * voiceover names them; the card shows them. Baked from gtm_open_awards
 * (psc S*), artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

import snapshot from "./facilities-awards-map.json";

type AwardDot = {
  key: string;
  work: string;
  where: string;
  oblM: number;
  lat: number;
  lon: number;
  side: "left" | "right";
};
type Snap = { scope: string; asOf: string; artifact: string; awards: AwardDot[] };

const SNAP = snapshot as unknown as Snap;

const fmt = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${Math.round(m)}M`);

export function FacilitiesAwardsMapView() {
  const maxM = Math.max(...SNAP.awards.map((a) => a.oblM));
  const dots = SNAP.awards
    .map((a) => ({ ...a, xy: projectLonLat(a.lon, a.lat) }))
    .filter((a): a is AwardDot & { xy: { x: number; y: number } } => a.xy != null);

  const r = (m: number) => 5 + 16 * Math.sqrt(m / maxM);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-4 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The work, on the ground
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            Real contracts, running right now
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            active s-code awards · obligated to date · as of {SNAP.asOf} ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <svg
          viewBox="0 0 1000 590"
          className="w-full"
          role="img"
          aria-label="US map of a dozen real active facilities-services awards with dollars and work descriptions"
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

          {[...dots]
            .sort((a, b) => b.oblM - a.oblM)
            .map((a) => (
              <circle
                key={a.key}
                cx={a.xy.x}
                cy={a.xy.y}
                r={r(a.oblM)}
                fill="var(--color-accent-primary)"
                fillOpacity={0.45}
                stroke="var(--color-accent-primary)"
                strokeWidth={1.2}
              />
            ))}

          {dots.map((a) => {
            const anchor = a.side === "right" ? "start" : "end";
            const lx = a.xy.x + (a.side === "right" ? r(a.oblM) + 8 : -r(a.oblM) - 8);
            const ly = a.xy.y - 4;
            return (
              <g key={`lbl-${a.key}`} pointerEvents="none">
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  fontSize={12}
                  fontWeight={650}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-text-primary)"
                >
                  {fmt(a.oblM)} · {a.work}
                </text>
                <text
                  x={lx}
                  y={ly + 12}
                  textAnchor={anchor}
                  fontSize={9.5}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-text-muted)"
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {a.where}
                </text>
              </g>
            );
          })}
        </svg>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-3 text-center uppercase tracking-[0.12em]">
          dot area ∝ obligated $ on the award · every label is a single live contract · public award records
        </Text>
      </div>
    </div>
  );
}
