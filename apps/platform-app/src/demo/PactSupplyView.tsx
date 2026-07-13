/**
 * PactSupplyView — the candidate bench: SAM-registered medical/staffing firms
 * by HQ county. This is the population the exam primes can leverage — firms
 * that declared health (621/622/623) or staffing (5613) NAICS, whether or not
 * they've ever shown up as a formal subawardee. Dot size ∝ candidate firms.
 *
 * Read against the demand×supply gap card: the benches are in the big metros;
 * the worst-gap military towns are thin — so the primes must IMPORT clinician
 * capacity there, which is exactly the mobilization/working-capital event.
 *
 * Baked: gtm_sam_entities (SAM-active, declared codes) × census county.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

import snapshot from "./pact-supply.json";

type County = {
  fips: string;
  county: string;
  state: string;
  lat: number;
  lon: number;
  firms: number;
  withPrime: number;
  staffingFirms: number;
};
type Snap = { totalCandidates: number; note: string; counties: County[] };

const SNAP = snapshot as unknown as Snap;

export function PactSupplyView() {
  const [sel, setSel] = useState<string | null>(null);
  const maxF = Math.max(...SNAP.counties.map((c) => c.firms));
  const dots = SNAP.counties
    .map((c) => {
      const xy = projectLonLat(c.lon, c.lat);
      return xy ? { ...c, xy } : null;
    })
    .filter((c): c is County & { xy: { x: number; y: number } } => c != null);
  const rad = (f: number) => 2 + 18 * Math.sqrt(f / maxF);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-3 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The candidate bench
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {SNAP.totalCandidates.toLocaleString()} SAM medical &amp; staffing firms — where they're
            based
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            declared health (621/622/623) or staffing (5613) naics · hq county · dot ∝ firms
          </Text>
        </div>

        <svg viewBox="0 0 1000 590" className="w-full" role="img" aria-label="Medical/staffing candidate firms by HQ county">
          {STATE_PATHS.map((s) => (
            <path key={s.id} d={s.d} fill="var(--color-surface-sunken)" stroke="var(--color-border-subtle)" strokeWidth={0.6} strokeLinejoin="round" />
          ))}
          {[...dots].sort((a, b) => b.firms - a.firms).map((c) => (
            <circle
              key={c.fips}
              cx={c.xy.x}
              cy={c.xy.y}
              r={rad(c.firms)}
              fill="var(--color-accent-primary)"
              fillOpacity={sel === c.fips ? 0.95 : 0.5}
              stroke={sel === c.fips ? "var(--color-accent-primary)" : "none"}
              strokeWidth={1}
              style={{ cursor: "pointer" }}
              onClick={() => setSel(sel === c.fips ? null : c.fips)}
            />
          ))}
          {dots
            .filter((c) => c.fips === sel)
            .map((c) => {
              const anchor = c.xy.x > 500 ? "end" : "start";
              const lx = c.xy.x + (anchor === "start" ? rad(c.firms) + 8 : -rad(c.firms) - 8);
              return (
                <g key={`s-${c.fips}`} pointerEvents="none">
                  <text x={lx} y={c.xy.y - rad(c.firms) - 12} textAnchor={anchor} fontSize={13} fontWeight={600} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-primary)">
                    {c.county}, {c.state}
                  </text>
                  <text x={lx} y={c.xy.y - rad(c.firms) + 1} textAnchor={anchor} fontSize={10} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-muted)" style={{ textTransform: "uppercase" }}>
                    {c.firms} firms · {c.withPrime} won prime · {c.staffingFirms} staffing
                  </text>
                </g>
              );
            })}
        </svg>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-4 max-w-3xl text-center">
          The benches are deep in the metros — LA (804), Cook (700), Harris (545), Maricopa (479).
          But the worst-gap counties from the demand map — Bell, Onslow, Comal — are thin. Where
          demand is high and the local bench is empty, the primes must import clinicians, and that
          mobilization is the financeable moment. {SNAP.totalCandidates.toLocaleString()} named
          candidates; the top ones are one website-scrape from confirmed.
        </Text>
      </div>
    </div>
  );
}
