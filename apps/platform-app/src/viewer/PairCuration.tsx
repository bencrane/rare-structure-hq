/**
 * PairCuration — the market-collection pair-curation instrument.
 *
 * Every (NAICS6, PSC4) pair actually observed in the FY23–25 window for the
 * three clusters (security / building-services / facilities-ops), with the
 * proposed disposition (keep / strike / flag) and its reason. The operator
 * overrides per row; overrides persist in localStorage under
 * `viewer.pair-curation.v1`. "Copy decisions" exports the final dispositions
 * as JSON for the ruling → the enumerated combo_scope rewrite.
 */
import { useEffect, useMemo, useState } from "react";

import baked from "@/internal/pair-curation.json";

type Disposition = "keep" | "strike" | "flag";

type PairRow = {
  cluster: string;
  rank: number;
  naics_code: string;
  naics_title: string | null;
  psc_code: string;
  psc_name: string | null;
  psc_description: string | null;
  what_was_done: string | null;
  obl_m: number;
  firms: number;
  actions: number;
  proposed: Disposition;
  reason: string;
};

const data = baked as unknown as {
  title: string;
  window: string;
  source: string;
  artifact: string;
  principle: string;
  pairs: PairRow[];
};

const STORAGE_KEY = "viewer.pair-curation.v1";

type Overrides = Record<string, Disposition>; // "naics|psc" -> disposition

function loadOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

const pairKey = (p: PairRow): string => `${p.naics_code}|${p.psc_code}`;

const CLUSTERS = ["security", "building-services", "facilities-ops"] as const;

const CLUSTER_LABEL: Record<string, string> = {
  security: "Security & Protective Services (5616 NAICS × S2)",
  "building-services": "Building Services (5617 NAICS × S2)",
  "facilities-ops": "Facilities Support & Operations (5611/12/13/14/19 NAICS × S2)",
};

const DISP_STYLE: Record<Disposition, { bg: string; badge: string; label: string }> = {
  keep: { bg: "#fff", badge: "#0a7d32", label: "KEEP" },
  strike: { bg: "#faf5f5", badge: "#b03030", label: "STRIKE" },
  flag: { bg: "#fdf8ec", badge: "#a07800", label: "FLAG" },
};

const fmtM = (m: number): string =>
  Math.abs(m) >= 1000
    ? `$${(m / 1000).toFixed(2)}B`
    : Math.abs(m) >= 1
      ? `$${m.toFixed(1)}M`
      : `$${Math.round(m * 1000).toLocaleString()}K`;

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;
const cell = { padding: "9px 10px", verticalAlign: "top" as const };

