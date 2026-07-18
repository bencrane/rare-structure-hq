/**
 * SubawardeeMarket — filterable firm table over the FY23–25 subawardee cohort.
 *
 * Cohort (baked, subawardee-market.json): every subawardee whose FY23–25
 * total (subaward $ received + prime obligations won) >= $1M. Filters are
 * plain min/max bands + chip selects; the table and segment stats re-read
 * live from the client-side rows.
 *
 * Representation notes:
 * - prime$ = summed FPDS obligations won FY23–25 (gtm_entity_fy_won);
 *   sub$ = summed FSRS subaward amounts FY23–25. sub share = sub / total.
 * - Subaward size stats (avg/median) are per-firm over that firm's FY23–25
 *   subawards only — prime awards are never blended into them.
 * - Employee band comes from the audience spine (firmographics enrichment);
 *   firms without an enriched band are "unknown" and stay visible unless
 *   bands are filtered.
 */
import { useMemo, useState } from "react";

import baked from "@/internal/subawardee-market.json";

const data = baked as unknown as {
  window: string;
  artifact: string;
  cohort: string;
  columns: string[];
  // uei, name, state, band, naics, naics_name, sub_amt, prime_amt, n_subs,
  // avg_sub, med_sub, prime_action_ct, domain, domain_source,
  // top3_prime, top3_sub (packed "NAICSxPSC|share~..." FY23–25, own-side shares)
  rows: [
    string,
    string,
    string | null,
    string | null,
    string | null,
    string | null,
    number,
    number,
    number,
    number,
    number,
    number,
    string | null,
    string | null,
    string | null,
    string | null,
  ][];
  // "NAICSxPSC" -> [gpt-5.4 "to: ..." phrase | null, work_summary | null]
  combo_lang: Record<string, [string | null, string | null]>;
};

const LANG: Record<string, [string | null, string | null]> =
  (data as { combo_lang?: Record<string, [string | null, string | null]> }).combo_lang ?? {};

const langFor = (c: Combo | undefined): [string, string] => {
  if (!c) return ["", ""];
  const hit = LANG[`${c.naics}x${c.psc}`];
  return [hit?.[0] ?? "", hit?.[1] ?? ""];
};

const BANDS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
  "unknown",
];

type Row = {
  uei: string;
  name: string;
  state: string;
  band: string;
  naics: string;
  naicsName: string;
  sub: number;
  prime: number;
  total: number;
  share: number;
  nSubs: number;
  avgSub: number;
  medSub: number;
  domain: string;
  domainSource: string;
  top3Prime: Combo[];
  top3Sub: Combo[];
  primeComboKey: string;
  subComboKey: string;
};

type Combo = { naics: string; psc: string; share: number };
type RowFull = Row & { leadJtbd: string; leadWorkSummary: string; leadIsSub: boolean };

/** Unpack "336411x1510|79~336411xJ016|5" → Combo[]. */
function parseCombos(packed: string | null): Combo[] {
  if (!packed) return [];
  return packed.split("~").map((part) => {
    const [codes, share] = part.split("|");
    const [naics, psc] = codes.split("x");
    return { naics, psc, share: Number(share) };
  });
}

const ROWS: RowFull[] = data.rows
  .map(
    ([
      uei,
      name,
      state,
      band,
      naics,
      naicsName,
      sub,
      prime,
      nSubs,
      avgSub,
      medSub,
      ,
      domain,
      domainSource,
      top3Prime,
      top3Sub,
    ]) => ({
      uei,
      name,
      state: state ?? "—",
      band: band ?? "unknown",
      naics: naics ?? "—",
      naicsName: naicsName ?? "",
      sub,
      prime,
      total: sub + prime,
      share: sub / (sub + prime),
      nSubs,
      avgSub,
      medSub,
      domain: domain ?? "",
      domainSource: domainSource ?? "",
      top3Prime: parseCombos(top3Prime),
      top3Sub: parseCombos(top3Sub),
      primeComboKey: (top3Prime ?? "").toLowerCase(),
      subComboKey: (top3Sub ?? "").toLowerCase(),
    }),
  )
  .map((r) => {
    const lead = r.top3Prime[0] ?? r.top3Sub[0];
    const [jtbd, workSummary] = langFor(lead);
    return {
      ...r,
      leadJtbd: jtbd,
      leadWorkSummary: workSummary,
      leadIsSub: r.top3Prime.length === 0,
    };
  });

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

/** Parse "$10m", "1.5b", "250k", "1000000" → dollars; null = blank/invalid. */
function parseMoney(s: string): number | null {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[$,\s]/g, "");
  if (!t) return null;
  const m = t.match(/^([0-9]*\.?[0-9]+)([kmb])?$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  const mult = m[2] === "b" ? 1e9 : m[2] === "m" ? 1e6 : m[2] === "k" ? 1e3 : 1;
  return n * mult;
}

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;

