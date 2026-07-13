/**
 * TerritoryView — the "where the entity sits" stage card: the prospect's STATE
 * (the committed Albers outlines, framed to Texas), their dot inside the
 * operating-radius ring, and the major military installations that anchor
 * federal demand — in-state plus the over-the-line neighbors that matter at
 * the El Paso corner.
 *
 * Geography is the committed STATE_PATHS layer; installations are a curated
 * slice of `federal_sites_lance` (site_source = military_base) — static
 * reference layers, disclosed on the rail like query beats disclose their
 * phrase. Distances are computed live (haversine) from the anchor.
 */

import { useMemo } from "react";

import { Text } from "@rare-structure-hq/ui";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

type Site = {
  name: string;
  lat: number;
  lon: number;
  /** Label placement nudge in projected px (collision control at the corner). */
  dx?: number;
  dy?: number;
  anchor?: "start" | "end";
};

type Territory = {
  zip: string;
  lat: number;
  lon: number;
  radiusMi: number;
  /** The state framed as "their" state (STATE_PATHS id). */
  stateId: string;
  /** Frame corners (lon/lat) — projected to the SVG viewBox. */
  frame: { west: number; east: number; north: number; south: number };
  /** Curated majors — federal_sites_lance, site_source=military_base. */
  sites: Site[];
};

const TERRITORIES: Record<string, Territory> = {
  "79925": {
    zip: "79925",
    lat: 31.80533,
    lon: -106.36884,
    radiusMi: 50,
    stateId: "TX",
    frame: { west: -107.9, east: -93.2, north: 36.9, south: 25.5 },
    sites: [
      { name: "Fort Bliss", lat: 31.813, lon: -106.421, dx: 3, dy: 6.5 },
      { name: "NG Las Cruces", lat: 32.276, lon: -106.935, dx: -3.5, anchor: "end" },
      { name: "White Sands Missile Range", lat: 33.16, lon: -106.426, dx: 3.5, dy: -2.5 },
      { name: "Holloman AFB", lat: 32.918, lon: -106.134, dx: 3.5, dy: 3 },
      { name: "Dyess AFB", lat: 32.423, lon: -99.839, dy: -3.5 },
      { name: "Goodfellow AFB", lat: 31.433, lon: -100.403, dy: 4.5 },
      { name: "Sheppard AFB", lat: 33.984, lon: -98.5, dy: -3.5 },
      { name: "NAS Fort Worth JRB", lat: 32.769, lon: -97.434, dx: 3.5 },
      { name: "Fort Cavazos", lat: 31.216, lon: -97.737, dx: 3.5 },
      { name: "Joint Base San Antonio", lat: 29.6, lon: -98.531, dx: 3.5 },
      { name: "Laughlin AFB", lat: 29.335, lon: -100.755, dy: 4.5 },
      { name: "NAS Corpus Christi", lat: 27.684, lon: -97.318, dx: 3.5 },
      { name: "Ellington Field JRB", lat: 29.616, lon: -95.17, dx: 3.5 },
      { name: "Red River Army Depot", lat: 33.434, lon: -94.356, dy: -3.5 },
    ],
  },
};

const R_EARTH_MI = 3958.8;
function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R_EARTH_MI * Math.asin(Math.sqrt(a));
}

