/**
 * RecoveryMonthView — one month of the recovery, four DoD lanes as vertical
 * bar pairs: same month a year earlier (muted) vs this month (solid), with a
 * tick line at the lane's normal month (fy25 average). Each lane is scaled
 * independently — the lanes differ 20× in absolute size; the pair + tick
 * carry the comparison. Baked sidecar snapshot, artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./dod-recovery-months.json";

type Lane = { key: string; label: string; sub: string; highlight?: boolean };
type MonthData = {
  label: string;
  priorLabel: string;
  tagline: string;
  current: Record<string, number>;
  prior: Record<string, number>;
};
type Snap = {
  scope: string;
  artifact: string;
  norms: Record<string, number>;
  lanes: Lane[];
  months: Record<string, MonthData>;
};

const SNAP = snapshot as unknown as Snap;

const LANE_H = 210; // px height of the bar area

export function RecoveryMonthView({ monthKey }: { monthKey: string }) {
  const month = SNAP.months[monthKey];
  if (!month) return null;

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-10 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The recovery · {month.label.split(" ")[0]}
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {month.label} — {month.tagline}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            each lane vs {month.priorLabel} · tick = the lane&rsquo;s normal month (fy25 avg) ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="grid grid-cols-4 gap-8">
          {SNAP.lanes.map((lane) => {
            const cur = month.current[lane.key];
            const pri = month.prior[lane.key];
            const norm = SNAP.norms[lane.key];
            const scaleMax = Math.max(cur, pri, norm) * 1.15;
            const h = (v: number) => Math.max((v / scaleMax) * LANE_H, 2);
            const pct = (cur / norm) * 100;
            const strong = lane.highlight === true;
            return (
              <div
                key={lane.key}
                className={
                  strong
                    ? "border border-[color:var(--color-accent-primary)] px-4 pb-4 pt-5"
                    : "border border-[color:var(--color-border-subtle)] px-4 pb-4 pt-5"
                }
              >
                <div className="relative mx-auto flex items-end justify-center gap-3" style={{ height: LANE_H }}>
                  {/* normal-month tick line across the lane */}
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-[color:var(--color-text-muted)]"
                    style={{ bottom: `${(norm / scaleMax) * LANE_H}px`, opacity: 0.6 }}
                  />
                  {/* prior-year bar */}
                  <div className="flex w-1/3 flex-col items-center justify-end" style={{ height: LANE_H }}>
                    <Text as="div" size="mono-xs" mono color="muted" className="mb-1 tabular-nums">
                      ${pri.toFixed(pri < 1 ? 2 : 1)}B
                    </Text>
                    <div
                      className="w-full bg-[color:var(--color-accent-primary)]"
                      style={{ height: `${h(pri)}px`, opacity: 0.22 }}
                    />
                  </div>
                  {/* current bar */}
                  <div className="flex w-1/3 flex-col items-center justify-end" style={{ height: LANE_H }}>
                    <Text
                      as="div"
                      size="mono-xs"
                      mono
                      color={strong ? "accent" : "primary"}
                      className="mb-1 font-semibold tabular-nums"
                    >
                      ${cur.toFixed(cur < 1 ? 2 : 1)}B
                    </Text>
                    <div
                      className="w-full bg-[color:var(--color-accent-primary)]"
                      style={{ height: `${h(cur)}px`, opacity: strong ? 0.9 : 0.65 }}
                    />
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <Text as="div" size="body-sm" color={strong ? "accent" : "primary"} className="font-semibold">
                    {lane.label}
                  </Text>
                  <Text as="div" size="mono-xs" mono color="muted" className="mt-0.5 uppercase">
                    {lane.sub}
                  </Text>
                  <Text
                    as="div"
                    size="mono-xs"
                    mono
                    color={pct < 100 ? (strong ? "accent" : "muted") : "muted"}
                    className="mt-1.5 tabular-nums"
                  >
                    {pct.toFixed(0)}% of a normal month
                  </Text>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-6">
          <Text as="span" size="mono-xs" mono color="muted" className="uppercase tracking-[0.08em]">
            ░ {month.priorLabel}
          </Text>
          <Text as="span" size="mono-xs" mono color="default" className="uppercase tracking-[0.08em]">
            █ {month.label.split(" ")[0]} 2025
          </Text>
          <Text as="span" size="mono-xs" mono color="muted" className="uppercase tracking-[0.08em]">
            ┄ normal month
          </Text>
        </div>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-4 text-center uppercase tracking-[0.12em]">
          lanes scaled independently — sizes differ 20× · oct–dec are lag-clean months
        </Text>
      </div>
    </div>
  );
}
