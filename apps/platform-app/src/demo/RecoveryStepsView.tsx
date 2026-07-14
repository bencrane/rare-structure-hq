/**
 * RecoveryStepsView — the recovery, month by month: four DoD spending lanes
 * as horizontal bars against each lane's FY25 monthly average (the 100%
 * line). Click steps October → November → December: hardware climbs back
 * first, then engineering and construction clear 100% — facilities never
 * does. Baked sidecar snapshot, artifact-stamped.
 */

import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./dod-recovery-steps.json";

type Lane = { key: string; label: string; sub: string; highlight?: boolean };
type Month = { label: string; tagline: string; values: Record<string, number> };
type Snap = {
  scope: string;
  artifact: string;
  norms: Record<string, number>;
  lanes: Lane[];
  months: Month[];
};

const SNAP = snapshot as unknown as Snap;

// 100% sits at this fraction of the bar track so overshoot months have room.
const FULL_AT = 0.62;
const MAX_PCT = 140;

export function RecoveryStepsView() {
  const [step, setStep] = useState(0);
  const month = SNAP.months[step];

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-6 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The recovery
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {month.label} — {month.tagline}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            dod obligations vs each lane&rsquo;s fy25 monthly average ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          {SNAP.months.map((m, i) => (
            <button
              key={m.label}
              type="button"
              onClick={() => setStep(i)}
              className={`border px-4 py-1.5 font-mono text-mono-xs uppercase tracking-[0.12em] transition-colors ${
                step === i
                  ? "border-[color:var(--color-accent-primary)] text-[color:var(--color-text-accent)]"
                  : "border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-default)]"
              }`}
            >
              {m.label.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          {SNAP.lanes.map((lane) => {
            const val = month.values[lane.key];
            const norm = SNAP.norms[lane.key];
            const pct = (val / norm) * 100;
            const width = Math.min(pct, MAX_PCT) * FULL_AT;
            const under = pct < 100;
            const strong = lane.highlight === true;
            return (
              <div key={lane.key}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <Text as="span" size="body-sm" color={strong ? "accent" : "primary"} className="font-semibold">
                    {lane.label}
                    <Text as="span" size="mono-xs" mono color="muted" className="ml-2 uppercase">
                      {lane.sub}
                    </Text>
                  </Text>
                  <Text
                    as="span"
                    size="body-sm"
                    color={strong && under ? "accent" : "primary"}
                    className="font-semibold tabular-nums"
                  >
                    ${val.toFixed(val < 1 ? 2 : 1)}B · {pct.toFixed(0)}% of a normal month
                  </Text>
                </div>
                <div className="relative h-5 w-full border border-[color:var(--color-border-subtle)]">
                  <div
                    className="h-full bg-[color:var(--color-accent-primary)]"
                    style={{
                      width: `${width}%`,
                      opacity: strong ? 0.9 : 0.4,
                      transition: "width 480ms ease",
                    }}
                  />
                  {/* the 100% line */}
                  <div
                    className="absolute top-0 h-full w-px bg-[color:var(--color-text-primary)]"
                    style={{ left: `${FULL_AT * 100}%`, opacity: 0.7 }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex justify-end" style={{ paddingRight: `${(1 - FULL_AT) * 100 - 4}%` }}>
          <Text as="span" size="mono-xs" mono color="muted" className="uppercase tracking-[0.08em]">
            100% = normal month
          </Text>
        </div>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-6 text-center uppercase tracking-[0.12em]">
          normal = the lane&rsquo;s fy25 monthly average · click the months · oct–dec are lag-clean
        </Text>
      </div>
    </div>
  );
}
