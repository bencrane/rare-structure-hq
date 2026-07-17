/**
 * PaymentComboPairs — fixed vocabulary (operator naming, 2026-07-16):
 *   PRIME AWARD COMBO = one NAICS6 × PSC4 (a table row).
 *   PAYMENT COMBO     = one Type of Contract Pricing code × Contract Financing
 *                       code (the dropdown selection). Official FPDS codes and
 *                       titles, unedited.
 *
 * Pick a Payment Combo, see the Prime Award Combos carrying it, ranked by
 * active committed dollars, universe-wide (no collection or member gate).
 * Last column = the Payment Combo's share of that Prime Award Combo's total
 * active committed dollars. Cells under $2M dropped at bake time.
 */
import { useMemo, useState } from "react";

import baked from "@/internal/payment-combo-pairs.json";

const data = baked as unknown as {
  as_of: string;
  artifact: string;
  definition: string;
  naics_names: Record<string, string>;
  psc_names: Record<string, string>;
  cells: [string, string, string, string, number, number][];
  pair_totals: [string, string, number][];
  work_summaries: Record<string, string>;
  jtbd: Record<string, string>;
};

// Official FPDS titles, verbatim.
const PRICING: [string, string][] = [
  ["A", "Fixed Price Redetermination"],
  ["B", "Fixed Price Level of Effort"],
  ["J", "Firm Fixed Price"],
  ["K", "Fixed Price with Economic Price Adjustment"],
  ["L", "Fixed Price Incentive"],
  ["M", "Fixed Price Award Fee"],
  ["R", "Cost Plus Award Fee"],
  ["S", "Cost No Fee"],
  ["T", "Cost Sharing"],
  ["U", "Cost Plus Fixed Fee"],
  ["V", "Cost Plus Incentive Fee"],
  ["Y", "Time and Materials"],
  ["Z", "Labor Hours"],
  ["1", "Order Dependent (IDV allows pricing arrangement to be determined separately for each order)"],
  ["2", "Combination (Applies to Awards where two or more of the above apply)"],
  ["3", "Other (Applies to Awards where none of the above apply)"],
];
const FINANCING: [string, string][] = [
  ["A", "FAR 52.232-16 Progress Payments"],
  ["C", "Percentage of Completion Progress Payments"],
  ["D", "Unusual Progress Payments or Advance Payments"],
  ["E", "Commercial Financing"],
  ["F", "Performance-Based Financing"],
  ["Z", "Not Applicable"],
  ["NULL", "(field empty — nothing reported)"],
];

const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

const selStyle: React.CSSProperties = {
  fontSize: 14.5,
  padding: "8px 10px",
  maxWidth: 560,
  display: "block",
  width: "100%",
};

