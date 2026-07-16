/**
 * CombosTable — the internal viewer's ranked combo list for the facilities cut:
 * every active NAICS-56 × PSC-S* combo ordered by active obligated $, with the
 * official NAICS/PSC titles, the OFFICIAL PSC description, the combo's work
 * summary (naics_psc_deliverable — LLM-generated, disclosed), active $, median
 * active award $, awards and firms.
 *
 * Market-collection curation: rows are selectable; selections save to named
 * lists (a combo can live in many lists). Lists persist in localStorage under
 * `viewer.combo-lists` — operator-local by design for now; membership shows as
 * a ● badge with the list names beside each row.
 */
import { useEffect, useMemo, useState } from "react";

import baked from "@/internal/facilities-combos-active.json";

type ComboRow = {
  naics_code: string;
  naics_title: string | null;
  psc_code: string;
  psc_name: string | null;
  psc_description: string | null;
  what_was_done: string | null;
  active_obl_m: number;
  median_award_k: number;
  active_award_ct: number;
  active_recipients: number;
};

const data = baked as unknown as {
  scope: string;
  as_of: string;
  baked_from: string;
  combos: ComboRow[];
};

const STORAGE_KEY = "viewer.combo-lists";

type Lists = Record<string, string[]>; // list name -> combo keys "naics|psc"

function loadLists(): Lists {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Lists;
  } catch {
    return {};
  }
}

const comboKey = (c: ComboRow): string => `${c.naics_code}|${c.psc_code}`;

const fmtM = (m: number): string =>
  m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : m >= 1 ? `$${m.toFixed(1)}M` : "<$1M";
const fmtK = (k: number): string =>
  k <= 0 ? "—" : k >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${Math.round(k)}K`;

const mono = { fontFamily: "ui-monospace, Menlo, monospace" } as const;
const cell = { padding: "10px", verticalAlign: "top" as const };

export function CombosTable() {
  const [lists, setLists] = useState<Lists>(loadLists);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [listName, setListName] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  }, [lists]);

  const membership = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [name, keys] of Object.entries(lists)) {
      for (const k of keys) {
        const cur = m.get(k) ?? [];
        cur.push(name);
        m.set(k, cur);
      }
    }
    return m;
  }, [lists]);

  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveSelection = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selected.size === 0) return;
    setLists((prev) => {
      const existing = new Set(prev[trimmed] ?? []);
      for (const k of selected) existing.add(k);
      return { ...prev, [trimmed]: [...existing] };
    });
    setSelected(new Set());
    setListName("");
  };

  const totalM = data.combos.reduce((n, c) => n + c.active_obl_m, 0);
  const listNames = Object.keys(lists).sort();

  return (
    <div style={{ padding: "40px 48px", fontSize: 15, lineHeight: 1.5, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
        Active combos — ranked by active $
      </h1>
      <p style={{ color: "#555", margin: "6px 0 20px" }}>
        {data.combos.length} combos · {fmtM(totalM)} active obligated · {data.as_of} · baked from{" "}
        {data.baked_from}
        <br />
        PSC description = official GSA manual text. Work summary = naics_psc_deliverable
        (LLM-generated, disclosed); {data.combos.filter((c) => !c.what_was_done).length} combos have
        none yet. Median = median life-to-date $ of the combo's active awards.
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
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 14 }}>{selected.size} selected</strong>
        <input
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveSelection(listName);
          }}
          placeholder="list name…"
          style={{
            border: "1px solid #bbb",
            padding: "6px 10px",
            fontSize: 14,
            width: 220,
          }}
        />
        <button
          type="button"
          onClick={() => saveSelection(listName)}
          disabled={selected.size === 0 || !listName.trim()}
          style={{
            padding: "6px 14px",
            border: "1px solid #1a1a1a",
            background: selected.size && listName.trim() ? "#1a1a1a" : "#eee",
            color: selected.size && listName.trim() ? "#fff" : "#999",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save to list
        </button>
        {listNames.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => saveSelection(n)}
            disabled={selected.size === 0}
            title={`Add selection to “${n}” (${lists[n].length} combos)`}
            style={{
              padding: "6px 10px",
              border: "1px solid #bbb",
              background: "#fff",
              color: selected.size ? "#333" : "#aaa",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + {n} ({lists[n].length})
          </button>
        ))}
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {[
              "",
              "#",
              "NAICS",
              "PSC",
              "PSC description (official)",
              "Work summary",
              "Active $",
              "Median award",
              "Awards",
              "Firms",
            ].map((h) => (
              <th
                key={h || "sel"}
                style={{
                  textAlign: ["Active $", "Median award", "Awards", "Firms"].includes(h)
                    ? "right"
                    : "left",
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
          {data.combos.map((c, i) => {
            const key = comboKey(c);
            const inLists = membership.get(key);
            return (
              <tr key={key} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ ...cell, width: 30 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggleRow(key)}
                    aria-label={`select ${c.naics_code} × ${c.psc_code}`}
                  />
                </td>
                <td style={{ ...mono, ...cell, color: "#999", fontSize: 13 }}>{i + 1}</td>
                <td style={{ ...cell, maxWidth: 220 }}>
                  <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{c.naics_code}</span>
                  <div style={{ fontSize: 13, color: "#444" }}>{c.naics_title ?? "—"}</div>
                  {inLists ? (
                    <div style={{ fontSize: 12, color: "#0a7d32" }} title={inLists.join(", ")}>
                      ● {inLists.join(" · ")}
                    </div>
                  ) : null}
                </td>
                <td style={{ ...cell, maxWidth: 200 }}>
                  <span style={{ ...mono, fontWeight: 700, fontSize: 14 }}>{c.psc_code}</span>
                  <div style={{ fontSize: 13, color: "#444" }}>{c.psc_name ?? "—"}</div>
                </td>
                <td style={{ ...cell, fontSize: 13, color: "#333", maxWidth: 260 }}>
                  {c.psc_description ?? <span style={{ color: "#bbb" }}>—</span>}
                </td>
                <td style={{ ...cell, fontSize: 14, color: "#333" }}>
                  {c.what_was_done ?? <span style={{ color: "#bbb" }}>no summary yet</span>}
                </td>
                <td style={{ ...mono, ...cell, textAlign: "right", fontWeight: 700 }}>
                  {fmtM(c.active_obl_m)}
                </td>
                <td style={{ ...mono, ...cell, textAlign: "right", fontSize: 13 }}>
                  {fmtK(c.median_award_k)}
                </td>
                <td style={{ ...mono, ...cell, textAlign: "right", fontSize: 13 }}>
                  {c.active_award_ct.toLocaleString()}
                </td>
                <td style={{ ...mono, ...cell, textAlign: "right", fontSize: 13 }}>
                  {c.active_recipients.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
