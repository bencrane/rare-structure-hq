/**
 * PactGapView — the medical-staffing capacity map: VA disability-comp
 * recipients (demand) against exam-capable clinician supply, per county.
 * Dot size ∝ recipients; hot dots = worst recipients-per-clinician gap —
 * where the staffing primes must deploy and where the working-capital need
 * to stand up clinician capacity concentrates.
 *
 * Baked join: va_disability_comp_county (demand) × provider_360 (supply, zip→
 * county via census ZCTA rel). Snapshot, artifact-noted.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

import snapshot from "./pact-gap.json";

type County = {
  fips: string;
  county: string;
  state: string;
  lat: number;
  lon: number;
  recipients: number;
  clinicians: number;
  ratio: number | null;
  hiSevPct: number | null;
};
type Snap = {
  artifact: string;
  fy: number;
  nationalRecipients: number;
  nationalClinicians: number;
  note: string;
  counties: County[];
};

const SNAP = snapshot as unknown as Snap;

// Gap tiers (recipients per exam-capable clinician). National avg ≈ 2.8.
const tierColor = (r: number | null) => {
  if (r == null) return "var(--color-text-subtle)";
  if (r >= 15) return "var(--color-accent-primary)";
  if (r >= 8) return "var(--color-accent-primary)";
  return "var(--color-text-muted)";
};
const tierOpacity = (r: number | null) => (r == null ? 0.3 : r >= 15 ? 0.85 : r >= 8 ? 0.55 : 0.3);

export function PactGapView() {
  const [sel, setSel] = useState<string | null>(null);
  const maxR = Math.max(...SNAP.counties.map((c) => c.recipients));
  const natlRatio = SNAP.nationalRecipients / SNAP.nationalClinicians;

  const dots = SNAP.counties
    .map((c) => {
      const xy = projectLonLat(c.lon, c.lat);
      return xy ? { ...c, xy } : null;
    })
    .filter((c): c is County & { xy: { x: number; y: number } } => c != null);

  const rad = (rec: number) => 2 + 20 * Math.sqrt(rec / maxR);
  const worst = [...SNAP.counties]
    .filter((c) => c.recipients >= 10000 && c.ratio)
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
    .slice(0, 5);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-3 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            Demand outruns supply
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {(SNAP.nationalRecipients / 1e6).toFixed(1)}M veterans on comp · {natlRatio.toFixed(1)}{" "}
            per exam-capable clinician
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            fy{SNAP.fy} recipients (demand) ÷ active exam clinicians (supply) · hot = worst gap
          </Text>
        </div>

        <svg viewBox="0 0 1000 590" className="w-full" role="img" aria-label="County-level VA exam demand vs clinician supply gap">
          {STATE_PATHS.map((s) => (
            <path key={s.id} d={s.d} fill="var(--color-surface-sunken)" stroke="var(--color-border-subtle)" strokeWidth={0.6} strokeLinejoin="round" />
          ))}
          {[...dots].sort((a, b) => b.recipients - a.recipients).map((c) => (
            <circle
              key={c.fips}
              cx={c.xy.x}
              cy={c.xy.y}
              r={rad(c.recipients)}
              fill={tierColor(c.ratio)}
              fillOpacity={sel === c.fips ? 0.95 : tierOpacity(c.ratio)}
              stroke={c.ratio && c.ratio >= 15 ? "var(--color-accent-primary)" : "none"}
              strokeWidth={0.8}
              style={{ cursor: "pointer" }}
              onClick={() => setSel(sel === c.fips ? null : c.fips)}
            />
          ))}
          {dots
            .filter((c) => c.fips === sel)
            .map((c) => {
              const anchor = c.xy.x > 500 ? "end" : "start";
              const lx = c.xy.x + (anchor === "start" ? rad(c.recipients) + 8 : -rad(c.recipients) - 8);
              return (
                <g key={`s-${c.fips}`} pointerEvents="none">
                  <text x={lx} y={c.xy.y - rad(c.recipients) - 12} textAnchor={anchor} fontSize={13} fontWeight={600} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-primary)">
                    {c.county}, {c.state}
                  </text>
                  <text x={lx} y={c.xy.y - rad(c.recipients) + 1} textAnchor={anchor} fontSize={10} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-muted)" style={{ textTransform: "uppercase" }}>
                    {c.recipients.toLocaleString()} vets · {c.clinicians} clinicians · {c.ratio}:1 · {c.hiSevPct}% hi-sev
                  </text>
                </g>
              );
            })}
        </svg>

        <div className="mt-3 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <Text as="div" size="mono-xs" mono color="subtle" className="mb-1 uppercase tracking-[0.14em]">
              worst gaps (≥10k recipients)
            </Text>
            <div className="flex flex-wrap gap-x-5 gap-y-0.5">
              {worst.map((c) => (
                <Text key={c.fips} as="span" size="mono-xs" mono color="muted" className="tabular-nums">
                  {c.county} {c.state.slice(0, 2).toUpperCase()} · {c.ratio}:1
                </Text>
              ))}
            </div>
          </div>
          <Text as="div" size="mono-xs" mono color="subtle" className="shrink-0 text-right uppercase tracking-[0.12em]">
            dot ∝ recipients · click for county
          </Text>
        </div>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-3 max-w-3xl text-center">
          The gaps are military towns, not metros — Bell (Fort Cavazos), Onslow (Camp Lejeune),
          Comal/Guadalupe (San Antonio ring). Veteran-dense, clinician-thin, 70%+ high-severity: this
          is where the exam primes must deploy contract clinicians, and where standing that capacity
          up is a working-capital event.
        </Text>
      </div>
    </div>
  );
}
