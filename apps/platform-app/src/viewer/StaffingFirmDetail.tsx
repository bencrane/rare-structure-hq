/**
 * StaffingFirmDetail — one staffing firm's market composition, lead-magnet
 * register. Built ENTIRELY from what the firm says it does (website research →
 * normalized roles/geo/placement) composed against the federal award record —
 * never from the firm's own SAM history.
 */
import baked from "@/internal/staffing-market.json";

type Detail = {
  say: Record<string, string>;
  socs: [string, string][];
  majors: string[];
  states: string[];
  national: boolean;
  placement: string[];
  fam: [string, string, number][];
  geo: [string, number][];
  cells: [string, string, string, number, number, number, string][];
  lab: number;
  lab_in: number;
};

const DETAILS = (baked as unknown as { details: Record<string, Detail> }).details;

const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v / 1e3)}K`;
};

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;
const INK = "#1a2233";
const HUES = [
  "#1a2233",
  "#31415e",
  "#4a5d85",
  "#6b7ea6",
  "#93a2c2",
  "#bcc6da",
  "#dde2ec",
  "#eef0f6",
];

/** Single-hue donut over labor-$ shares (the brief-page idiom, plain-light). */
function Donut({ parts, total }: { parts: [string, string, number][]; total: number }) {
  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg
      width={200}
      height={200}
      viewBox="0 0 200 200"
      role="img"
      aria-label="labor dollars by industry family"
    >
      <circle cx={100} cy={100} r={R} fill="none" stroke="#eee" strokeWidth={34} />
      {parts.map(([code], i) => {
        const v = parts[i][2];
        const frac = total > 0 ? v / total : 0;
        const dash = frac * C;
        const el = (
          <circle
            key={code}
            cx={100}
            cy={100}
            r={R}
            fill="none"
            stroke={HUES[i % HUES.length]}
            strokeWidth={34}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-acc * C + C / 4}
          />
        );
        acc += frac;
        return el;
      })}
      <text
        x={100}
        y={95}
        textAnchor="middle"
        style={{ ...mono, fontSize: 20, fontWeight: 700, fill: INK }}
      >
        {fmt$(total)}
      </text>
      <text
        x={100}
        y={114}
        textAnchor="middle"
        style={{ fontSize: 10, fill: "#777", textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        labor $ reach
      </text>
    </svg>
  );
}

function Bar({ frac, color = INK }: { frac: number; color?: string }) {
  return (
    <div style={{ background: "#eee", height: 8, width: "100%" }}>
      <div
        style={{ background: color, height: 8, width: `${Math.max(1, Math.round(frac * 100))}%` }}
      />
    </div>
  );
}

const SAY_LABELS: [string, string][] = [
  ["rolesPlaced", "Roles they place"],
  ["workCategories", "Work categories"],
  ["geographiesServed", "Geographies served"],
  ["placementModel", "Placement model"],
  ["clearanceAndFederalIntent", "Clearance / federal posture"],
];

export function StaffingFirmDetail({
  uei,
  name,
  band,
  domain,
  industries,
  collections,
  share,
  collectionView,
  review,
  onBack,
}: {
  uei: string;
  name: string;
  band: string;
  domain: string;
  industries: string[];
  collections: string[];
  share: number | null;
  collectionView: number;
  review: boolean;
  onBack: () => void;
}) {
  const d = DETAILS[uei];
  if (!d) return <p style={{ padding: 40 }}>No detail payload for {uei}.</p>;
  const famTotal = d.fam.reduce((n, f) => n + f[2], 0);
  const geoMax = d.geo.length ? d.geo[0][1] : 0;
  const cellMax = d.cells.length ? d.cells[0][4] : 0;

  return (
    <div
      style={{
        padding: "36px 48px",
        fontSize: 15,
        lineHeight: 1.5,
        color: "#1a1a1a",
        maxWidth: 1180,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          border: "1px solid #bbb",
          background: "#fff",
          padding: "5px 12px",
          fontSize: 13,
          cursor: "pointer",
          marginBottom: 18,
        }}
      >
        ← All firms
      </button>

      <div style={{ borderTop: `3px solid ${INK}`, paddingTop: 14, marginBottom: 6 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
          {name}
          {review && (
            <span style={{ color: "#c0392b", fontSize: 13, fontWeight: 700, marginLeft: 10 }}>
              REVIEW
            </span>
          )}
        </h1>
        <div style={{ ...mono, fontSize: 12, color: "#888", marginTop: 2 }}>
          {uei}
          {domain ? ` · ${domain}` : ""} · {band} employees ·{" "}
          {d.national
            ? "national coverage"
            : `${d.states.length} state${d.states.length === 1 ? "" : "s"}: ${d.states.join(" ")}`}
          {d.placement.length > 0 && ` · ${d.placement.join(" / ")}`}
        </div>
        <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
          {industries.join(", ")} → {collections.join(", ") || "—"}
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: "#888", maxWidth: 860, margin: "8px 0 24px" }}>
        Composed from the firm&apos;s own declared roles and geography (website research),
        normalized to SOC occupations and states, then read against the ACTIVE federal book
        (currently-running, non-terminated awards at committed value) — implied-labor dollars via
        the SUSB/ECEC labor share. Not derived from this firm&apos;s SAM award history.
      </p>

      <div style={{ display: "flex", gap: 48, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* composition donut + legend */}
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Donut parts={d.fam} total={famTotal} />
          <div>
            {d.fam.map(([code, title, v], i) => (
              <div
                key={code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: HUES[i % HUES.length],
                    display: "inline-block",
                  }}
                />
                <span style={{ ...mono }}>{code}</span>
                <span
                  style={{
                    color: "#555",
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </span>
                <span style={{ ...mono, fontWeight: 700 }}>{fmt$(v)}</span>
                <span style={{ color: "#999" }}>
                  {famTotal > 0 ? Math.round((100 * v) / famTotal) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* headline figures */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, auto)", gap: "14px 36px" }}>
          {(
            [
              ["SOC-derived labor $", fmt$(d.lab)],
              ["Collection-view $", collectionView > 0 ? fmt$(collectionView) : "—"],
              ["In-vertical share", share === null ? "—" : `${Math.round(share * 100)}%`],
              ["In-vertical labor $", fmt$(d.lab_in)],
              ["Occupations matched", String(d.socs.length)],
              ["Qualified cells shown", `${d.cells.length} top`],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#777",
                }}
              >
                {label}
              </div>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* what they say — the source of truth for this page */}
      <div
        style={{
          marginTop: 28,
          border: "1px solid #ddd",
          background: "#fafafa",
          padding: "14px 18px",
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#777",
            marginBottom: 8,
          }}
        >
          What they say they do (verbatim, {d.say.confidence || "?"} confidence research)
        </div>
        {SAY_LABELS.map(([k, label]) =>
          d.say[k] ? (
            <div key={k} style={{ fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "#777" }}>{label}: </span>
              {d.say[k]}
            </div>
          ) : null,
        )}
        {d.socs.length > 0 && (
          <div style={{ fontSize: 12.5, marginTop: 8, color: "#555" }}>
            <span style={{ color: "#777" }}>→ normalized occupations: </span>
            {d.socs.map(([c, t]) => `${t || c}`).join(" · ")}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 48, flexWrap: "wrap", marginTop: 28 }}>
        {/* geo distribution */}
        <div style={{ minWidth: 280 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#777",
              marginBottom: 8,
            }}
          >
            Labor $ by place of performance
          </div>
          {d.geo.map(([st, v]) => (
            <div
              key={st}
              style={{
                display: "grid",
                gridTemplateColumns: "34px 1fr 70px",
                gap: 8,
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span style={{ ...mono, fontSize: 12 }}>{st}</span>
              <Bar frac={geoMax > 0 ? v / geoMax : 0} />
              <span style={{ ...mono, fontSize: 12, textAlign: "right" }}>{fmt$(v)}</span>
            </div>
          ))}
        </div>

        {/* top cells with plain language */}
        <div style={{ flex: 1, minWidth: 480 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#777",
              marginBottom: 8,
            }}
          >
            Largest qualified market cells (combo × state)
          </div>
          {d.cells.map(([n, p, st, award, labor, primes, summary]) => (
            <div key={`${n}${p}${st}`} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 30px 1fr 80px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ ...mono, fontSize: 12.5 }}>
                  {n}×{p}
                </span>
                <span style={{ ...mono, fontSize: 12.5 }}>{st}</span>
                <Bar frac={cellMax > 0 ? labor / cellMax : 0} color="#4a5d85" />
                <span style={{ ...mono, fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>
                  {fmt$(labor)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#666", marginLeft: 0 }}>
                {summary || "—"}{" "}
                <span style={{ color: "#999" }}>
                  · {fmt$(award)} awarded · {primes} active prime{primes === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
