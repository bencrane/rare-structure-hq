/**
 * CodeReference — the internal viewer's code-reference body for the
 * facilities-services cut (NAICS 56 × PSC S*). Every NAICS under 56 at each
 * digit granularity with official titles + descriptions, and every S-family
 * PSC with name/description, each annotated with the passed dataset's activity
 * (obligated $B + firms, aggregated by prefix at coarser granularities).
 * Datasets are baked JSONs in src/internal/ (window vs active-awards).
 *
 * INTERNAL VIEWER: deliberately not on the app design system — plain light,
 * high-contrast styling optimized for reading, per operator directive
 * 2026-07-16.
 */
import { useMemo, useState } from "react";

export type NaicsRow = {
  naics_code: string;
  naics_title: string;
  description: string | null;
  code_len: number;
};
export type PscRow = {
  psc_code: string;
  psc_name: string;
  full_description: string | null;
  includes: string | null;
  excludes: string | null;
  code_len: number;
  is_active: boolean;
};
type ActRow = { naics_code: string; psc_code: string; oblB: number; firms: number };

export type CodeDataset = {
  scope: string;
  window: string;
  baked_from: string;
  naics: NaicsRow[];
  psc: PscRow[];
  activity: ActRow[];
};

const S = {
  page: {
    background: "#ffffff",
    color: "#1a1a1a",
    minHeight: "100vh",
    padding: "40px 48px",
    fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 15,
    lineHeight: 1.55,
  } as const,
  h1: { fontSize: 26, fontWeight: 700, margin: 0 } as const,
  meta: { color: "#555", margin: "6px 0 28px" } as const,
  h2: { fontSize: 20, fontWeight: 700, margin: "36px 0 12px" } as const,
  tabs: { display: "flex", gap: 8, margin: "0 0 16px" } as const,
  code: {
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSize: 14,
    fontWeight: 700,
  } as const,
  row: {
    borderTop: "1px solid #ddd",
    padding: "12px 4px",
    display: "grid",
    gridTemplateColumns: "110px 1fr 190px",
    gap: 16,
    alignItems: "start",
  } as const,
  desc: { color: "#444", whiteSpace: "pre-wrap" as const, marginTop: 4, fontSize: 14 },
  act: { textAlign: "right" as const, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 },
  dim: { color: "#999" } as const,
};

function tabBtn(active: boolean) {
  return {
    padding: "6px 14px",
    border: "1px solid " + (active ? "#1a1a1a" : "#bbb"),
    background: active ? "#1a1a1a" : "#fff",
    color: active ? "#fff" : "#333",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

const fmtB = (n: number): string =>
  n >= 1 ? `$${n.toFixed(1)}B` : n > 0 ? `$${Math.round(n * 1000)}M` : "—";

export function CodeReference({ data }: { data: CodeDataset }) {
  const [digits, setDigits] = useState<number>(6);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Window activity rolled up to a NAICS prefix / a PSC code.
  const byNaics = useMemo(() => {
    // Firms can't be deduped across baked pair rows (no UEIs) — $ is exact; firms
    // shown as the max-pair lower bound.
    const agg = new Map<string, { oblB: number; pairs: number; firmsMax: number }>();
    for (const a of data.activity) {
      for (const len of [2, 3, 4, 5, 6]) {
        const key = a.naics_code.slice(0, len);
        const cur = agg.get(key) ?? { oblB: 0, pairs: 0, firmsMax: 0 };
        cur.oblB += a.oblB;
        cur.pairs += 1;
        cur.firmsMax = Math.max(cur.firmsMax, a.firms);
        agg.set(key, cur);
      }
    }
    return agg;
  }, [data]);

  const byPsc = useMemo(() => {
    const agg = new Map<string, { oblB: number; pairs: number; firmsMax: number }>();
    for (const a of data.activity) {
      for (const key of [a.psc_code.slice(0, 2), a.psc_code]) {
        const cur = agg.get(key) ?? { oblB: 0, pairs: 0, firmsMax: 0 };
        cur.oblB += a.oblB;
        cur.pairs += 1;
        cur.firmsMax = Math.max(cur.firmsMax, a.firms);
        agg.set(key, cur);
      }
    }
    return agg;
  }, [data]);

  const naicsAtLevel = useMemo(
    () =>
      data.naics
        .filter((r) => r.code_len === digits)
        .sort((a, b) => a.naics_code.localeCompare(b.naics_code)),
    [digits, data],
  );

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const activity = (agg: { oblB: number; firmsMax: number } | undefined) =>
    agg ? (
      <div style={S.act}>
        <div>{fmtB(agg.oblB)} in window</div>
        <div style={S.dim}>≥{agg.firmsMax.toLocaleString()} firms</div>
      </div>
    ) : (
      <div style={{ ...S.act, ...S.dim }}>no activity in cut</div>
    );

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Facilities cut — code reference</h1>
      <p style={S.meta}>
        {data.scope} · window {data.window} · baked from {data.baked_from}
        <br />
        Activity = obligations within NAICS 56 × PSC S* only. Firm counts are per-pair lower bounds
        (pairs can share firms).
      </p>

      <h2 style={S.h2}>NAICS under 56 — {naicsAtLevel.length} codes at this granularity</h2>
      <div style={S.tabs}>
        {[2, 3, 4, 5, 6].map((d) => (
          <button key={d} type="button" style={tabBtn(digits === d)} onClick={() => setDigits(d)}>
            {d}-digit
          </button>
        ))}
      </div>
      <div>
        {naicsAtLevel.map((r) => (
          <div key={r.naics_code} style={S.row}>
            <span style={S.code}>{r.naics_code}</span>
            <div>
              <div style={{ fontWeight: 600 }}>{r.naics_title}</div>
              {r.description ? (
                expanded.has(r.naics_code) ? (
                  <div style={S.desc}>
                    {r.description}{" "}
                    <button
                      type="button"
                      onClick={() => toggle(r.naics_code)}
                      style={{
                        border: 0,
                        background: "none",
                        color: "#0645ad",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      collapse
                    </button>
                  </div>
                ) : (
                  <div style={S.desc}>
                    {r.description.slice(0, 220)}
                    {r.description.length > 220 ? (
                      <>
                        …{" "}
                        <button
                          type="button"
                          onClick={() => toggle(r.naics_code)}
                          style={{
                            border: 0,
                            background: "none",
                            color: "#0645ad",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          more
                        </button>
                      </>
                    ) : null}
                  </div>
                )
              ) : (
                <div style={{ ...S.desc, ...S.dim }}>no description in reference</div>
              )}
            </div>
            {activity(byNaics.get(r.naics_code))}
          </div>
        ))}
      </div>

      <h2 style={S.h2}>PSC S-family — {data.psc.length} codes</h2>
      <div>
        {data.psc.map((r) => (
          <div key={r.psc_code} style={S.row}>
            <span style={S.code}>{r.psc_code}</span>
            <div>
              <div style={{ fontWeight: 600 }}>
                {r.psc_name}
                {r.is_active ? null : <span style={S.dim}> · retired</span>}
              </div>
              {r.full_description ? <div style={S.desc}>{r.full_description}</div> : null}
              {r.includes ? <div style={S.desc}>Includes: {r.includes}</div> : null}
              {r.excludes ? <div style={S.desc}>Excludes: {r.excludes}</div> : null}
            </div>
            {activity(byPsc.get(r.psc_code))}
          </div>
        ))}
      </div>
    </div>
  );
}
