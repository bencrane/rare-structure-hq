/**
 * TextilesPairs — pair dispositions for the two waste/environmental buckets.
 *
 * Candidate universe: every (award-NAICS6, award-PSC4) pair observed FY23–25
 * where the award PSC is in the base sets (S205/S222 → Waste Management &
 * Sanitation; F1xx/F999 → Environmental Remediation & Services, any
 * award-NAICS), plus the 562-award-NAICS × other-PSC leg (≥$10M pairs judged
 * individually, tail by rule). Each row shows its disposition and reason;
 * chips reassign (localStorage `viewer.textiles-pairs.v1`); "Copy decisions"
 * exports the final lists. Sub-$10M tail collapsed by default.
 */
import { useEffect, useMemo, useState } from "react";

import baked from "@/internal/textiles-pairs.json";

type PairRow = {
  naics_code: string | null;
  naics_title: string | null;
  psc_code: string | null;
  psc_name: string | null;
  what_was_done: string | null;
  obl_m: number;
  firms: number;
  bucket: string;
  reason: string;
};

const data = baked as unknown as {
  title: string;
  window: string;
  artifact: string;
  scope: string;
  categories: string[];
  pairs: PairRow[];
};

const STORAGE_KEY = "viewer.textiles-pairs.v1";

type Overrides = Record<string, string>; // "naics|psc" -> bucket

function loadOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

const pairKey = (p: PairRow): string => `${p.naics_code ?? "?"}|${p.psc_code ?? "?"}`;

const SHORT: Record<string, string> = {
  "Clothing & Textiles": "C&T",
  Out: "Out",
};

const CAT_COLOR: Record<string, string> = {
  "Clothing & Textiles": "#7a3aa0",
  Out: "#888888",
};

const TAIL_FLOOR_M = 10;

const fmt$ = (m: number): string =>
  Math.abs(m) >= 1000
    ? `$${(m / 1000).toFixed(2)}B`
    : Math.abs(m) >= 1
      ? `$${m.toFixed(1)}M`
      : `$${Math.round(m * 1000).toLocaleString()}K`;

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;
const cell = { padding: "9px 10px", verticalAlign: "top" as const };

export function TextilesPairs() {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [showTail, setShowTail] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }, [overrides]);

  const bucketOf = (p: PairRow): string => overrides[pairKey(p)] ?? p.bucket;

  const setBucket = (p: PairRow, b: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (b === p.bucket) delete next[pairKey(p)];
      else next[pairKey(p)] = b;
      return next;
    });
  };

  const totals = useMemo(() => {
    const t: Record<string, { pairs: number; oblM: number }> = {};
    for (const cat of data.categories) t[cat] = { pairs: 0, oblM: 0 };
    for (const p of data.pairs) {
      const b = bucketOf(p);
      t[b] ??= { pairs: 0, oblM: 0 };
      t[b].pairs += 1;
      t[b].oblM += p.obl_m;
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  const copyDecisions = () => {
    const decisions = Object.fromEntries(
      data.categories.map((cat) => [
        cat,
        data.pairs
          .filter((p) => bucketOf(p) === cat && p.naics_code && p.psc_code)
          .map((p) => [p.naics_code, p.psc_code]),
      ]),
    );
    navigator.clipboard
      .writeText(JSON.stringify({ artifact: data.artifact, window: data.window, decisions }, null, 1))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const head = data.pairs.filter((p) => p.obl_m >= TAIL_FLOOR_M);
  const tail = data.pairs.filter((p) => p.obl_m < TAIL_FLOOR_M);
  const tailM = tail.reduce((n, p) => n + p.obl_m, 0);
  const visible = showTail ? data.pairs : head;
  const overrideCt = Object.keys(overrides).length;

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
        Clothing & Textiles — pair dispositions
      </h1>
      <p style={{ color: "#555", margin: "6px 0 8px", maxWidth: 940 }}>
        {data.pairs.length} pairs observed · {data.window} ·{" "}
        {data.artifact.replace("query-sidecar/", "")}
        <br />
        {data.scope}
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
            <span style={{ color: CAT_COLOR[cat] ?? "#333", fontWeight: 700 }}>
              ● {SHORT[cat] ?? cat}
            </span>{" "}
            <span style={mono}>
              {(totals[cat]?.pairs ?? 0).toLocaleString()} pairs · {fmt$(totals[cat]?.oblM ?? 0)}
            </span>
          </span>
        ))}
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
        {overrideCt > 0 ? (
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
            Reset ({overrideCt} overridden)
          </button>
        ) : null}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["#", "NAICS", "PSC", "The work", "Why", "FY23–25 $", "Firms", "Bucket"].map((h) => (
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
          {visible.map((p, i) => {
            const cur = bucketOf(p);
            const overridden = overrides[pairKey(p)] !== undefined;
            return (
              <tr
                key={pairKey(p)}
                style={{
                  borderBottom: "1px solid #ddd",
                  background: cur === "Out" ? "#f7f7f7" : "#fff",
                }}
              >
                <td style={{ ...mono, ...cell, color: "#999", fontSize: 13 }}>{i + 1}</td>
                <td style={{ ...cell, maxWidth: 210 }}>
                  <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>
                    {p.naics_code ?? "—"}
                  </span>
                  <div style={{ fontSize: 13, color: "#444" }}>{p.naics_title ?? "—"}</div>
                </td>
                <td style={{ ...cell, maxWidth: 200 }}>
                  <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{p.psc_code ?? "—"}</span>
                  <div style={{ fontSize: 13, color: "#444" }}>{p.psc_name ?? "—"}</div>
                </td>
                <td style={{ ...cell, fontSize: 13, color: "#333", maxWidth: 250 }}>
                  {p.what_was_done ?? <span style={{ color: "#bbb" }}>no summary yet</span>}
                </td>
                <td style={{ ...cell, fontSize: 12, color: "#777", maxWidth: 260 }}>{p.reason}</td>
                <td
                  style={{
                    ...mono,
                    ...cell,
                    textAlign: "right",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmt$(p.obl_m)}
                </td>
                <td style={{ ...mono, ...cell, textAlign: "right", fontSize: 13 }}>
                  {p.firms.toLocaleString()}
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  {data.categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setBucket(p, cat)}
                      title={cat === p.bucket ? `${cat} (proposed)` : cat}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "2px 8px",
                        marginBottom: 2,
                        fontSize: 12,
                        fontWeight: cur === cat ? 700 : 400,
                        cursor: "pointer",
                        border: `1px solid ${cur === cat ? (CAT_COLOR[cat] ?? "#333") : "#ddd"}`,
                        background: cur === cat ? (CAT_COLOR[cat] ?? "#333") : "#fff",
                        color: cur === cat ? "#fff" : "#999",
                      }}
                    >
                      {SHORT[cat] ?? cat}
                    </button>
                  ))}
                  {overridden ? (
                    <div style={{ fontSize: 11, color: "#a05a00" }}>
                      overridden (proposed {SHORT[p.bucket] ?? p.bucket})
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => setShowTail((s) => !s)}
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
        {showTail
          ? `Collapse the sub-$${TAIL_FLOOR_M}M tail`
          : `Show ${tail.length.toLocaleString()} smaller pairs (each under $${TAIL_FLOOR_M}M · together ${fmt$(tailM)})`}
      </button>
    </div>
  );
}
