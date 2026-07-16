/**
 * BucketExplorer — interactive segment table over the work-anchored buckets.
 *
 * Select one or more buckets (selection = union of their pairs; per-firm
 * metrics sum across selected buckets since the pair sets are disjoint), set
 * the FY23–25 won min/max, and read the segment table live. Client-side over
 * baked per-firm rows (bucket-firms.json).
 *
 * Representation rule (operator ruling 2026-07-16): NEVER blend vehicle
 * ceilings into award-size statistics. Committed work (standalone + orders,
 * at contract value) carries the size stats; vehicle seats are a separate,
 * explicitly-labeled capacity line.
 */
import { useMemo, useState } from "react";

import baked from "@/internal/bucket-firms.json";

const data = baked as unknown as {
  window: string;
  artifact: string;
  conventions: string;
  precondition: string;
  columns: string[];
  // bucket, uei, won, committed_ct, committed_value, committed_runway,
  // vehicle_ct, vehicle_ceiling, ceiling_headroom, committed_values_k
  rows: [string, string, number, number, number, number, number, number, number, number[]][];
};

const BUCKETS = [
  "Facilities Support & Operations",
  "Security & Protective Services",
  "Building Services",
  "Equipment-Heavy Construction",
  "Waste Management & Sanitation",
  "Environmental Remediation & Services",
  "Aerospace, Defense & Space Manufacturing",
  "Medical & Clinical Staffing",
  "Federal IT Staffing",
  "Engineering & Technical Staffing",
  "Program & Management Support Staffing",
  "Administrative & Office Support Staffing",
  "Medical Devices & Supplies Manufacturing",
  "Industrial Machinery & Components Manufacturing",
  "Food Production",
  "Clothing & Textiles",
];

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

/** Parse "$10m", "1.5b", "250k", "1000000" → dollars; null = blank/invalid. */
function parseMoney(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!t) return null;
  const m = t.match(/^([0-9]*\.?[0-9]+)([kmb])?$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  const mult = m[2] === "b" ? 1e9 : m[2] === "m" ? 1e6 : m[2] === "k" ? 1e3 : 1;
  return n * mult;
}

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;

type FirmAgg = {
  won: number;
  committedCt: number;
  committedValue: number;
  committedRunway: number;
  vehicleCt: number;
  vehicleCeiling: number;
  ceilingHeadroom: number;
  committedK: number[];
};

