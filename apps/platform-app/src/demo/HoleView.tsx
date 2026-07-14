/**
 * HoleView — the killer stat: what the DoD facilities metronome owes. Four
 * months of actual obligations as solid bars inside ghost frames at the
 * lane's normal pace; the empty space between them IS the hole. The work is
 * contractual and recurring — deferred beats accrue as backlog, and the money
 * to pay them has been law since February 3. Baked snapshot, artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./dod-facilities-hole.json";

type MonthRow = { label: string; actualB: number };
type Snap = { scope: string; artifact: string; expectedM: number; months: MonthRow[] };

const SNAP = snapshot as unknown as Snap;

const BAR_AREA_H = 220;

export function HoleView() {
  const exp = SNAP.expectedM;
  const scaleMax = exp * 1.25;
  const h = (b: number) => Math.max((b / scaleMax) * BAR_AREA_H, 2);
  const totalActual = SNAP.months.reduce((s, m) => s + m.actualB, 0);
  const totalExpected = exp * SNAP.months.length;
  const hole = totalExpected - totalActual;

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            What the metronome owes
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            ${hole.toFixed(1)}B of missing beats — in four months
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            dod facilities services · actual vs the lane&rsquo;s fy25 pace ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="flex items-end justify-center gap-10">
          {SNAP.months.map((m) => {
            const gap = exp - m.actualB;
            return (
              <div key={m.label} className="flex w-28 flex-col items-center">
                {/* ghost frame = expected pace; solid fill = actual */}
                <div
                  className="relative flex w-full items-end border border-dashed border-[color:var(--color-text-muted)]"
                  style={{ height: `${h(exp)}px` }}
                >
                  <div
                    className="w-full bg-[color:var(--color-accent-primary)]"
                    style={{ height: `${h(m.actualB)}px`, opacity: 0.8 }}
                  />
                  <Text
                    as="div"
                    size="mono-xs"
                    mono
                    className="absolute left-0 right-0 text-center font-semibold tabular-nums"
                    style={{
                      bottom: `${h(m.actualB) + 6}px`,
                      color: "var(--color-state-error, #e5484d)",
                    }}
                  >
                    −${gap.toFixed(2)}B
                  </Text>
                </div>
                <Text as="div" size="mono-xs" mono color="primary" className="mt-2 font-semibold tabular-nums">
                  ${m.actualB.toFixed(2)}B
                </Text>
                <Text as="div" size="mono-xs" mono color="muted" className="mt-0.5 uppercase">
                  {m.label}
                </Text>
              </div>
            );
          })}
        </div>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-10 max-w-2xl text-center">
          This is standing, contractual work — guards, cleaning, maintenance on signed vehicles. It
          doesn&rsquo;t disappear when it isn&rsquo;t ordered; it accrues. Carried at this rate into
          the months the data can&rsquo;t see yet, the hole is $4–5B and counting — on paper already
          signed, with money that has been law since February 3rd.
        </Text>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-8 text-center uppercase tracking-[0.12em]">
          ghost frame = fy25 monthly pace ($0.84b) — before the lane&rsquo;s +29%/yr trend · solid =
          actual
        </Text>
      </div>
    </div>
  );
}
