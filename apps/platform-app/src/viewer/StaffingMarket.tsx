/**
 * StaffingMarket — the v2+v3 market sizing over the SAM-matched staffing
 * agencies (178-firm prototype batch), baked from the sizing CSVs.
 *
 * Two sizings per firm, deliberately side by side:
 * - SOC-derived labor $ (v2): rank≤3 category qualification, ≥2-SOC overlap,
 *   geo-gated, × loaded_labor_share (SUSB/ECEC). What their ADVERTISED ROLES
 *   reach.
 * - Collection-view labor $ (v3): the same measure over their declared
 *   verticals' staffing-native collection pairs. What their DECLARED
 *   INDUSTRIES' curated markets hold.
 * in_vertical_share = % of SOC-derived $ inside those collection pairs;
 * REVIEW = <20% share on >$100M market while claiming verticals (the
 * roles-vs-verticals disagreement queue).
 */
import { useMemo, useState } from "react";

import baked from "@/internal/staffing-market.json";

import { StaffingFirmDetail } from "@/viewer/StaffingFirmDetail";

const data = baked as unknown as {
  window: string;
  artifact: string;
  columns: string[];
  rows: [
    string,
    string,
    string,
    string,
    string,
    string,
    number,
    number,
    number,
    number,
    number,
    string,
    string,
    number | null,
    number,
    string,
    string,
    number | null,
    number | null,
    number | null,
  ][];
};

type Row = {
  uei: string;
  name: string;
  band: string;
  hqState: string;
  domain: string;
  grain: string;
  nCombos: number;
  nStates: number;
  nCells: number;
  labor: number;
  award: number;
  industries: string[];
  collections: string[];
  share: number | null;
  collectionView: number;
  review: boolean;
  topCells: string;
  nEntities: number | null;
  nSubEntities: number | null;
  nSubWithPrime: number | null;
};

const ROWS: Row[] = data.rows.map(
  ([
    uei,
    name,
    band,
    hqState,
    domain,
    grain,
    nCombos,
    nStates,
    nCells,
    labor,
    award,
    industries,
    collections,
    share,
    collectionView,
    flag,
    topCells,
    nEntities,
    nSubEntities,
    nSubWithPrime,
  ]) => ({
    uei,
    name,
    band: band || "unknown",
    hqState,
    domain,
    grain,
    nCombos,
    nStates,
    nCells,
    labor,
    award,
    industries: industries ? industries.split(";") : [],
    collections: collections ? collections.split(";") : [],
    share,
    collectionView,
    review: flag === "REVIEW",
    topCells,
    nEntities,
    nSubEntities,
    nSubWithPrime,
  }),
);

const INDUSTRIES = [...new Set(ROWS.flatMap((r) => r.industries))].sort();