export function BucketExplorer() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["Facilities Support & Operations"]),
  );
  const [minStr, setMinStr] = useState("$1m");
  const [maxStr, setMaxStr] = useState("$10m");

  const toggle = (b: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  };

  const min = parseMoney(minStr);
  const max = parseMoney(maxStr);

  const result = useMemo(() => {
    if (selected.size === 0) return null;
    const byFirm = new Map<string, FirmAgg>();
    for (const [
      bucket,
      uei,
      won,
      committedCt,
      committedValue,
      committedRunway,
      vehicleCt,
      vehicleCeiling,
      ceilingHeadroom,
      committedK,
    ] of data.rows) {
      if (!selected.has(bucket)) continue;
      const cur = byFirm.get(uei) ?? {
        won: 0,
        committedCt: 0,
        committedValue: 0,
        committedRunway: 0,
        vehicleCt: 0,
        vehicleCeiling: 0,
        ceilingHeadroom: 0,
        committedK: [],
      };
      cur.won += won;
      cur.committedCt += committedCt;
      cur.committedValue += committedValue;
      cur.committedRunway += committedRunway;
      cur.vehicleCt += vehicleCt;
      cur.vehicleCeiling += vehicleCeiling;
      cur.ceilingHeadroom += ceilingHeadroom;
      cur.committedK.push(...committedK);
      byFirm.set(uei, cur);
    }
    const lo = min ?? 0;
    const hi = max ?? Number.POSITIVE_INFINITY;
    const members = [...byFirm.values()].filter(
      (f) => f.committedCt + f.vehicleCt >= 1 && f.won >= lo && f.won < hi,
    );
    const committedAwards = members.flatMap((f) => f.committedK.map((k) => k * 1000));
    const vehicleHolders = members.filter((f) => f.vehicleCt > 0);
    return {
      firms: members.length,
      wonMed: median(members.map((f) => f.won)),
      wonAvg: avg(members.map((f) => f.won)),
      wonTotal: members.reduce((n, f) => n + f.won, 0),
      cBookMed: median(members.map((f) => f.committedValue)),
      cBookAvg: avg(members.map((f) => f.committedValue)),
      cBookTotal: members.reduce((n, f) => n + f.committedValue, 0),
      cAwardsMed: median(members.map((f) => f.committedCt)),
      cAwardCt: committedAwards.length,
      cAwardMed: median(committedAwards),
      cAwardAvg: avg(committedAwards),
      runwayMed: median(members.map((f) => f.committedRunway)),
      runwayAvg: avg(members.map((f) => f.committedRunway)),
      runwayTotal: members.reduce((n, f) => n + f.committedRunway, 0),
      vehicleSeats: members.reduce((n, f) => n + f.vehicleCt, 0),
      vehicleHolders: vehicleHolders.length,
      vehicleCeiling: members.reduce((n, f) => n + f.vehicleCeiling, 0),
      headroomTotal: members.reduce((n, f) => n + f.ceilingHeadroom, 0),
    };
  }, [selected, min, max]);

  const inputStyle = {
    border: "1px solid #bbb",
    padding: "6px 10px",
    fontSize: 15,
    width: 110,
    ...mono,
  } as const;

  const committedRows: [string, string][] = result
    ? [
        ["Firms", result.firms.toLocaleString()],
        ["FY23–25 won — med / avg", `${fmt$(result.wonMed)} / ${fmt$(result.wonAvg)}`],
        ["FY23–25 won — segment total", fmt$(result.wonTotal)],
        ["Committed book — med / avg", `${fmt$(result.cBookMed)} / ${fmt$(result.cBookAvg)}`],
        ["Committed book — segment total", fmt$(result.cBookTotal)],
        ["Committed awards held — med", `${result.cAwardsMed}`],
        [
          `Committed award $ — med / avg (${result.cAwardCt.toLocaleString()} awards)`,
          `${fmt$(result.cAwardMed)} / ${fmt$(result.cAwardAvg)}`,
        ],
        ["Committed runway — med / avg", `${fmt$(result.runwayMed)} / ${fmt$(result.runwayAvg)}`],
        ["Committed runway — segment total", fmt$(result.runwayTotal)],
      ]
    : [];

  const vehicleRows: [string, string][] = result
    ? [
        [
          "Vehicle seats held by members",
          `${result.vehicleSeats.toLocaleString()} seats · ${result.vehicleHolders.toLocaleString()} firms`,
        ],
        ["Vehicle ceiling — total", fmt$(result.vehicleCeiling)],
        ["Ceiling headroom — total (unfilled)", fmt$(result.headroomTotal)],
      ]
    : [];

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Bucket explorer</h1>
      <p style={{ color: "#555", margin: "6px 0 20px", maxWidth: 880 }}>
        Pick buckets (multiple = combined scope), set the FY23–25 won band, read the segment
        table. Member = won within scope in [min, max) and {data.precondition}. {data.window} ·{" "}
        {data.artifact.replace("query-sidecar/", "")}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {BUCKETS.map((b) => {
          const on = selected.has(b);
          return (
            <button
              key={b}
              type="button"
              onClick={() => toggle(b)}
              style={{
                padding: "8px 14px",
                border: `1px solid ${on ? "#1a1a1a" : "#bbb"}`,
                background: on ? "#1a1a1a" : "#fff",
                color: on ? "#fff" : "#555",
                fontSize: 14,
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {b}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
        <label style={{ fontSize: 14, color: "#555" }}>
          Won min{" "}
          <input value={minStr} onChange={(e) => setMinStr(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 14, color: "#555" }}>
          Won max{" "}
          <input value={maxStr} onChange={(e) => setMaxStr(e.target.value)} style={inputStyle} />
        </label>
        <span style={{ fontSize: 13, color: "#999" }}>
          accepts $1m / 500k / 1.5b · blank min = 0 · blank max = no cap · max exclusive
          {minStr.trim() && min === null ? " · min unparseable" : ""}
          {maxStr.trim() && max === null ? " · max unparseable" : ""}
        </span>
      </div>

      {selected.size === 0 || !result ? (
        <p style={{ color: "#999" }}>Select at least one bucket.</p>
      ) : (
        <>
          <table style={{ borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "2px solid #1a1a1a",
                    padding: "8px 12px",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#555",
                  }}
                >
                  Committed work · {[...selected].map((b) => b.split(" ")[0]).join(" + ")} ·{" "}
                  {min !== null ? fmt$(min) : "$0"}–{max !== null ? fmt$(max) : "∞"}
                </th>
                <th
                  style={{
                    borderBottom: "2px solid #1a1a1a",
                    padding: "8px 12px",
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {committedRows.map(([label, value]) => (
                <tr key={label} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 12px", color: "#333" }}>{label}</td>
                  <td
                    style={{ ...mono, padding: "10px 12px", textAlign: "right", fontWeight: 700 }}
                  >
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13, color: "#666", maxWidth: 720, margin: "10px 0 24px" }}>
            Committed work = standalone awards + task orders, at contract value
            (current_total_value_of_award). Committed runway = value − obligated, floored at 0 per
            award: work under contract, not yet billed.
          </p>

          <table style={{ borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    borderBottom: "2px solid #1a1a1a",
                    padding: "8px 12px",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "#555",
                  }}
                >
                  Vehicle capacity · separate, not blended
                </th>
                <th style={{ borderBottom: "2px solid #1a1a1a", padding: "8px 12px" }} />
              </tr>
            </thead>
            <tbody>
              {vehicleRows.map(([label, value]) => (
                <tr key={label} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "10px 12px", color: "#333" }}>{label}</td>
                  <td
                    style={{ ...mono, padding: "10px 12px", textAlign: "right", fontWeight: 700 }}
                  >
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13, color: "#666", maxWidth: 720, marginTop: 10 }}>
            A vehicle seat = a position on an IDIQ/BPA-type contract vehicle — the right to
            receive orders, not committed work. Ceiling = the maximum the government may order
            against the seat (potential_ceiling); many seats report no ceiling and count at $0,
            and negative reported values (reporting artifacts) are floored at $0 per award.
            Ceiling headroom = ceiling − obligated: capacity the government may still order,
            not funded or committed. Vehicle numbers are never blended into the award-size or
            book statistics above.
          </p>
        </>
      )}
    </div>
  );
}
