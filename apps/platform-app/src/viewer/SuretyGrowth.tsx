/**
 * SuretyGrowth — dial explorer for the construction growth cohorts (surety frame,
 * 2026-07-19 investigation; substrate: hq/data-cache/surety/construction_pairsets_v1.json).
 *
 * Pick market pair-set(s) (multi-select, like the Combo Lookup tab), a growth multiple
 * (2×/3×/4×/custom), and a last-12 min/max band. Rows are per-firm prime obligations
 * scoped to the selected pair-sets: last 12 months vs the prior 24 (months 13–36,
 * non-overlapping). Multi-select sums a firm's windows ACROSS the selected markets
 * before the growth test (same semantics as querying the pair-union). Baked fixture —
 * all dials client-side; growth requires prior24 > 0 (new entrants shown separately).
 */
import { useMemo, useState } from "react";

import baked from "@/internal/surety-growth.json";

const data = baked as unknown as {
  as_of: string;
  artifact: string;
  definition: string;
  markets: Record<string, string>;
  names: Record<string, string>;
  rows: [string, string, number, number][]; // [market, uei, last12_k, prior24_k]
};

const fmt$ = (k: number) => {
  const v = k * 1000;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
};

const BANDS: [string, number, number][] = [
  ["<$1M", 0, 1_000],
  ["$1–5M", 1_000, 5_000],
  ["$5–10M", 5_000, 10_000],
  ["$10–25M", 10_000, 25_000],
  ["$25–50M", 25_000, 50_000],
  ["$50–100M", 50_000, 100_000],
  ["$100–250M", 100_000, 250_000],
  ["$250M–$1B", 250_000, 1_000_000],
  ["$1B+", 1_000_000, Number.POSITIVE_INFINITY],
];

const selStyle: React.CSSProperties = {
  display: "block", marginTop: 4, padding: "6px 8px", fontSize: 13,
  border: "1px solid #ccc", borderRadius: 0, background: "#fff", minWidth: 220,
};

export function SuretyGrowth() {
  const slugs = Object.keys(data.markets);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(["construction-vertical-building"]),
  );
  const [mult, setMult] = useState(4);
  const [minM, setMinM] = useState(1); // $M
  const [maxM, setMaxM] = useState(1000); // $M
  const [showFirms, setShowFirms] = useState(50);

  const toggled = (s: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n.size === 0 ? p : n;
    });
  };

  const { firms, newEntrants, bandRows, totalLast12k } = useMemo(() => {
    // Aggregate per-firm across the selected markets (pair-union semantics).
    const agg = new Map<string, { last12: number; prior24: number }>();
    for (const [market, uei, last12, prior24] of data.rows) {
      if (!selected.has(market)) continue;
      const a = agg.get(uei) ?? { last12: 0, prior24: 0 };
      a.last12 += last12;
      a.prior24 += prior24;
      agg.set(uei, a);
    }
    const lo = minM * 1000;
    const hi = maxM * 1000;
    const grown: { uei: string; last12: number; prior24: number; ratio: number }[] = [];
    let newcomers = 0;
    for (const [uei, a] of agg) {
      if (a.last12 < lo || a.last12 > hi) continue;
      if (a.prior24 <= 0) {
        if (a.last12 > 0) newcomers += 1;
        continue;
      }
      const ratio = a.last12 / a.prior24;
      if (ratio >= mult) grown.push({ uei, last12: a.last12, prior24: a.prior24, ratio });
    }
    grown.sort((x, y) => y.last12 - x.last12);
    const bands = BANDS.map(([label, blo, bhi]) => {
      const inBand = grown.filter((g) => g.last12 >= blo && g.last12 < bhi);
      const sum = inBand.reduce((s, g) => s + g.last12, 0);
      const med = inBand.length
        ? inBand.map((g) => g.ratio).sort((a, b) => a - b)[Math.floor(inBand.length / 2)]
        : null;
      return { label, firms: inBand.length, sumK: sum, median: med };
    }).filter((b) => b.firms > 0);
    return {
      firms: grown,
      newEntrants: newcomers,
      bandRows: bands,
      totalLast12k: grown.reduce((s, g) => s + g.last12, 0),
    };
  }, [selected, mult, minM, maxM]);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1150 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Surety Growth — construction cohorts</h1>
      <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 18px" }}>
        baked {data.as_of} · {data.artifact.replace("query-sidecar/", "")} · prime obligations,
        last 12mo vs prior 24mo (months 13–36) · pair-sets: hq/data-cache/surety/construction_pairsets_v1
      </p>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Markets (pair-sets)</div>
          {slugs.map((s) => (
            <label key={s} style={{ display: "block", fontSize: 13, marginBottom: 4, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selected.has(s)}
                onChange={() => toggled(s)}
                style={{ marginRight: 8 }}
              />
              {data.markets[s]}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 12, color: "#666" }}>
            Growth multiple (last12 ≥ N × prior24)
            <select value={mult} onChange={(e) => setMult(Number(e.target.value))} style={selStyle}>
              {[1.5, 2, 3, 4, 6, 10].map((m) => (
                <option key={m} value={m}>{m}×</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: "#666" }}>
            Last-12 minimum ($M)
            <input
              type="number"
              value={minM}
              min={0}
              onChange={(e) => setMinM(Number(e.target.value) || 0)}
              style={selStyle}
            />
          </label>
          <label style={{ fontSize: 12, color: "#666" }}>
            Last-12 maximum ($M; 1000 = $1B)
            <input
              type="number"
              value={maxM}
              min={1}
              onChange={(e) => setMaxM(Number(e.target.value) || 1)}
              style={selStyle}
            />
          </label>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#555", margin: "8px 0 16px" }}>
        <strong>{firms.length.toLocaleString()}</strong> firms grew ≥{mult}× ·{" "}
        {fmt$(totalLast12k)} last-12 obligations in band · {newEntrants.toLocaleString()} pure new
        entrants in band (no prior-24 base; excluded from the growth test)
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5, marginBottom: 26 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#888", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <th style={{ padding: "6px 10px 6px 0" }}>Last-12 band</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Firms</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Last-12 $</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Median growth</th>
          </tr>
        </thead>
        <tbody>
          {bandRows.map((b) => (
            <tr key={b.label} style={{ borderTop: "1px solid #e8e8e8" }}>
              <td style={{ padding: "8px 10px 8px 0" }}>{b.label}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.firms.toLocaleString()}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt$(b.sumK)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.median ? `${b.median.toFixed(1)}×` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#888", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <th style={{ padding: "6px 10px 6px 0" }}>Firm</th>
            <th style={{ padding: "6px 10px" }}>UEI</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Last 12</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Prior 24</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Growth</th>
          </tr>
        </thead>
        <tbody>
          {firms.slice(0, showFirms).map((f) => (
            <tr key={f.uei} style={{ borderTop: "1px solid #e8e8e8" }}>
              <td style={{ padding: "8px 10px 8px 0", maxWidth: 340, lineHeight: 1.35 }}>
                {data.names[f.uei] ?? <span style={{ color: "#999" }}>—</span>}
              </td>
              <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{f.uei}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt$(f.last12)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt$(f.prior24)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.ratio >= 100 ? `${Math.round(f.ratio)}×` : `${f.ratio.toFixed(1)}×`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {firms.length > showFirms && (
        <button
          type="button"
          onClick={() => setShowFirms((n) => n + 100)}
          style={{ margin: "12px 0 0", padding: "6px 14px", fontSize: 12.5, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
        >
          Show more ({firms.length - showFirms} remaining)
        </button>
      )}
    </div>
  );
}