const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v / 1e3)}K`;
};

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;

type SortKey =
  | "labor"
  | "award"
  | "collectionView"
  | "share"
  | "nCombos"
  | "nEntities"
  | "nSubEntities";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "labor", label: "SOC labor $" },
  { key: "award", label: "SOC award $" },
  { key: "collectionView", label: "Collection $" },
  { key: "share", label: "In-vertical %" },
  { key: "nCombos", label: "# combos" },
  { key: "nEntities", label: "# primes" },
  { key: "nSubEntities", label: "# subs" },
];

export function StaffingMarket() {
  const [inds, setInds] = useState<Set<string>>(new Set());
  const [reviewOnly, setReviewOnly] = useState(false);
  const [geoPosture, setGeoPosture] = useState<"all" | "national" | "regional">("all");
  const [shareMin, setShareMin] = useState("");
  const [shareMax, setShareMax] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("labor");
  const [selected, setSelected] = useState<Row | null>(null);

  const toggleInd = (v: string) =>
    setInds((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const lo = shareMin.trim() === "" ? 0 : Number.parseFloat(shareMin) / 100;
  const hi = shareMax.trim() === "" ? 1 : Number.parseFloat(shareMax) / 100;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = ROWS.filter(
      (r) =>
        (!reviewOnly || r.review) &&
        (geoPosture === "all" || (geoPosture === "national") === (r.nStates === 89)) &&
        (inds.size === 0 || r.industries.some((i) => inds.has(i))) &&
        (r.share === null || (r.share >= lo && r.share <= hi)) &&
        (q === "" || r.name.toLowerCase().includes(q) || r.uei.toLowerCase() === q),
    );
    rows.sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1));
    return rows;
  }, [inds, reviewOnly, geoPosture, lo, hi, search, sortKey]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const shares = filtered.filter((r) => r.share !== null).map((r) => r.share as number);
    return {
      firms: filtered.length,
      laborMed: median(filtered.map((r) => r.labor)),
      cvMed: median(filtered.map((r) => r.collectionView)),
      shareMed: shares.length ? median(shares) : null,
      reviews: filtered.filter((r) => r.review).length,
    };
  }, [filtered]);

  const th = {
    borderBottom: "2px solid #1a1a1a",
    padding: "8px 10px",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "#555",
    whiteSpace: "nowrap" as const,
  };
  const td = {
    ...mono,
    padding: "7px 10px",
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  };

  if (selected) {
    return (
      <StaffingFirmDetail
        uei={selected.uei}
        name={selected.name}
        band={selected.band}
        domain={selected.domain}
        industries={selected.industries}
        collections={selected.collections}
        share={selected.share}
        collectionView={selected.collectionView}
        review={selected.review}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Staffing market sizing</h1>
      <p style={{ color: "#555", margin: "6px 0 20px", maxWidth: 960 }}>
        {ROWS.length.toLocaleString()} SAM-matched staffing agencies (1–500 + unknown band). Base:
        the <b>{data.window}</b>. Two sizings side by side: <b>SOC labor $</b> = geo-gated implied
        labor in the active book reachable from their advertised roles (rank≤3, ≥2-SOC overlap, ×
        SUSB/ECEC labor share); <b>Collection $</b> = the same measure over their declared
        verticals&apos; staffing-native collection pairs. In-vertical % = how much of the first sits
        inside the second&apos;s pairs. REVIEW = &lt;20% share on &gt;$100M (roles vs declared
        verticals disagree). {data.artifact}
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#777" }}>
          Industries
        </span>
        {INDUSTRIES.map((v) => {
          const on = inds.has(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => toggleInd(v)}
              style={{
                padding: "5px 10px",
                border: `1px solid ${on ? "#1a1a1a" : "#bbb"}`,
                background: on ? "#1a1a1a" : "#fff",
                color: on ? "#fff" : "#555",
                fontSize: 12,
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
                ...mono,
              }}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setReviewOnly((v) => !v)}
          style={{
            padding: "5px 10px",
            border: `1px solid ${reviewOnly ? "#c0392b" : "#bbb"}`,
            background: reviewOnly ? "#c0392b" : "#fff",
            color: reviewOnly ? "#fff" : "#555",
            fontSize: 13,
            fontWeight: reviewOnly ? 700 : 500,
            cursor: "pointer",
          }}
        >
          REVIEW only
        </button>
        {(
          [
            ["all", "all geo"],
            ["national", "national"],
            ["regional", "regional"],
          ] as const
        ).map(([key, label]) => {
          const on = geoPosture === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setGeoPosture(key)}
              style={{
                padding: "5px 10px",
                border: `1px solid ${on ? "#1a1a1a" : "#bbb"}`,
                background: on ? "#1a1a1a" : "#fff",
                color: on ? "#fff" : "#555",
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#777" }}>
          In-vertical %
        </span>
        <input
          placeholder="0"
          value={shareMin}
          onChange={(e) => setShareMin(e.target.value)}
          style={{ border: "1px solid #bbb", padding: "5px 8px", fontSize: 14, width: 48, ...mono }}
        />
        <span style={{ color: "#999" }}>–</span>
        <input
          placeholder="100"
          value={shareMax}
          onChange={(e) => setShareMax(e.target.value)}
          style={{ border: "1px solid #bbb", padding: "5px 8px", fontSize: 14, width: 48, ...mono }}
        />
        <input
          placeholder="search name / exact UEI"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: "1px solid #bbb", padding: "6px 10px", fontSize: 14, width: 250 }}
        />
      </div>

      {stats === null ? (
        <p style={{ color: "#999" }}>No firms match.</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: 28,
              flexWrap: "wrap",
              padding: "12px 16px",
              background: "#f6f6f6",
              border: "1px solid #ddd",
              marginBottom: 18,
            }}
          >
            {(
              [
                ["Firms", String(stats.firms)],
                ["SOC labor $ — median", fmt$(stats.laborMed)],
                ["Collection $ — median", fmt$(stats.cvMed)],
                [
                  "In-vertical % — median",
                  stats.shareMed === null ? "—" : `${Math.round(stats.shareMed * 100)}%`,
                ],
                ["REVIEW flags", String(stats.reviews)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 12, textTransform: "uppercase", color: "#777" }}>
                  {label}
                </div>
                <div style={{ ...mono, fontSize: 18, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>Firm</th>
                  <th style={{ ...th, textAlign: "left" }}>Band</th>
                  <th style={{ ...th, textAlign: "left" }}>Industries → collections</th>
                  {SORTS.map((s) => (
                    <th key={s.key} style={{ ...th, padding: 0, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => setSortKey(s.key)}
                        style={{
                          border: 0,
                          background: "transparent",
                          padding: "8px 10px",
                          font: "inherit",
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          fontWeight: 700,
                          cursor: "pointer",
                          color: sortKey === s.key ? "#1a1a1a" : "#555",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.label}
                        {sortKey === s.key ? " ↓" : ""}
                      </button>
                    </th>
                  ))}
                  <th style={{ ...th, textAlign: "left" }}>Top cells by labor $</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.uei}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: r.review ? "#fdf3f2" : undefined,
                    }}
                  >
                    <td style={{ padding: "7px 10px", maxWidth: 280 }}>
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(r)}
                          style={{
                            border: 0,
                            background: "transparent",
                            padding: 0,
                            font: "inherit",
                            cursor: "pointer",
                            color: "#1a4d8f",
                            textDecoration: "underline",
                          }}
                        >
                          {r.name}
                        </button>
                        {r.review && (
                          <span style={{ color: "#c0392b", fontSize: 11, fontWeight: 700 }}>
                            {" "}
                            REVIEW
                          </span>
                        )}
                      </div>
                      <div style={{ ...mono, fontSize: 11, color: "#999" }}>
                        {r.uei}
                        {r.domain ? ` · ${r.domain}` : ""}
                        {r.hqState ? ` · ${r.hqState}` : ""}
                        {` · ${r.nStates === 89 ? "national" : `${r.nStates} state${r.nStates === 1 ? "" : "s"}`}`}
                      </div>
                    </td>
                    <td style={{ ...mono, padding: "7px 10px", fontSize: 12 }}>{r.band}</td>
                    <td style={{ padding: "7px 10px", maxWidth: 240 }}>
                      <div
                        style={{
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={`${r.industries.join(", ")} → ${r.collections.join(", ")}`}
                      >
                        {r.industries.join(", ") || "—"}
                      </div>
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.labor > 0 ? fmt$(r.labor) : "—"}</td>
                    <td style={td}>{r.award > 0 ? fmt$(r.award) : "—"}</td>
                    <td style={td}>{r.collectionView > 0 ? fmt$(r.collectionView) : "—"}</td>
                    <td style={td}>{r.share === null ? "—" : `${Math.round(r.share * 100)}%`}</td>
                    <td style={td}>{r.nCombos.toLocaleString()}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {r.nEntities === null ? "—" : r.nEntities.toLocaleString()}
                    </td>
                    <td
                      style={td}
                      title={
                        r.nSubWithPrime === null
                          ? undefined
                          : `${r.nSubWithPrime.toLocaleString()} of these subs have their own prime history`
                      }
                    >
                      {r.nSubEntities === null ? "—" : r.nSubEntities.toLocaleString()}
                    </td>
                    <td style={{ padding: "7px 10px", maxWidth: 380 }}>
                      <div
                        style={{
                          ...mono,
                          fontSize: 11,
                          color: "#555",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={r.topCells}
                      >
                        {r.topCells || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
