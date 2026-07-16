/**
 * BucketExplorer — interactive segment table over the work-anchored buckets.
 *
 * Select one or more buckets (selection = union of their pairs; per-firm
 * won/book/remaining sum across selected buckets since the pair sets are
 * disjoint), set the FY23–25 won min/max, and read the segment table live.
 * Computation is client-side over baked per-firm rows (bucket-firms.json).
 * Membership: won within scope inside [min, max) AND ≥1 active award within
 * the selected scope.
 */
import { useMemo, useState } from "react";

import baked from "@/internal/bucket-firms.json";

const data = baked as unknown as {
  window: string;
  artifact: string;
  book_convention: string;
  precondition: string;
  columns: string[];
  rows: [string, string, number, number, number, number][]; // bucket, uei, won, active_ct, book, remaining
};

const BUCKETS = [
  "Facilities Support & Operations",
  "Security & Protective Services",
  "Building Services",
  "Misc",
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
    // union: sum per-firm metrics across the selected buckets (pair sets are disjoint)
    const byFirm = new Map<string, { won: number; activeCt: number; book: number; remaining: number }>();
    for (const [bucket, uei, won, activeCt, book, remaining] of data.rows) {
      if (!selected.has(bucket)) continue;
      const cur = byFirm.get(uei) ?? { won: 0, activeCt: 0, book: 0, remaining: 0 };
      cur.won += won;
      cur.activeCt += activeCt;
      cur.book += book;
      cur.remaining += remaining;
      byFirm.set(uei, cur);
    }
    const lo = min ?? 0;
    const hi = max ?? Number.POSITIVE_INFINITY;
    const members = [...byFirm.values()].filter(
      (f) => f.activeCt >= 1 && f.won >= lo && f.won < hi,
    );
    return {
      firms: members.length,
      wonMed: median(members.map((f) => f.won)),
      wonAvg: avg(members.map((f) => f.won)),
      wonTotal: members.reduce((n, f) => n + f.won, 0),
      bookMed: median(members.map((f) => f.book)),
      bookAvg: avg(members.map((f) => f.book)),
      bookTotal: members.reduce((n, f) => n + f.book, 0),
      awardsMed: median(members.map((f) => f.activeCt)),
      remMed: median(members.map((f) => f.remaining)),
      remAvg: avg(members.map((f) => f.remaining)),
      remTotal: members.reduce((n, f) => n + f.remaining, 0),
    };
  }, [selected, min, max]);

  const inputStyle = {
    border: "1px solid #bbb",
    padding: "6px 10px",
    fontSize: 15,
    width: 110,
    ...mono,
  } as const;

  const rows: [string, string][] = result
    ? [
        ["Firms", result.firms.toLocaleString()],
        ["FY23–25 won — med / avg", `${fmt$(result.wonMed)} / ${fmt$(result.wonAvg)}`],
        ["FY23–25 won — segment total", fmt$(result.wonTotal)],
        ["Active book — med / avg", `${fmt$(result.bookMed)} / ${fmt$(result.bookAvg)}`],
        ["Active book — segment total", fmt$(result.bookTotal)],
        ["Active awards held — med", `${result.awardsMed}`],
        ["Remaining — med / avg", `${fmt$(result.remMed)} / ${fmt$(result.remAvg)}`],
        ["Remaining — segment total", fmt$(result.remTotal)],
      ]
    : [];

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Bucket explorer</h1>
      <p style={{ color: "#555", margin: "6px 0 20px", maxWidth: 860 }}>
        Pick buckets (multiple = combined scope), set the FY23–25 won band, read the segment
        table. Member = won within scope in [min, max) and {data.precondition}. Book:{" "}
        {data.book_convention}. {data.window} ·{" "}
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

      {selected.size === 0 ? (
        <p style={{ color: "#999" }}>Select at least one bucket.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", minWidth: 520 }}>
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
                {[...selected].map((b) => b.split(" ")[0]).join(" + ")} ·{" "}
                {min !== null ? fmt$(min) : "$0"}–{max !== null ? fmt$(max) : "∞"}
              </th>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "2px solid #1a1a1a",
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "#555",
                }}
              />
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "10px 12px", color: "#333" }}>{label}</td>
                <td style={{ ...mono, padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