type SortKey = "total" | "sub" | "prime" | "share" | "nSubs" | "avgSub" | "medSub";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "total", label: "Total $" },
  { key: "sub", label: "Sub $" },
  { key: "prime", label: "Prime $" },
  { key: "share", label: "Sub share" },
  { key: "nSubs", label: "# subawards" },
  { key: "avgSub", label: "Avg sub" },
  { key: "medSub", label: "Med sub" },
];

/** One labeled min/max dollar-band pair. */
function Band({
  label,
  min,
  max,
  setMin,
  setMax,
}: {
  label: string;
  min: string;
  max: string;
  setMin: (v: string) => void;
  setMax: (v: string) => void;
}) {
  const bad =
    (min.trim() !== "" && parseMoney(min) === null) ||
    (max.trim() !== "" && parseMoney(max) === null);
  const inputStyle = {
    border: `1px solid ${bad ? "#c0392b" : "#bbb"}`,
    padding: "5px 8px",
    fontSize: 14,
    width: 84,
    ...mono,
  } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#777" }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          placeholder="min"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          style={inputStyle}
        />
        <span style={{ color: "#999" }}>–</span>
        <input
          placeholder="max"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          style={inputStyle}
        />
      </div>
    </div>
  );
}

const inBand = (v: number, minS: string, maxS: string): boolean => {
  const lo = parseMoney(minS);
  const hi = parseMoney(maxS);
  return v >= (lo ?? 0) && v < (hi ?? Number.POSITIVE_INFINITY);
};

/** Up to three "NAICS×PSC share%" lines; share is of that side's own FY23–25 $. */
function ComboList({ combos }: { combos: Combo[] }) {
  if (combos.length === 0) return <span style={{ color: "#ccc" }}>—</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {combos.map((c) => {
        const [jtbd, ws] = langFor(c);
        const tip = [jtbd, ws].filter(Boolean).join("\n");
        return (
          <span
            key={`${c.naics}x${c.psc}`}
            title={tip || undefined}
            style={{
              ...mono,
              fontSize: 12,
              whiteSpace: "nowrap",
              cursor: tip ? "help" : undefined,
            }}
          >
            {c.naics}×{c.psc}
            <span style={{ color: "#999" }}> {c.share}%</span>
          </span>
        );
      })}
    </div>
  );
}

const SHOW = 300;

