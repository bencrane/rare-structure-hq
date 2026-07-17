/**
 * PaymentRegimes — pair-level "how this work gets paid" drill-down.
 *
 * Per collection, every (NAICS6 × PSC4) pair mapped to its pricing-code ×
 * financing-group reality over ACTIVE COMMITTED prime awards (topology <>
 * vehicle) — pair-level, NO member gate (this is the curation drill-down, not
 * the counted-member view; numbers here will not equal the Market card's).
 *
 * The two regime variables, and only these two, exist in the substrate:
 *   pricing  = how the firm earns (fixed {A,B,J,K,L,M} / cost {R,S,T,U,V} /
 *              T&M-LH {Y,Z} / other incl. order-dependent + NULL)
 *   financing = whether the government fronts cash pre-delivery
 *              (financed = any recorded mechanism · not_applicable = Z/'NOT
 *              APPLICABLE' · none_reported = NULL — absence of record).
 * Data baked from the sidecar (artifact in the header line).
 */
import { useMemo, useState } from "react";

import baked from "@/internal/pair-payment-regimes.json";

const data = baked as unknown as {
  as_of: string;
  artifact: string;
  definition: string;
  collections: Record<string, string>;
  naics_names: Record<string, string>;
  psc_names: Record<string, string>;
  columns: string[];
  rows: [string, string, string, string, string, number, number][];
};

const FIXED = new Set(["A", "B", "J", "K", "L", "M"]);
const COST = new Set(["R", "S", "T", "U", "V"]);
const TM = new Set(["Y", "Z"]);
const cls = (p: string): "fixed" | "cost" | "tm" | "other" =>
  FIXED.has(p) ? "fixed" : COST.has(p) ? "cost" : TM.has(p) ? "tm" : "other";

const PRICING_NAMES: Record<string, string> = {
  A: "FP Redetermination", B: "FP Level of Effort", J: "Firm Fixed Price",
  K: "FP + Econ. Price Adj.", L: "FP Incentive", M: "FP Award Fee",
  R: "Cost + Award Fee", S: "Cost No Fee", T: "Cost Sharing",
  U: "Cost + Fixed Fee", V: "Cost + Incentive Fee",
  Y: "Time & Materials", Z: "Labor Hours",
  "1": "Order Dependent", "2": "Combination", "3": "Other", NULL: "Unreported",
};
const FIN_NAMES: Record<string, string> = {
  financed: "gov financing recorded",
  not_applicable: "no financing (explicit)",
  none_reported: "no financing reported",
};
const CLASS_COLOR: Record<string, string> = {
  fixed: "#1a1a1a", cost: "#7a7a7a", tm: "#b5b5b5", other: "#e3e3e3",
};

const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

type PairAgg = {
  naics: string;
  psc: string;
  ct: number;
  value: number;
  byClass: Record<"fixed" | "cost" | "tm" | "other", number>;
  jUnfin: number; // J with financing != financed
  financed: number; // any pricing, financing mechanism recorded
  cells: { pricing: string; financing: string; ct: number; value: number }[];
};

