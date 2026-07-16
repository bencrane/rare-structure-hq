/**
 * Viewer — the internal data-viewer shell, with its OWN sidebar (deliberately
 * outside AppShell and off the app design system; plain light legible styling
 * per operator directive 2026-07-16).
 *
 * Sidebar tabs = the datasets over the facilities-services cut (NAICS 56 ×
 * PSC S*): the narrative's 3-year pre-OBBBA window (labeled by its years) and
 * the current active-awards book. Both render the same CodeReference body.
 */
import { useState } from "react";

import activeBaked from "@/internal/facilities-codes-active.json";
import windowBaked from "@/internal/facilities-codes.json";
import { type CodeDataset, CodeReference } from "@/viewer/CodeReference";
import { CombosTable } from "@/viewer/CombosTable";
import { AdsPairs } from "@/viewer/AdsPairs";
import { BucketExplorer } from "@/viewer/BucketExplorer";
import { MedStaffPairs } from "@/viewer/MedStaffPairs";
import { ConstructionPairs } from "@/viewer/ConstructionPairs";
import { PairAssignment } from "@/viewer/PairAssignment";
import { PairCuration } from "@/viewer/PairCuration";
import { WasteEnvPairs } from "@/viewer/WasteEnvPairs";

const TABS: { key: string; label: string; sub: string; body: () => React.ReactNode }[] = [
  {
    key: "window",
    label: "2022 – 2025",
    sub: "3 yrs pre-OBBBA obligations",
    body: () => <CodeReference data={windowBaked as unknown as CodeDataset} />,
  },
  {
    key: "active",
    label: "Active Awards",
    sub: "current active book",
    body: () => <CodeReference data={activeBaked as unknown as CodeDataset} />,
  },
  {
    key: "combos",
    label: "Active Combos",
    sub: "ranked, titles + work summary",
    body: () => <CombosTable />,
  },
  {
    key: "pair-curation",
    label: "Pair Curation",
    sub: "collection combos · keep/strike",
    body: () => <PairCuration />,
  },
  {
    key: "pair-assignment",
    label: "Pair Assignment",
    sub: "one category per pair · nothing dropped",
    body: () => <PairAssignment />,
  },
  {
    key: "bucket-explorer",
    label: "Bucket Explorer",
    sub: "pick buckets + won band · live table",
    body: () => <BucketExplorer />,
  },
  {
    key: "construction-pairs",
    label: "Construction Pairs",
    sub: "equipment-heavy construction · in/out",
    body: () => <ConstructionPairs />,
  },
  {
    key: "waste-env-pairs",
    label: "Waste & Env Pairs",
    sub: "two buckets · judged dispositions",
    body: () => <WasteEnvPairs />,
  },
  {
    key: "ads-pairs",
    label: "Aero·Def·Space Pairs",
    sub: "hardware verticals · in/out",
    body: () => <AdsPairs />,
  },
  {
    key: "medstaff-pairs",
    label: "Medical Staffing Pairs",
    sub: "clinicians into gov settings · judged",
    body: () => <MedStaffPairs />,
  },
];

export default function Viewer() {
  const [tab, setTab] = useState(TABS[0].key);
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        minHeight: "100vh",
        background: "#fff",
        color: "#1a1a1a",
        fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      <nav
        style={{
          borderRight: "1px solid #ddd",
          padding: "40px 0",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div
          style={{
            padding: "0 20px 20px",
            fontWeight: 700,
            fontSize: 15,
            color: "#555",
          }}
        >
          Facilities cut
          <div style={{ fontWeight: 400, fontSize: 12, color: "#999" }}>NAICS 56 × PSC S*</div>
        </div>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 20px",
              border: 0,
              borderLeft: `3px solid ${tab === t.key ? "#1a1a1a" : "transparent"}`,
              background: tab === t.key ? "#f2f2f2" : "transparent",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: tab === t.key ? 700 : 500,
              color: "#1a1a1a",
            }}
          >
            {t.label}
            <div style={{ fontSize: 12, fontWeight: 400, color: "#888" }}>{t.sub}</div>
          </button>
        ))}
      </nav>
      <main style={{ minWidth: 0 }}>
        <div key={current.key}>{current.body()}</div>
      </main>
    </div>
  );
}
