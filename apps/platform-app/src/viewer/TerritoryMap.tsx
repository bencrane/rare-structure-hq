/**
 * TerritoryMap — where a collection's member firms' active work sits, on an
 * actual US map, with the military-installation overlay. Built for intake
 * calls: territories and installations only — NO firm names anywhere.
 *
 * Dots = zip3 territories (size ∝ sqrt committed $). Placement ladder,
 * always visually distinguished:
 *   placed    (solid dot)  — the award's own place-of-performance zip3
 *   estimated (hollow dot) — firm's modal zip3 (>=70% of its resolved
 *               in-scope awards), else firm HQ zip3. Labeled, never blended.
 * Crosses = active US military installations (DoD MIRTA points, from
 * military_installations_lance).
 *
 * FY23–25 won band is a client-side filter over baked band buckets — nothing
 * is baked to a band. Data: internal/territory-map.json (bake script in
 * session scratchpad; artifact stamped in header).
 */
import { useMemo, useState } from "react";

import { projectLonLat } from "@/demo/projection";
import { STATE_PATHS } from "@/demo/us-geo";
import baked from "@/internal/territory-map.json";

const data = baked as unknown as {
  as_of: string;
  artifact: string;
  definition: string;
  collections: Record<string, string>;
  rows: [string, string, string, string, number, number, number, number, number][];
  installations: [string, string, string, number, number][];
};

const BANDS = ["<$1M", "$1M-$10M", "$10M-$100M", "$100M+"];

const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

type Dot = {
  zip3: string;
  state: string;
  tier: "placed" | "estimated";
  awards: number;
  value: number;
  firms: number;
  x: number;
  y: number;
};

export function TerritoryMap() {
  const slugs = useMemo(
    () => Object.keys(data.collections).sort((a, b) =>
      data.collections[a].localeCompare(data.collections[b])),
    [],
  );
  const [slug, setSlug] = useState("equipment-heavy-construction");
  const [bands, setBands] = useState<Set<string>>(() => new Set(BANDS));
  const [showEst, setShowEst] = useState(true);
  const [showInst, setShowInst] = useState(true);

  const dots = useMemo(() => {
    const m = new Map<string, Dot>();
    for (const [c, zip3, band, tier, awards, value, firms, lat, lon] of data.rows) {
      if (c !== slug || !bands.has(band)) continue;
      if (tier === "estimated" && !showEst) continue;
      const k = `${zip3}|${tier}`;
      let d = m.get(k);
      if (!d) {
        const xy = projectLonLat(lon, lat);
        if (!xy) continue;
        d = { zip3, state: "", tier: tier as Dot["tier"], awards: 0, value: 0, firms: 0, x: xy.x, y: xy.y };
        m.set(k, d);
      }
      d.awards += awards;
      d.value += value;
      d.firms += firms; // upper bound across bands/tiers — fine for dot sizing
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [slug, bands, showEst]);

  const maxV = Math.max(1, ...dots.map((d) => d.value));
  const r = (v: number) => 2 + 16 * Math.sqrt(v / maxV);
  const totV = dots.reduce((s, d) => s + d.value, 0);
  const placedV = dots.filter((d) => d.tier === "placed").reduce((s, d) => s + d.value, 0);

  const inst = useMemo(
    () =>
      data.installations
        .map(([name, comp, st, lat, lon]) => {
          const xy = projectLonLat(lon, lat);
          return xy ? { name, comp, st, x: xy.x, y: xy.y } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [],
  );

  const toggleBand = (b: string) =>
    setBands((cur) => {
      const next = new Set(cur);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1250 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Territory map</h1>
      <p style={{ fontSize: 13, color: "#777", margin: "6px 0 4px", lineHeight: 1.5 }}>
        Where the selected collection's member firms' active committed work sits, by zip3
        territory. Solid dots = awards placed by their own place of performance. Hollow dots =
        estimated from the firm's dominant territory or HQ zip — labeled, never blended.
        Crosses = active US military installations (DoD MIRTA). No firm names on this surface.
      </p>
      <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 14px" }}>
        baked {data.as_of} · {data.artifact.replace("query-sidecar/", "")}
      </p>

      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{ fontSize: 15, padding: "8px 10px", maxWidth: 440 }}
        >
          {slugs.map((s) => (
            <option key={s} value={s}>{data.collections[s]}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "#555" }}>
          Won FY23–25:{" "}
          {BANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => toggleBand(b)}
              style={{
                margin: "0 3px", padding: "4px 9px", fontSize: 12.5, cursor: "pointer",
                border: `1px solid ${bands.has(b) ? "#1a1a1a" : "#ccc"}`,
                background: bands.has(b) ? "#1a1a1a" : "#fff",
                color: bands.has(b) ? "#fff" : "#888",
              }}
            >
              {b}
            </button>
          ))}
        </span>
        <label style={{ fontSize: 13, color: "#555" }}>
          <input type="checkbox" checked={showEst} onChange={(e) => setShowEst(e.target.checked)} />{" "}
          estimated placements
        </label>
        <label style={{ fontSize: 13, color: "#555" }}>
          <input type="checkbox" checked={showInst} onChange={(e) => setShowInst(e.target.checked)} />{" "}
          installations
        </label>
      </div>

      <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px" }}>
        {dots.length} territory dots · {fmt$(totV)} committed shown ({fmt$(placedV)} placed ·{" "}
        {fmt$(totV - placedV)} estimated)
      </p>

      <svg viewBox="0 0 1000 590" style={{ width: "100%", border: "1px solid #eee", background: "#fff" }} role="img"
        aria-label="US map of member work territories with military installations">
        {STATE_PATHS.map((s) => (
          <path key={s.id} d={s.d} fill="#f5f5f4" stroke="#ddd" strokeWidth={0.7} strokeLinejoin="round" />
        ))}

        {showInst
          ? inst.map((i, k) => (
              <g key={k} transform={`translate(${i.x},${i.y})`} opacity={0.55}>
                <title>{`${i.name} (${i.comp?.toUpperCase() ?? ""}, ${i.st})`}</title>
                <line x1={-2.6} y1={0} x2={2.6} y2={0} stroke="#8a6d3b" strokeWidth={1.1} />
                <line x1={0} y1={-2.6} x2={0} y2={2.6} stroke="#8a6d3b" strokeWidth={1.1} />
              </g>
            ))
          : null}

        {[...dots].reverse().map((d) => (
          <circle
            key={`${d.zip3}|${d.tier}`}
            cx={d.x}
            cy={d.y}
            r={r(d.value)}
            fill={d.tier === "placed" ? "#1a1a1a" : "none"}
            fillOpacity={d.tier === "placed" ? 0.35 : undefined}
            stroke="#1a1a1a"
            strokeWidth={d.tier === "placed" ? 0.8 : 1.2}
            strokeDasharray={d.tier === "placed" ? undefined : "3 2"}
            strokeOpacity={0.75}
          >
            <title>
              {`${d.zip3}xx · ${d.tier} · ${fmt$(d.value)} · ${d.awards} awards · ~${d.firms} firms`}
            </title>
          </circle>
        ))}
      </svg>

      <p style={{ fontSize: 12, color: "#888", marginTop: 8, lineHeight: 1.5 }}>
        Hover any dot or cross for detail. Dot area ∝ committed value. Estimated dots are dashed
        outlines: the award had no usable place of performance, so it sits at the firm's dominant
        work territory or HQ zip — a stated approximation, not a recorded location.
      </p>
    </div>
  );
}