export function PairCuration() {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }, [overrides]);

  const disposition = (p: PairRow): Disposition => overrides[pairKey(p)] ?? p.proposed;

  const setDisposition = (p: PairRow, d: Disposition) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (d === p.proposed) delete next[pairKey(p)];
      else next[pairKey(p)] = d;
      return next;
    });
  };

  const summary = useMemo(() => {
    const s: Record<string, Record<Disposition, { pairs: number; oblM: number }>> = {};
    for (const p of data.pairs) {
      const d = disposition(p);
      s[p.cluster] ??= {
        keep: { pairs: 0, oblM: 0 },
        strike: { pairs: 0, oblM: 0 },
        flag: { pairs: 0, oblM: 0 },
      };
      s[p.cluster][d].pairs += 1;
      s[p.cluster][d].oblM += p.obl_m;
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  const copyDecisions = () => {
    const decisions = CLUSTERS.map((cl) => ({
      cluster: cl,
      keep: data.pairs
        .filter((p) => p.cluster === cl && disposition(p) === "keep")
        .map((p) => [p.naics_code, p.psc_code]),
      flag: data.pairs
        .filter((p) => p.cluster === cl && disposition(p) === "flag")
        .map((p) => [p.naics_code, p.psc_code]),
      strike: data.pairs
        .filter((p) => p.cluster === cl && disposition(p) === "strike")
        .map((p) => [p.naics_code, p.psc_code]),
    }));
    navigator.clipboard
      .writeText(JSON.stringify({ artifact: data.artifact, window: data.window, decisions }, null, 1))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const overrideCt = Object.keys(overrides).length;

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Pair curation — keep / strike</h1>
      <p style={{ color: "#555", margin: "6px 0 8px", maxWidth: 900 }}>
        Every (NAICS6, PSC4) pair observed in the window · {data.window} · {data.pairs.length} pairs
        · {data.artifact.replace("query-sidecar/", "")}
        <br />
        Principle: {data.principle}
        <br />
        Click a badge to override a row's disposition (persists locally). "Copy decisions" exports
        the final keep/strike lists for the definition rewrite.
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
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
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
        <span style={{ fontSize: 13, color: "#777" }}>
          {overrideCt === 0
            ? "no overrides — showing the proposed dispositions"
            : `${overrideCt} override${overrideCt === 1 ? "" : "s"} of the proposal`}
        </span>
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
            Reset to proposal
          </button>
        ) : null}
      </div>

      {CLUSTERS.map((cl) => {
        const pairs = data.pairs.filter((p) => p.cluster === cl);
        const s = summary[cl];
        return (
          <section key={cl} style={{ marginTop: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 2px" }}>
              {CLUSTER_LABEL[cl]}
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#555" }}>
              keep {s.keep.pairs} pairs · {fmtM(s.keep.oblM)} — strike {s.strike.pairs} pairs ·{" "}
              {fmtM(s.strike.oblM)}
              {s.flag.pairs > 0 ? (
                <>
                  {" "}
                  — flagged {s.flag.pairs} pair{s.flag.pairs === 1 ? "" : "s"} ·{" "}
                  {fmtM(s.flag.oblM)} awaiting ruling
                </>
              ) : null}
            </p>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["#", "Disposition", "NAICS", "PSC", "PSC description (official)", "Work summary", "Why", "FY23–25 $", "Firms"].map(
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
              <tbody>
                {pairs.map((p) => {
                  const d = disposition(p);
                  const st = DISP_STYLE[d];
                  const overridden = overrides[pairKey(p)] !== undefined;
                  return (
                    <tr key={pairKey(p)} style={{ borderBottom: "1px solid #ddd", background: st.bg }}>
                      <td style={{ ...mono, ...cell, color: "#999", fontSize: 13 }}>{p.rank}</td>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {(["keep", "flag", "strike"] as Disposition[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setDisposition(p, opt)}
                            title={opt === p.proposed ? "proposed" : "override"}
                            style={{
                              padding: "2px 7px",
                              marginRight: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.03em",
                              cursor: "pointer",
                              border: `1px solid ${d === opt ? DISP_STYLE[opt].badge : "#ccc"}`,
                              background: d === opt ? DISP_STYLE[opt].badge : "#fff",
                              color: d === opt ? "#fff" : "#888",
                            }}
                          >
                            {DISP_STYLE[opt].label}
                          </button>
                        ))}
                        {overridden ? (
                          <div style={{ fontSize: 11, color: "#a05a00" }}>
                            overridden (proposed {p.proposed})
                          </div>
                        ) : null}
                      </td>
                      <td style={{ ...cell, maxWidth: 210 }}>
                        <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{p.naics_code}</span>
                        <div style={{ fontSize: 13, color: "#444" }}>{p.naics_title ?? "—"}</div>
                      </td>
                      <td style={{ ...cell, maxWidth: 190 }}>
                        <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{p.psc_code}</span>
                        <div style={{ fontSize: 13, color: "#444" }}>{p.psc_name ?? "—"}</div>
                      </td>
                      <td style={{ ...cell, fontSize: 13, color: "#333", maxWidth: 240 }}>
                        {p.psc_description ?? <span style={{ color: "#bbb" }}>—</span>}
                      </td>
                      <td style={{ ...cell, fontSize: 13, color: "#333", maxWidth: 240 }}>
                        {p.what_was_done ?? <span style={{ color: "#bbb" }}>no summary yet</span>}
                      </td>
                      <td style={{ ...cell, fontSize: 13, color: "#666", maxWidth: 260 }}>{p.reason}</td>
                      <td style={{ ...mono, ...cell, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {fmtM(p.obl_m)}
                      </td>
                      <td style={{ ...mono, ...cell, textAlign: "right", fontSize: 13 }}>
                        {p.firms.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