export function SubawardeeMarket() {
  // #1 total band — cohort floor pre-applied at bake time ($1M).
  const [totalMin, setTotalMin] = useState("$1m");
  const [totalMax, setTotalMax] = useState("");
  // #2 prime / sub bands.
  const [primeMin, setPrimeMin] = useState("");
  const [primeMax, setPrimeMax] = useState("");
  const [subMin, setSubMin] = useState("");
  const [subMax, setSubMax] = useState("");
  // #4 per-firm subaward-size bands (avg + median).
  const [avgSubMin, setAvgSubMin] = useState("");
  const [avgSubMax, setAvgSubMax] = useState("");
  const [medSubMin, setMedSubMin] = useState("");
  const [medSubMax, setMedSubMax] = useState("");
  // Sub-share band, percent (0–100).
  const [shareMin, setShareMin] = useState("");
  const [shareMax, setShareMax] = useState("");
  // #3 employee bands (empty selection = all, incl. unknown).
  const [bands, setBands] = useState<Set<string>>(new Set());
  const [state, setState] = useState("");
  // Domain toggle: all / has (SAM entity_url or DSBS) / none.
  const [domainFilter, setDomainFilter] = useState<"all" | "has" | "none">("all");
  // Combo filters: substring over the firm's top-3 codes ("541511", "R425", "541511xR425").
  const [primeCombo, setPrimeCombo] = useState("");
  const [subCombo, setSubCombo] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");

  const toggleBand = (b: string) => {
    setBands((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  };

  const shareLo = shareMin.trim() === "" ? 0 : Number.parseFloat(shareMin) / 100;
  const shareHi = shareMax.trim() === "" ? 1 : Number.parseFloat(shareMax) / 100;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const st = state.trim().toUpperCase();
    const pc = primeCombo.trim().toLowerCase();
    const sc = subCombo.trim().toLowerCase();
    const rows = ROWS.filter(
      (r) =>
        inBand(r.total, totalMin, totalMax) &&
        inBand(r.prime, primeMin, primeMax) &&
        inBand(r.sub, subMin, subMax) &&
        inBand(r.avgSub, avgSubMin, avgSubMax) &&
        inBand(r.medSub, medSubMin, medSubMax) &&
        r.share >= (Number.isNaN(shareLo) ? 0 : shareLo) &&
        r.share <= (Number.isNaN(shareHi) ? 1 : shareHi) &&
        (bands.size === 0 || bands.has(r.band)) &&
        (domainFilter === "all" || (domainFilter === "has") === (r.domain !== "")) &&
        (pc === "" || r.primeComboKey.includes(pc)) &&
        (sc === "" || r.subComboKey.includes(sc)) &&
        (st === "" || r.state === st) &&
        (q === "" || r.name.toLowerCase().includes(q) || r.uei.toLowerCase() === q),
    );
    rows.sort((a, b) => b[sortKey] - a[sortKey]);
    return rows;
  }, [
    totalMin,
    totalMax,
    primeMin,
    primeMax,
    subMin,
    subMax,
    avgSubMin,
    avgSubMax,
    medSubMin,
    medSubMax,
    shareLo,
    shareHi,
    bands,
    state,
    search,
    sortKey,
    domainFilter,
    primeCombo,
    subCombo,
  ]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    return {
      firms: filtered.length,
      subTotal: filtered.reduce((n, r) => n + r.sub, 0),
      primeTotal: filtered.reduce((n, r) => n + r.prime, 0),
      totalMed: median(filtered.map((r) => r.total)),
      shareMed: median(filtered.map((r) => r.share)),
      subsOnly: filtered.filter((r) => r.prime <= 0).length,
      withDomain: filtered.filter((r) => r.domain !== "").length,
      medSubMed: median(filtered.map((r) => r.medSub)),
    };
  }, [filtered]);

  const th = {
    textAlign: "right" as const,
    borderBottom: "2px solid #1a1a1a",
    padding: "8px 10px",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "#555",
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
    userSelect: "none" as const,
  };
  const td = {
    ...mono,
    padding: "7px 10px",
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Subawardee market</h1>
      <p style={{ color: "#555", margin: "6px 0 20px", maxWidth: 920 }}>
        Every subawardee with ≥ $1M total (subaward $ received + prime obligations won) in{" "}
        {data.window}. Blank min = 0, blank max = no cap, max exclusive; $ inputs accept 500k / $10m
        / 1.5b. Avg/median subaward size are per-firm over that firm&apos;s own FY23–25 subawards
        (prime awards never blended in). Job / Work summary describe the firm&apos;s #1 combo
        (own-prime preferred; marked &quot;(subs-under)&quot; when the firm has no prime combos —
        then it describes the PRIME&apos;s work they sub under, not their own). Hover any combo for
        both texts. {data.artifact.replace("query-sidecar/", "")}
      </p>

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: 14,
        }}
      >
        <Band
          label="Total $ FY23–25"
          min={totalMin}
          max={totalMax}
          setMin={setTotalMin}
          setMax={setTotalMax}
        />
        <Band
          label="Prime $"
          min={primeMin}
          max={primeMax}
          setMin={setPrimeMin}
          setMax={setPrimeMax}
        />
        <Band label="Sub $" min={subMin} max={subMax} setMin={setSubMin} setMax={setSubMax} />
        <Band
          label="Avg subaward"
          min={avgSubMin}
          max={avgSubMax}
          setMin={setAvgSubMin}
          setMax={setAvgSubMax}
        />
        <Band
          label="Median subaward"
          min={medSubMin}
          max={medSubMax}
          setMin={setMedSubMin}
          setMax={setMedSubMax}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#777" }}
          >
            Sub share %
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              placeholder="0"
              value={shareMin}
              onChange={(e) => setShareMin(e.target.value)}
              style={{
                border: "1px solid #bbb",
                padding: "5px 8px",
                fontSize: 14,
                width: 48,
                ...mono,
              }}
            />
            <span style={{ color: "#999" }}>–</span>
            <input
              placeholder="100"
              value={shareMax}
              onChange={(e) => setShareMax(e.target.value)}
              style={{
                border: "1px solid #bbb",
                padding: "5px 8px",
                fontSize: 14,
                width: 48,
                ...mono,
              }}
            />
          </div>
        </div>
      </div>

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
          Employees
        </span>
        {BANDS.map((b) => {
          const on = bands.has(b);
          return (
            <button
              key={b}
              type="button"
              onClick={() => toggleBand(b)}
              style={{
                padding: "5px 10px",
                border: `1px solid ${on ? "#1a1a1a" : "#bbb"}`,
                background: on ? "#1a1a1a" : "#fff",
                color: on ? "#fff" : "#555",
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                cursor: "pointer",
                ...mono,
              }}
            >
              {b}
            </button>
          );
        })}
        <span style={{ fontSize: 12, color: "#999" }}>none selected = all</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#777" }}>
          Domain
        </span>
        {(
          [
            ["all", "all"],
            ["has", "has domain"],
            ["none", "no domain"],
          ] as const
        ).map(([key, label]) => {
          const on = domainFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setDomainFilter(key)}
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
        <input
          placeholder="prime combo (541511 / R425)"
          value={primeCombo}
          onChange={(e) => setPrimeCombo(e.target.value)}
          style={{
            border: "1px solid #bbb",
            padding: "6px 10px",
            fontSize: 14,
            width: 200,
            ...mono,
          }}
        />
        <input
          placeholder="subs-under combo"
          value={subCombo}
          onChange={(e) => setSubCombo(e.target.value)}
          style={{
            border: "1px solid #bbb",
            padding: "6px 10px",
            fontSize: 14,
            width: 170,
            ...mono,
          }}
        />
        <input
          placeholder="state (e.g. VA)"
          value={state}
          onChange={(e) => setState(e.target.value)}
          style={{
            border: "1px solid #bbb",
            padding: "6px 10px",
            fontSize: 14,
            width: 110,
            ...mono,
          }}
        />
        <input
          placeholder="search name / exact UEI"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: "1px solid #bbb", padding: "6px 10px", fontSize: 14, width: 260 }}
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
                ["Firms", stats.firms.toLocaleString()],
                ["Sub $ total", fmt$(stats.subTotal)],
                ["Prime $ total", fmt$(stats.primeTotal)],
                ["Total $ — median firm", fmt$(stats.totalMed)],
                ["Sub share — median", `${Math.round(stats.shareMed * 100)}%`],
                [
                  "Subs-only firms",
                  `${stats.subsOnly.toLocaleString()} (${Math.round((stats.subsOnly / stats.firms) * 100)}%)`,
                ],
                [
                  "With domain",
                  `${stats.withDomain.toLocaleString()} (${Math.round((stats.withDomain / stats.firms) * 100)}%)`,
                ],
                ["Median subaward — median firm", fmt$(stats.medSubMed)],
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

          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", cursor: "default" }}>Firm</th>
                <th style={{ ...th, textAlign: "left", cursor: "default" }}>St</th>
                <th style={{ ...th, textAlign: "left", cursor: "default" }}>Employees</th>
                <th style={{ ...th, textAlign: "left", cursor: "default" }}>Primary NAICS</th>
                <th style={{ ...th, textAlign: "left", cursor: "default" }}>Top prime combos</th>
                <th style={{ ...th, textAlign: "left", cursor: "default" }}>
                  Top subs-under combos
                </th>
                {SORTS.map((s) => (
                  <th key={s.key} style={{ ...th, cursor: "default", padding: 0 }}>
                    <button
                      type="button"
                      onClick={() => setSortKey(s.key)}
                      title="sort"
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
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, SHOW).map((r) => (
                <tr key={r.uei} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "7px 10px", maxWidth: 340 }}>
                    <div
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {r.name}
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: "#999" }}>
                      {r.uei}
                      {r.domain ? ` · ${r.domain}` : ""}
                    </div>
                  </td>
                  <td style={{ padding: "7px 10px" }}>{r.state}</td>
                  <td style={{ ...mono, padding: "7px 10px", fontSize: 13 }}>{r.band}</td>
                  <td style={{ padding: "7px 10px", maxWidth: 220 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 13,
                      }}
                    >
                      <span style={mono}>{r.naics}</span>
                      {r.naicsName ? ` ${r.naicsName}` : ""}
                    </div>
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <ComboList combos={r.top3Prime} />
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <ComboList combos={r.top3Sub} />
                  </td>
                  <td style={{ padding: "7px 10px", maxWidth: 220 }}>
                    <div
                      style={{ fontSize: 12, color: r.leadIsSub ? "#996" : "#333" }}
                      title={r.leadJtbd}
                    >
                      {r.leadJtbd}
                      {r.leadJtbd && r.leadIsSub ? " (subs-under)" : ""}
                    </div>
                  </td>
                  <td style={{ padding: "7px 10px", maxWidth: 320 }}>
                    <div style={{ fontSize: 12, color: "#333" }}>{r.leadWorkSummary}</div>
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmt$(r.total)}</td>
                  <td style={td}>{fmt$(r.sub)}</td>
                  <td style={td}>{fmt$(r.prime)}</td>
                  <td style={td}>{Math.round(r.share * 100)}%</td>
                  <td style={td}>{r.nSubs.toLocaleString()}</td>
                  <td style={td}>{fmt$(r.avgSub)}</td>
                  <td style={td}>{fmt$(r.medSub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > SHOW && (
            <p style={{ fontSize: 13, color: "#666", marginTop: 10 }}>
              Showing top {SHOW} of {filtered.length.toLocaleString()} by{" "}
              {SORTS.find((s) => s.key === sortKey)?.label} — tighten filters to narrow.
            </p>
          )}
        </>
      )}
    </div>
  );
}