export function PaymentComboPairs() {
  const [pricing, setPricing] = useState("J");
  const [financing, setFinancing] = useState("any");
  const [sortKey, setSortKey] = useState<"value" | "share">("value");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const pairTotal = useMemo(() => {
    const m = new Map<string, number>();
    for (const [n, p, v] of data.pair_totals) m.set(`${n}|${p}`, v);
    return m;
  }, []);

  const rows = useMemo(() => {
    const m = new Map<string, { naics: string; psc: string; ct: number; value: number }>();
    for (const [n, p, pr, fin, ct, v] of data.cells) {
      if (pr !== pricing) continue;
      if (financing !== "any" && fin !== financing) continue;
      const k = `${n}|${p}`;
      const cur = m.get(k) ?? { naics: n, psc: p, ct: 0, value: 0 };
      cur.ct += ct;
      cur.value += v;
      m.set(k, cur);
    }
    const arr = [...m.values()];
    const shareOf = (r: { naics: string; psc: string; value: number }) => {
      const tot = pairTotal.get(`${r.naics}|${r.psc}`) ?? 0;
      return tot > 0 ? r.value / tot : 0;
    };
    const key = sortKey === "value" ? (r: (typeof arr)[number]) => r.value : shareOf;
    arr.sort((a, b) => (sortDir === "desc" ? key(b) - key(a) : key(a) - key(b)));
    return arr.slice(0, 200);
  }, [pricing, financing, sortKey, sortDir, pairTotal]);

  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1150 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Payment Combo → Prime Award Combos</h1>
      <p style={{ fontSize: 13, color: "#777", margin: "6px 0 4px", lineHeight: 1.5 }}>
        Payment Combo = pricing code × financing code (your selection below). Prime Award Combo =
        NAICS × PSC (each table row). All active committed prime awards, universe-wide — no
        collection or member gate; codes and titles are FPDS-official, unedited. "Committed on
        Payment Combo" = the row's active dollars on the selected Payment Combo. The last column =
        those dollars ÷ the Prime Award Combo's total active dollars across all Payment Combos;
        100% = every active dollar on that Prime Award Combo sits on the selected Payment Combo.
      </p>
      <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 18px" }}>
        baked {data.as_of} · {data.artifact.replace("query-sidecar/", "")} · cells under $2M dropped
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: "#666" }}>
          Type of Contract Pricing
          <select value={pricing} onChange={(e) => setPricing(e.target.value)} style={selStyle}>
            {PRICING.map(([c, t]) => (
              <option key={c} value={c}>{c} — {t}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: "#666" }}>
          Contract Financing
          <select value={financing} onChange={(e) => setFinancing(e.target.value)} style={selStyle}>
            <option value="any">Any</option>
            {FINANCING.map(([c, t]) => (
              <option key={c} value={c}>{c === "NULL" ? "—" : c} — {t}</option>
            ))}
          </select>
        </label>
      </div>

      <p style={{ fontSize: 13, color: "#555", margin: "8px 0 16px" }}>
        {rows.length} Prime Award Combos{rows.length === 200 ? " (top 200 shown)" : ""} · {fmt$(total)} committed on this Payment Combo
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#888", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <th style={{ padding: "6px 10px 6px 0" }}>NAICS</th>
            <th style={{ padding: "6px 10px" }}>PSC</th>
            <th style={{ padding: "6px 10px" }}>Work summary</th>
            <th style={{ padding: "6px 10px" }}>Job to be done (gpt-5.4)</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Awards</th>
            <th
              onClick={() => { sortKey === "value" ? setSortDir(sortDir === "desc" ? "asc" : "desc") : (setSortKey("value"), setSortDir("desc")); }}
              style={{ padding: "6px 10px", textAlign: "right", cursor: "pointer", textDecoration: "underline dotted" }}
            >
              Committed on Payment Combo{sortKey === "value" ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
            </th>
            <th
              onClick={() => { sortKey === "share" ? setSortDir(sortDir === "desc" ? "asc" : "desc") : (setSortKey("share"), setSortDir("desc")); }}
              style={{ padding: "6px 10px", textAlign: "right", cursor: "pointer", textDecoration: "underline dotted" }}
            >
              Payment Combo share of Prime Award Combo{sortKey === "share" ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tot = pairTotal.get(`${r.naics}|${r.psc}`) ?? 0;
            return (
              <tr key={`${r.naics}|${r.psc}`} style={{ borderTop: "1px solid #e8e8e8" }}>
                <td style={{ padding: "9px 10px 9px 0", lineHeight: 1.35 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>{r.naics}</span>
                  <div style={{ fontSize: 12, color: "#777" }}>{data.naics_names[r.naics] || ""}</div>
                </td>
                <td style={{ padding: "9px 10px", lineHeight: 1.35 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>{r.psc}</span>
                  <div style={{ fontSize: 12, color: "#777" }}>{data.psc_names[r.psc] || ""}</div>
                </td>
                <td style={{ padding: "9px 10px", fontSize: 12.5, color: "#444", lineHeight: 1.45, maxWidth: 300 }}>
                  {data.work_summaries[`${r.naics}|${r.psc}`] || ""}
                </td>
                <td style={{ padding: "9px 10px", fontSize: 12.5, color: "#444", lineHeight: 1.45, maxWidth: 260 }}>
                  {data.jtbd[`${r.naics}|${r.psc}`] || ""}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {r.ct.toLocaleString()}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {fmt$(r.value)}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {tot > 0 ? `${((100 * r.value) / tot).toFixed(0)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
