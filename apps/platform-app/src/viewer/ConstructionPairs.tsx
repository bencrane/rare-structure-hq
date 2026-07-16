/**
 * ConstructionPairs — the Equipment-Heavy Construction pair review.
 *
 * All (NAICS6, PSC4) pairs observed FY23–25 under the canonical scope
 * (naics_psc_equipment_needs: in_scope, NAICS 23*, equipment buckets ∩
 * {earthmoving, cranes, heavy-haul, aerial}), ranked by $. Every pair is
 * pre-selected IN (the mart's curated verdict); the review is exclusion.
 * The sub-$10M tail (~0.2% of $) is collapsed by default. Overrides persist
 * in localStorage under `viewer.construction-pairs.v1`; "Copy decisions"
 * exports the final in/out lists.
 */
import { useEffect, useMemo, useState } from "react";

import baked from "@/internal/construction-pairs.json";

type PairRow = {
  naics_code: string;
  naics_title: string | null;
  psc_code: string;
  psc_name: string | null;
  psc_description: string | null;
  what_was_done: string | null;
  buckets: string[];
  equipment: string;
  obl_m: number;
  firms: number;
};

const data = baked as unknown as {
  title: string;
  window: string;
  artifact: string;
  scope: string;
  pairs: PairRow[];
};

const STORAGE_KEY = "viewer.construction-pairs.v1";

type Overrides = Record<string, "out">; // "naics|psc" -> excluded (absent = in)

function loadOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

const pairKey = (p: PairRow): string => `${p.naics_code}|${p.psc_code}`;

const TAIL_FLOOR_M = 10;

const fmt$ = (m: number): string =>
  Math.abs(m) >= 1000
    ? `$${(m / 1000).toFixed(2)}B`
    : Math.abs(m) >= 1
      ? `$${m.toFixed(1)}M`
      : `$${Math.round(m * 1000).toLocaleString()}K`;

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;
const cell = { padding: "9px 10px", verticalAlign: "top" as const };

