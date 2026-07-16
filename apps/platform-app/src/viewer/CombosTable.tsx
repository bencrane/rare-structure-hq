/**
 * CombosTable — the internal viewer's ranked combo list for the facilities cut:
 * every active NAICS-56 × PSC-S* combo ordered by active obligated $, with the
 * official NAICS/PSC titles, the combo's work summary (naics_psc_deliverable's
 * what_was_done; some combos have none — shown plainly), active award count and
 * distinct recipients. Same plain legible styling as the rest of the viewer.
 */
import baked from "@/internal/facilities-combos-active.json";

type ComboRow = {
  naics_code: string;
  naics_title: string | null;
  psc_code: string;
  psc_name: string | null;
  what_was_done: string | null;
  active_obl_m: number;
  active_award_ct: number;
  active_recipients: number;
};

const data = baked as unknown as {
  scope: string;
  as_of: string;
  baked_from: string;
  combos: ComboRow[];
};

const fmtM = (m: number): string =>
  m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : m >= 1 ? `$${m.toFixed(1)}M` : "<$1M";

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;

export function CombosTable() {
  const totalM = data.combos.reduce((n, c) => n + c.active_obl_m, 0);
  return (
    <div
      style={{
        padding: "40px 48px",
        fontSize: 15,
        lineHeight: 1.5,
        color: "#1a1a1a",
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
        Active combos — ranked by active $
      </h1>
      <p style={{ color: "#555", margin: "6px 0 24px" }}>
        {data.combos.length} combos · {fmtM(totalM)} active obligated · {data.as_of} · baked from{" "}
        {data.baked_from}
        <br />
        Work summary = naics_psc_deliverable (LLM-generated, disclosed);{" "}
        {data.combos.filter((c) => !c.what_was_done).length} combos have none yet.
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["#", "NAICS", "PSC", "Work summary", "Active $", "Awards", "Firms"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: h === "Active $" || h === "Awards" || h === "Firms" ? "right" : "left",
                  borderBottom: "2px solid #1a1a1a",
                  padding: "8px 10px",
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#555",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.combos.map((c, i) => (
            <tr key={`${c.naics_code}-${c.psc_code}`} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ ...mono, padding: "10px", color: "#999", fontSize: 13 }}>{i + 1}</td>
              <td style={{ padding: "10px", verticalAlign: "top", maxWidth: 260 }}>
                <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{c.naics_code}</span>
                <div style={{ fontSize: 13, color: "#444" }}>{c.naics_title ?? "—"}</div>
              </td>
              <td style={{ padding: "10px", verticalAlign: "top", maxWidth: 240 }}>
                <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{c.psc_code}</span>
                <div style={{ fontSize: 13, color: "#444" }}>{c.psc_name ?? "—"}</div>
              </td>
              <td style={{ padding: "10px", verticalAlign: "top", fontSize: 14, color: "#333" }}>
                {c.what_was_done ?? <span style={{ color: "#bbb" }}>no summary yet</span>}
              </td>
              <td style={{ ...mono, padding: "10px", textAlign: "right", fontWeight: 700 }}>
                {fmtM(c.active_obl_m)}
              </td>
              <td style={{ ...mono, padding: "10px", textAlign: "right", fontSize: 13 }}>
                {c.active_award_ct.toLocaleString()}
              </td>
              <td style={{ ...mono, padding: "10px", textAlign: "right", fontSize: 13 }}>
                {c.active_recipients.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