export function PaymentRegimes() {
  const slugs = useMemo(
    () => Object.keys(data.collections).sort((a, b) => data.collections[a].localeCompare(data.collections[b])),
    [],
  );
  const [slug, setSlug] = useState(slugs[0]);
  const [open, setOpen] = useState<string | null>(null);

  const pairs = useMemo(() => {
    const m = new Map<string, PairAgg>();
    for (const [c, naics, psc, pricing, financing, ct, value] of data.rows) {
      if (c !== slug) continue;
      const k = `${naics}×${psc}`;
      let agg = m.get(k);
      if (!agg) {
        agg = { naics, psc, ct: 0, value: 0, byClass: { fixed: 0, cost: 0, tm: 0, other: 0 }, jUnfin: 0, financed: 0, cells: [] };
        m.set(k, agg);
      }
      agg.ct += ct;
      agg.value += value;
      agg.byClass[cls(pricing)] += value;
      if (pricing === "J" && financing !== "financed") agg.jUnfin += value;
      if (financing === "financed") agg.financed += value;
      agg.cells.push({ pricing, financing, ct, value });
    }
    for (const agg of m.values()) agg.cells.sort((a, b) => b.value - a.value);
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [slug]);

  const total = pairs.reduce((s, p) => s + p.value, 0);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Payment regimes by pair</h1>
      <p style={{ fontSize: 13, color: "#777", margin: "6px 0 4px", lineHeight: 1.5 }}>
        Active committed prime awards on each pair (vehicles excluded) — pair-level, no member
        gate; these totals will not equal the Market card's member-gated numbers. Pricing = how
        the firm earns. The last two columns answer one question — who fronts the working
        capital? — from both ends: "Gov fronts cash" = share of committed value with a recorded
        government financing arrangement (progress/milestone payments, any pricing type).
        "Firm fronts cash (fixed price)" = share on firm-fixed-price contracts with NO
        arrangement recorded — the firm self-funds the work and is paid at delivery. Absence of
        a record is read as unfinanced.
      </p>
      <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 18px" }}>
        baked {data.as_of} · {data.artifact.replace("query-sidecar/", "")}
      </p>

      <select
        value={slug}
        onChange={(e) => { setSlug(e.target.value); setOpen(null); }}
        style={{ fontSize: 15, padding: "8px 10px", marginBottom: 6, maxWidth: 520 }}
      >
        {slugs.map((s) => (
          <option key={s} value={s}>{data.collections[s]}</option>
        ))}
      </select>
      <p style={{ fontSize: 13, color: "#555", margin: "4px 0 16px" }}>
        {pairs.length} pairs with active committed work · {fmt$(total)} committed
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#888", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <th style={{ padding: "6px 10px 6px 0" }}>Pair</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Awards</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Committed</th>
            <th style={{ padding: "6px 10px", minWidth: 180 }}>Mix (fixed · cost · T&M · other)</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Gov fronts cash</th>
            <th style={{ padding: "6px 10px", textAlign: "right" }}>Firm fronts cash (fixed price)</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => {
            const k = `${p.naics}×${p.psc}`;
            const isOpen = open === k;
            return [
              <tr
                key={k}
                onClick={() => setOpen(isOpen ? null : k)}
                style={{ borderTop: "1px solid #e8e8e8", cursor: "pointer", background: isOpen ? "#f7f7f7" : undefined }}
              >
                <td style={{ padding: "9px 10px 9px 0", lineHeight: 1.35 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
                    {p.naics} × {p.psc}
                  </span>
                  <div style={{ fontSize: 12, color: "#777" }}>
                    {(data.naics_names[p.naics] || "").toLowerCase()} · {(data.psc_names[p.psc] || "").toLowerCase()}
                  </div>
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {p.ct.toLocaleString()}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {fmt$(p.value)}
                </td>
                <td style={{ padding: "9px 10px" }}>
                  <div style={{ display: "flex", height: 10, width: "100%", background: "#f1f1f1" }}>
                    {(["fixed", "cost", "tm", "other"] as const).map((c) =>
                      p.byClass[c] > 0 ? (
                        <div
                          key={c}
                          title={`${c}: ${fmt$(p.byClass[c])} (${((100 * p.byClass[c]) / p.value).toFixed(1)}%)`}
                          style={{ background: CLASS_COLOR[c], flexGrow: p.byClass[c] / p.value, flexBasis: 0, minWidth: 2 }}
                        />
                      ) : null,
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                    {(["fixed", "cost", "tm", "other"] as const)
                      .filter((c) => p.byClass[c] > 0)
                      .map((c) => `${c} ${((100 * p.byClass[c]) / p.value).toFixed(0)}%`)
                      .join(" · ")}
                  </div>
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {p.value > 0 ? `${((100 * p.financed) / p.value).toFixed(0)}%` : "—"}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {p.value > 0 ? `${((100 * p.jUnfin) / p.value).toFixed(0)}%` : "—"}
                </td>
              </tr>,
              isOpen ? (
                <tr key={`${k}-detail`} style={{ background: "#fbfbfb" }}>
                  <td colSpan={6} style={{ padding: "4px 10px 14px 18px" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 12.5 }}>
                      <tbody>
                        {p.cells.map((c) => (
                          <tr key={`${c.pricing}·${c.financing}`}>
                            <td style={{ padding: "3px 14px 3px 0", fontFamily: "ui-monospace, monospace" }}>{c.pricing}</td>
                            <td style={{ padding: "3px 14px 3px 0", color: "#444" }}>
                              {PRICING_NAMES[c.pricing] ?? c.pricing}
                            </td>
                            <td style={{ padding: "3px 14px 3px 0", color: "#777" }}>{FIN_NAMES[c.financing]}</td>
                            <td style={{ padding: "3px 14px 3px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {c.ct.toLocaleString()} awards
                            </td>
                            <td style={{ padding: "3px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                              {fmt$(c.value)}
                            </td>
                            <td style={{ padding: "3px 0 3px 14px", textAlign: "right", color: "#888", fontVariantNumeric: "tabular-nums" }}>
                              {p.value > 0 ? `${((100 * c.value) / p.value).toFixed(1)}%` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