export function ConstructionPairs() {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [showTail, setShowTail] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }, [overrides]);

  const isIn = (p: PairRow): boolean => overrides[pairKey(p)] === undefined;

  const toggle = (p: PairRow) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (next[pairKey(p)]) delete next[pairKey(p)];
      else next[pairKey(p)] = "out";
      return next;
    });
  };

  const totals = useMemo(() => {
    let inCt = 0;
    let inM = 0;
    let outCt = 0;
    let outM = 0;
    for (const p of data.pairs) {
      if (isIn(p)) {
        inCt += 1;
        inM += p.obl_m;
      } else {
        outCt += 1;
        outM += p.obl_m;
      }
    }
    return { inCt, inM, outCt, outM };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  const copyDecisions = () => {
    const decisions = {
      artifact: data.artifact,
      window: data.window,
      bucket: "Equipment-Heavy Construction",
      in: data.pairs.filter((p) => isIn(p)).map((p) => [p.naics_code, p.psc_code]),
      out: data.pairs.filter((p) => !isIn(p)).map((p) => [p.naics_code, p.psc_code]),
    };
    navigator.clipboard.writeText(JSON.stringify(decisions, null, 1)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const head = data.pairs.filter((p) => p.obl_m >= TAIL_FLOOR_M);
  const tail = data.pairs.filter((p) => p.obl_m < TAIL_FLOOR_M);
  const tailM = tail.reduce((n, p) => n + p.obl_m, 0);
  const visible = showTail ? data.pairs : head;
  const excludedCt = Object.keys(overrides).length;

  const renderRow = (p: PairRow, idx: number) => {
    const included = isIn(p);
    return (
      <tr
        key={pairKey(p)}
        style={{ borderBottom: "1px solid #ddd", background: included ? "#fff" : "#faf5f5" }}
      >
        <td style={{ ...mono, ...cell, color: "#999", fontSize: 13 }}>{idx + 1}</td>
        <td style={{ ...cell, whiteSpace: "nowrap" }}>
          <button
            type="button"
            onClick={() => toggle(p)}
            style={{
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.03em",
              cursor: "pointer",
              border: `1px solid ${included ? "#0a7d32" : "#b03030"}`,
              background: included ? "#0a7d32" : "#b03030",
              color: "#fff",
            }}
          >
            {included ? "IN" : "OUT"}
          </button>
        </td>
        <td style={{ ...cell, maxWidth: 210 }}>
          <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{p.naics_code}</span>
          <div style={{ fontSize: 13, color: "#444" }}>{p.naics_title ?? "—"}</div>
        </td>
        <td style={{ ...cell, maxWidth: 200 }}>
          <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{p.psc_code}</span>
          <div style={{ fontSize: 13, color: "#444" }}>{p.psc_name ?? "—"}</div>
        </td>
        <td style={{ ...cell, fontSize: 13, color: "#333", maxWidth: 250 }}>
          {p.what_was_done ?? p.psc_description ?? <span style={{ color: "#bbb" }}>—</span>}
        </td>
        <td style={{ ...cell, fontSize: 12, color: "#555", maxWidth: 170 }}>
          {p.buckets.join(" · ")}
        </td>
        <td style={{ ...cell, fontSize: 12, color: "#777", maxWidth: 280 }} title={p.equipment}>
          {p.equipment || <span style={{ color: "#bbb" }}>—</span>}
        </td>
        <td style={{ ...mono, ...cell, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
          {fmt$(p.obl_m)}
        </td>
        <td style={{ ...mono, ...cell, textAlign: "right", fontSize: 13 }}>
          {p.firms.toLocaleString()}
        </td>
      </tr>
    );
  };

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
        Equipment-Heavy Construction — pair review
      </h1>
      <p style={{ color: "#555", margin: "6px 0 8px", maxWidth: 920 }}>
        {data.pairs.length} pairs observed · {data.window} ·{" "}
        {data.artifact.replace("query-sidecar/", "")}
        <br />
        Scope: {data.scope}. Every pair starts IN — the scope comes from the curated
        equipment-needs verdicts; this review is exclusion. Equipment lists are LLM-inferred from
        the work (disclosed).
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
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13 }}>
          <span style={{ color: "#0a7d32", fontWeight: 700 }}>IN</span>{" "}
          <span style={mono}>
            {totals.inCt} pairs · {fmt$(totals.inM)}
          </span>
        </span>
        <span style={{ fontSize: 13 }}>
          <span style={{ color: "#b03030", fontWeight: 700 }}>OUT</span>{" "}
          <span style={mono}>
            {totals.outCt} pairs · {fmt$(totals.outM)}
          </span>
        </span>
        <button
          type="button"
          onClick={copyDecisions}
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
          {copied ? "Copied ✓" : "Copy decisions"}
        </button>
        {excludedCt > 0 ? (
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
            Reset (all IN)
          </button>
        ) : null}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["#", "In/Out", "NAICS", "PSC", "The work", "Equipment bucket", "Equipment it implies", "FY23–25 $", "Firms"].map(
              (h) => (
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
              ),
            )}
          </tr>
        </thead>
        <tbody>{visible.map(renderRow)}</tbody>
      </table>

      {!showTail ? (
        <button
          type="button"
          onClick={() => setShowTail(true)}
          style={{
            marginTop: 14,
            padding: "8px 16px",
            border: "1px solid #bbb",
            background: "#fff",
            color: "#333",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Show {tail.length} smaller pairs (each under ${TAIL_FLOOR_M}M · together {fmt$(tailM)})
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowTail(false)}
          style={{
            marginTop: 14,
            padding: "8px 16px",
            border: "1px solid #bbb",
            background: "#fff",
            color: "#333",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Collapse the sub-${TAIL_FLOOR_M}M tail
        </button>
      )}
    </div>
  );
}
