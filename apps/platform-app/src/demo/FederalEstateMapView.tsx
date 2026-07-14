/**
 * FederalEstateMapView — the map, circled back to. Loads as the bare US
 * frame; step 1 lights the civilian federal estate (GSA buildings, tiny blue
 * dots); step 2 ignites the military bases in orange. The reveal that the
 * "customer" is 300,000 buildings — and 824 of them are places most people
 * have never set foot. Baked from federal_sites, artifact-stamped.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

import snapshot from "./federal-sites-dots.json";

type Snap = {
  scope: string;
  artifact: string;
  buildingsCount: number;
  basesCount: number;
  buildings: [number, number][];
  bases: [number, number][];
};

const SNAP = snapshot as unknown as Snap;

const STEPS = [
  { key: "frame", label: "the map", title: "The customer, one more time" },
  { key: "buildings", label: "federal buildings", title: "The civilian estate — everywhere" },
  { key: "bases", label: "military bases", title: "— and 824 places you've never been" },
];

export function FederalEstateMapView() {
  const [step, setStep] = useState(0);

  const project = (pts: [number, number][]) =>
    pts
      .map(([lon, lat]) => projectLonLat(lon, lat))
      .filter((p): p is { x: number; y: number } => p != null);

  const buildingPts = project(SNAP.buildings);
  const basePts = project(SNAP.bases);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-4 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The estate
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {STEPS[step].title}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            gsa buildings & leases + military installations · federal_sites ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="mb-3 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={`border px-4 py-1.5 font-mono text-mono-xs uppercase tracking-[0.12em] transition-colors ${
                step === i
                  ? "border-[color:var(--color-accent-primary)] text-[color:var(--color-text-accent)]"
                  : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-default)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <svg
          viewBox="0 0 1000 590"
          className="w-full"
          role="img"
          aria-label="US map revealing the civilian federal building estate, then military bases"
        >
          {STATE_PATHS.map((s) => (
            <path
              key={s.id}
              d={s.d}
              fill="var(--color-surface-sunken)"
              stroke="var(--color-border-subtle)"
              strokeWidth={0.7}
              strokeLinejoin="round"
            />
          ))}

          {/* civilian estate — tiny blue dots */}
          <g style={{ opacity: step >= 1 ? 1 : 0, transition: "opacity 700ms ease" }}>
            {buildingPts.map((p, i) => (
              <circle
                key={`b-${i}`}
                cx={p.x}
                cy={p.y}
                r={1.1}
                fill="var(--color-accent-primary)"
                fillOpacity={0.7}
              />
            ))}
          </g>

          {/* military bases — small orange dots */}
          <g style={{ opacity: step >= 2 ? 1 : 0, transition: "opacity 700ms ease" }}>
            {basePts.map((p, i) => (
              <circle key={`m-${i}`} cx={p.x} cy={p.y} r={1.0} fill="#e8883a" fillOpacity={0.75} />
            ))}
          </g>
        </svg>

        <div className="mt-3 flex items-center justify-center gap-8">
          <Text
            as="span"
            size="mono-xs"
            mono
            color={step >= 1 ? "default" : "subtle"}
            className="uppercase tracking-[0.08em] tabular-nums"
          >
            ● {SNAP.buildingsCount.toLocaleString()} gsa buildings & leases
          </Text>
          <Text
            as="span"
            size="mono-xs"
            mono
            className="uppercase tracking-[0.08em] tabular-nums"
            style={{ color: step >= 2 ? "#e8883a" : "var(--color-text-subtle)" }}
          >
            ● {SNAP.basesCount} military installations
          </Text>
        </div>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-4 text-center uppercase tracking-[0.12em]">
          civilian layer shows the gsa estate · the full federal inventory runs ~300,000 assets
        </Text>
      </div>
    </div>
  );
}