export function TerritoryView({ zip }: { zip: string }) {
  const territory = TERRITORIES[zip];

  const scene = useMemo(() => {
    if (!territory) return null;
    const anchor = projectLonLat(territory.lon, territory.lat);
    if (!anchor) return null;
    const nw = projectLonLat(territory.frame.west, territory.frame.north);
    const se = projectLonLat(territory.frame.east, territory.frame.south);
    if (!nw || !se) return null;
    const north = projectLonLat(territory.lon, territory.lat + territory.radiusMi / 68.97);
    const ringR = north ? Math.hypot(north.x - anchor.x, north.y - anchor.y) : 17;
    const sites = territory.sites
      .map((s) => ({
        ...s,
        xy: projectLonLat(s.lon, s.lat),
        distMi: haversineMi(territory.lat, territory.lon, s.lat, s.lon),
      }))
      .filter((s): s is typeof s & { xy: { x: number; y: number } } => s.xy != null);
    return {
      anchor,
      ringR,
      sites,
      vb: `${nw.x} ${nw.y} ${se.x - nw.x} ${se.y - nw.y}`,
    };
  }, [territory]);

  if (!territory || !scene) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text as="div" size="mono-xs" mono color="subtle" className="uppercase tracking-[0.18em]">
          zip {zip} — no baked territory
        </Text>
      </div>
    );
  }

  const { anchor, ringR, sites, vb } = scene;
  const inRing = sites.filter((s) => s.distMi <= territory.radiusMi);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-4 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The territory
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-2 font-display font-semibold">
            {territory.zip} · {territory.radiusMi} mi
          </Text>
        </div>

        <svg
          viewBox={vb}
          className="w-full"
          role="img"
          aria-label={`${territory.stateId} with the ${territory.radiusMi}-mile operating area around zip ${territory.zip} and major military installations`}
        >
          {/* Neighbors first (dim context), their state last (lit structure). */}
          {STATE_PATHS.filter((s) => s.id !== territory.stateId).map((s) => (
            <path
              key={s.id}
              d={s.d}
              fill="var(--color-surface-base)"
              stroke="var(--color-border-subtle)"
              strokeWidth={0.5}
              strokeLinejoin="round"
            />
          ))}
          {STATE_PATHS.filter((s) => s.id === territory.stateId).map((s) => (
            <path
              key={s.id}
              d={s.d}
              fill="var(--color-surface-sunken)"
              stroke="var(--color-border-strong)"
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
          ))}

          {/* Operating radius — the area the yard actually serves. */}
          <circle
            cx={anchor.x}
            cy={anchor.y}
            r={ringR}
            fill="var(--color-accent-soft)"
            fillOpacity={0.35}
            stroke="var(--color-accent-primary)"
            strokeWidth={0.8}
            strokeDasharray="2.5 1.8"
          />

          {/* Major installations — in-ring lit, the rest structural. */}
          {sites.map((s) => {
            const lit = s.distMi <= territory.radiusMi;
            return (
              <g key={s.name} opacity={lit ? 1 : 0.6}>
                <rect
                  x={s.xy.x - 1.8}
                  y={s.xy.y - 1.8}
                  width={3.6}
                  height={3.6}
                  transform={`rotate(45 ${s.xy.x} ${s.xy.y})`}
                  fill={lit ? "var(--color-accent-primary)" : "var(--color-text-subtle)"}
                />
                <text
                  x={s.xy.x + (s.dx ?? 3.5)}
                  y={s.xy.y + (s.dy ?? 1.4)}
                  fontSize={4.6}
                  textAnchor={s.anchor ?? "start"}
                  fontFamily="var(--font-mono, monospace)"
                  fill={lit ? "var(--color-text-primary)" : "var(--color-text-muted)"}
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {s.name}
                  {lit ? ` · ${Math.round(s.distMi)} mi` : ""}
                </text>
              </g>
            );
          })}

          {/* The anchor — the entity's dot inside its area. */}
          <circle cx={anchor.x} cy={anchor.y} r={2} fill="var(--color-accent-primary)" />
          <circle
            cx={anchor.x}
            cy={anchor.y}
            r={4}
            fill="none"
            stroke="var(--color-accent-primary)"
            strokeWidth={0.6}
            opacity={0.6}
          />
        </svg>

        <div className="mt-4 flex items-center justify-center gap-8">
          <Text as="div" size="mono-xs" mono color="muted" className="uppercase tracking-[0.12em] tabular-nums">
            {inRing.length} installations in ring · {sites.length} on frame
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="uppercase tracking-[0.12em] tabular-nums">
            anchor {territory.lat.toFixed(4)}, {territory.lon.toFixed(4)}
          </Text>
          <Text as="div" size="mono-xs" mono color="subtle" className="uppercase tracking-[0.12em]">
            federal_sites · military_base
          </Text>
        </div>
      </div>
    </div>
  );
}
