/**
 * PairAssignment — every observed (NAICS6, PSC4) pair placed in ONE of four
 * categories: Facilities Support & Operations / Security & Protective
 * Services / Building Services / Misc. Nothing is dropped — every pair has a
 * home. Pre-selected by the work-anchored rule (category follows the PSC;
 * generic PSCs fall back to the NAICS trade); the operator overrides per row.
 * Overrides persist in localStorage under `viewer.pair-assignment.v1`;
 * "Copy assignments" exports the final category → pair lists.
 */
import { useEffect, useMemo, useState } from "react";

import baked from "@/internal/pair-assignment.json";

type PairRow = {
  naics_code: string;
  naics_title: string | null;
  psc_code: string;
  psc_name: string | null;
  psc_description: string | null;
  what_was_done: string | null;
  obl_m: number;
  firms: number;
  category: string;
  basis: string;
};

const data = baked as unknown as {
  title: string;
  window: string;
  artifact: string;
  rule: string;
  categories: string[];
  pairs: PairRow[];
};

const STORAGE_KEY = "viewer.pair-assignment.v1";

type Overrides = Record<string, string>; // "naics|psc" -> category

function loadOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

const pairKey = (p: PairRow): string => `${p.naics_code}|${p.psc_code}`;

const SHORT: Record<string, string> = {
  "Facilities Support & Operations": "Facilities",
  "Security & Protective Services": "Security",
  "Building Services": "Building",
  Misc: "Misc",
};

const CAT_COLOR: Record<string, string> = {
  "Facilities Support & Operations": "#1a56a0",
  "Security & Protective Services": "#7a3aa0",
  "Building Services": "#0a7d32",
  Misc: "#888888",
};

const fmtM = (m: number): string =>
  Math.abs(m) >= 1000
    ? `$${(m / 1000).toFixed(2)}B`
    : Math.abs(m) >= 1
      ? `$${m.toFixed(1)}M`
      : `$${Math.round(m * 1000).toLocaleString()}K`;

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;
const cell = { padding: "9px 10px", verticalAlign: "top" as const };

export function PairAssignment() {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }, [overrides]);

  const category = (p: PairRow): string => overrides[pairKey(p)] ?? p.category;

  const setCategory = (p: PairRow, cat: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (cat === p.category) delete next[pairKey(p)];
      else next[pairKey(p)] = cat;
      return next;
    });
  };

  const totals = useMemo(() => {
    const t: Record<string, { pairs: number; oblM: number; firms: number }> = {};
    for (const cat of data.categories) t[cat] = { pairs: 0, oblM: 0, firms: 0 };
    for (const p of data.pairs) {
      const c = category(p);
      t[c].pairs += 1;
      t[c].oblM += p.obl_m;
      t[c].firms += p.firms;
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  const copyAssignments = () => {
    const assignments = Object.fromEntries(
      data.categories.map((cat) => [
        cat,
        data.pairs
          .filter((p) => category(p) === cat)
          .map((p) => [p.naics_code, p.psc_code]),
      ]),
    );
    navigator.clipboard
      .writeText(
        JSON.stringify({ artifact: data.artifact, window: data.window, assignments }, null, 1),
      )
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const overrideCt = Object.keys(overrides).length;

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
        Pair assignment — one category per pair
      </h1>
      <p style={{ color: "#555", margin: "6px 0 8px", maxWidth: 900 }}>
        {data.pairs.length} pairs · {data.window} ·{" "}
        {data.artifact.replace("query-sidecar/", "")}
        <br />
        {data.rule} Nothing is dropped — every pair lands in exactly one category. Click a chip to
        reassign (persists locally).
      </p>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: "#fff",
          borderBottom: "1px solid #ddd",
          padding: "10px 0",
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {data.categories.map((cat) => (
          <span key={cat} style={{ fontSize: 13 }}>
            <span style={{ color: CAT_COLOR[cat], fontWeight: 700 }}>● {SHORT[cat]}</span>{" "}
            <span style={{ ...mono }}>
              {totals[cat].pairs} pairs · {fmtM(totals[cat].oblM)}
            </span>
          </span>
        ))}
        <button
          type="button"
          onClick={copyAssignments}
          style={{
            padding: "6px 14px",
            border: "1px solid #1a1a1a",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied ✓" : "Copy assignments"}
        </button>
        {overrideCt > 0 ? (
          <>
            <span style={{ fontSize: 13, color: "#a05a00" }}>
              {overrideCt} override{overrideCt === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => setOverrides({})}
              style={{
                padding: "6px 10px",
                border: "1px solid #bbb",
                background: "#fff",
                color: "#333",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Reset to proposal
            </button>
          </>
        ) : null}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {[
              "#",
              "NAICS",
              "PSC",
              "PSC description (official)",
              "Work summary",
              "FY23–25 $",
              "Firms",
              "Basis",
              "Category",
            ].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: ["FY23–25 $", "Firms"].includes(h) ? "right" : "left",
                  borderBottom: "2px solid #1a1a1a",
                  padding: "8px 10px",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#555",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.pairs.map((p, i) => {
            const cur = category(p);
            const overridden = overrides[pairKey(p)] !== undefined;
            return (
              <tr key={pairKey(p)} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ ...mono, ...cell, color: "#999", fontSize: 13 }}>{i + 1}</td>
                <td style={{ ...cell, maxWidth: 200 }}>
                  <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{p.naics_code}</span>
                  <div style={{ fontSize: 13, color: "#444" }}>{p.naics_title ?? "—"}</div>
                </td>
                <td style={{ ...cell, maxWidth: 180 }}>
                  <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{p.psc_code}</span>
                  <div style={{ fontSize: 13, color: "#444" }}>{p.psc_name ?? "—"}</div>
                </td>
                <td style={{ ...cell, fontSize: 13, color: "#333", maxWidth: 230 }}>
                  {p.psc_description ?? <span style={{ color: "#bbb" }}>—</span>}
                </td>
                <td style={{ ...cell, fontSize: 13, color: "#333", maxWidth: 230 }}>
                  {p.what_was_done ?? <span style={{ color: "#bbb" }}>no summary yet</span>}
                </td>
                <td
                  style={{
                    ...mono,
                    ...cell,
                    textAlign: "right",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtM(p.obl_m)}
                </td>
                <td style={{ ...mono, ...cell, textAlign: "right", fontSize: 13 }}>
                  {p.firms.toLocaleString()}
                </td>
                <td style={{ ...cell, fontSize: 12, color: "#777", maxWidth: 200 }}>{p.basis}</td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  {data.categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(p, cat)}
                      title={cat === p.category ? `${cat} (proposed)` : cat}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "2px 8px",
                        marginBottom: 2,
                        fontSize: 12,
                        fontWeight: cur === cat ? 700 : 400,
                        cursor: "pointer",
                        border: `1px solid ${cur === cat ? CAT_COLOR[cat] : "#ddd"}`,
                        background: cur === cat ? CAT_COLOR[cat] : "#fff",
                        color: cur === cat ? "#fff" : "#999",
                      }}
                    >
                      {SHORT[cat]}
                    </button>
                  ))}
                  {overridden ? (
                    <div style={{ fontSize: 11, color: "#a05a00" }}>
                      overridden (proposed {SHORT[p.category]})
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
