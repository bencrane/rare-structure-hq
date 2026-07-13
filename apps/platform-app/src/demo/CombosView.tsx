/**
 * CombosView — the "what the money actually buys" stage card: the top active
 * prime NAICS×PSC combos in EQUIPMENT SCOPE (by open obligations, place-of-
 * performance radius around the anchor), each named in plain language
 * (naics_title × psc_title), with its work_summary, equipment bucket, and the
 * comma-separated iron the combo implies.
 *
 * Data is a baked sidecar+Lance snapshot (same doctrine as the equipment-yard
 * deck): open awards GROUP BY from the sidecar, titles/work_summary joined
 * from naics_psc_labor_dim (Lance), artifact-stamped, vendored for local
 * iteration. When this card is promoted, the query moves behind the broker.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./combos-79925-100.json";

type ComboRow = {
  naics: string;
  psc: string;
  naicsTitle: string;
  pscTitle: string;
  awards: number;
  oblM: number;
  eqBucket: string;
  equipment: string;
  workSummary: string;
};

type Snapshot = {
  anchor: { zip: string; lat: number; lon: number; radius_mi: number } | null;
  artifact: string;
  rows: [string, string, string, string, number, number, string, string, string][];
};

const LOCAL_SNAP = snapshot as unknown as Snapshot;

const toRows = (snap: Snapshot): ComboRow[] =>
  snap.rows.map(
  ([naics, psc, naicsTitle, pscTitle, awards, oblM, eqBucket, equipment, workSummary]) => ({
    naics,
    psc,
    naicsTitle,
    pscTitle,
    awards,
    oblM,
    eqBucket,
    equipment,
    workSummary,
  }),
);

const fmtM = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${m.toFixed(1)}M`);
const bucketLabel = (b: string) => b.replace(/_/g, " ");
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s(/-])[a-z]/g, (c) => c.toUpperCase());

export function CombosView({
  snap = LOCAL_SNAP,
  kicker = "What the money buys",
  title,
  subtitle,
  valueHeader = "open $",
}: {
  snap?: Snapshot;
  kicker?: string;
  title?: string;
  subtitle?: string;
  valueHeader?: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const ROWS = toRows(snap);
  const totalM = ROWS.reduce((s, r) => s + r.oblM, 0);
  const maxM = ROWS[0]?.oblM ?? 1;
  const heading =
    title ??
    `Top ${ROWS.length} active equipment-scope combos · ${snap.anchor?.zip} · ${snap.anchor?.radius_mi} mi`;
  const sub = subtitle ?? "open · prime place-of-performance";

  return (
    <div className="flex h-full flex-col px-10 py-8">
      <div className="mb-4 text-center">
        <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
          {kicker}
        </Text>
        <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
          {heading}
        </Text>
        <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
          {fmtM(totalM)} {sub} · {snap.artifact.split("_").pop()?.replace(".duckdb", "")}
        </Text>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border border-[color:var(--color-border-subtle)]">
        {/* Header row */}
        <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_15rem_minmax(0,1.1fr)_minmax(0,1fr)_9rem_5rem] gap-3 border-[color:var(--color-border-subtle)] border-b bg-[color:var(--color-surface-sunken)] px-4 py-2">
          {["#", "combo", "the work", "equipment it implies", "bucket", valueHeader].map((h, i) => (
            <Text
              key={h}
              as="div"
              size="mono-xs"
              mono
              color="subtle"
              className={`uppercase tracking-[0.12em] ${i === 5 ? "text-right" : ""}`}
            >
              {h}
            </Text>
          ))}
        </div>

        {ROWS.map((r, i) => {
          const key = `${r.naics}-${r.psc}`;
          const isOpen = expanded === key;
          const pct = Math.max((r.oblM / maxM) * 100, 0.75);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setExpanded(isOpen ? null : key)}
              className={`relative grid w-full grid-cols-[2.5rem_15rem_minmax(0,1.1fr)_minmax(0,1fr)_9rem_5rem] items-baseline gap-3 border-[color:var(--color-border-subtle)] border-b px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--color-surface-raised)] ${
                isOpen ? "bg-[color:var(--color-surface-raised)]" : ""
              }`}
            >
              {/* $-scale underlay bar */}
              <div
                className="absolute inset-y-0 left-0 bg-[color:var(--color-accent-soft)] opacity-40"
                style={{ width: `${pct}%` }}
              />
              <Text as="span" size="mono-xs" mono color="subtle" className="relative tabular-nums">
                {i + 1}
              </Text>
              <span className="relative min-w-0">
                <Text as="span" size="body-sm" color="primary" className="block truncate font-semibold">
                  {titleCase(r.naicsTitle)}
                </Text>
                <Text as="span" size="mono-xs" mono color="muted" className="block truncate">
                  {titleCase(r.pscTitle)}
                  <span className="text-[color:var(--color-text-subtle)]">
                    {" "}
                    · {r.naics}×{r.psc} · {r.awards} awd
                  </span>
                </Text>
              </span>
              <Text
                as="span"
                size="body-sm"
                color="primary"
                className={`relative ${isOpen ? "" : "truncate"}`}
              >
                {r.workSummary}
              </Text>
              <Text
                as="span"
                size="body-sm"
                color="muted"
                className={`relative ${isOpen ? "" : "truncate"}`}
              >
                {r.equipment}
              </Text>
              <Text as="span" size="mono-xs" mono color="accent" className="relative uppercase">
                {bucketLabel(r.eqBucket)}
              </Text>
              <Text
                as="span"
                size="body-sm"
                color="primary"
                className="relative text-right font-semibold tabular-nums"
              >
                {fmtM(r.oblM)}
              </Text>
            </button>
          );
        })}
      </div>

      <Text as="div" size="mono-xs" mono color="subtle" className="mt-3 text-center uppercase tracking-[0.12em]">
        equipment scope only · click a row to unclamp work + equipment
      </Text>
    </div>
  );
}
