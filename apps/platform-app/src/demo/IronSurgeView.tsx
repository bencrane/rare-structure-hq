/**
 * IronSurgeView — the twelve months since the signature, whole construction
 * sector, each month drawn against the same month's three-year average
 * (dashed tick). Where the solid bar clears the tick, that's the wave —
 * December 2.8×, March 2.9×. Two dips are the shutdown (Oct) and the DoD
 * publication dark zone (Feb+). Baked snapshot, artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./iron-surge-months.json";

type MonthRow = { label: string; actualB: number; avgB: number };
type Snap = { scope: string; artifact: string; months: MonthRow[] };

const SNAP = snapshot as unknown as Snap;

const BAR_AREA_H = 230;

export function IronSurgeView() {
  const scaleMax = Math.max(...SNAP.months.map((m) => Math.max(m.actualB, m.avgB))) * 1.12;
  const h = (b: number) => Math.max((b / scaleMax) * BAR_AREA_H, 2);
  const totalActual = SNAP.months.reduce((s, m) => s + m.actualB, 0);
  const totalAvg = SNAP.months.reduce((s, m) => s + m.avgB, 0);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The year since
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            +{Math.round(((totalActual - totalAvg) / totalAvg) * 100)}% — ${Math.round(totalActual)}B against a ${Math.round(totalAvg)}B pace
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            all federal construction · each month vs its own 3-year average ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="flex items-end justify-center gap-2.5">
          {SNAP.months.map((m) => {
            const mult = m.actualB / m.avgB;
            const hot = mult >= 1.5;
            const baseH = h(Math.min(m.actualB, m.avgB));
            const overH = m.actualB > m.avgB ? h(m.actualB) - h(m.avgB) : 0;
            return (
              <div key={m.label} className="flex flex-1 flex-col items-center">
                <div className="relative flex w-full items-end justify-center" style={{ height: BAR_AREA_H }}>
                  {/* multiplier rides the bar top */}
                  {hot ? (
                    <Text
                      as="div"
                      size="mono-xs"
                      mono
                      className="absolute left-0 right-0 text-center font-semibold tabular-nums"
                      style={{ bottom: `${h(m.actualB) + 6}px`, color: "#e8883a" }}
                    >
                      {mult.toFixed(1)}×
                    </Text>
                  ) : null}
                  <div className="flex w-full flex-col justify-end" style={{ height: BAR_AREA_H }}>
                    {/* overflow above the 3-yr average — the wave itself */}
                    {overH > 0 ? (
                      <div
                        className="w-full"
                        style={{ height: `${overH}px`, background: "#e8883a", opacity: 0.95 }}
                      />
                    ) : null}
                    {/* the historical-norm portion */}
                    <div
                      className="w-full bg-[color:var(--color-accent-primary)]"
                      style={{ height: `${baseH}px`, opacity: 0.28 }}
                    />
                  </div>
                </div>
                <Text as="div" size="mono-xs" mono color={hot ? "primary" : "muted"} className="mt-1 font-semibold tabular-nums">
                  {m.actualB.toFixed(1)}
                </Text>
                <Text as="div" size="mono-xs" mono color="muted" className="mt-0.5 uppercase">
                  {m.label}
                </Text>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-6">
          <Text as="span" size="mono-xs" mono color="muted" className="uppercase tracking-[0.08em]">
            ░ a normal month (3-yr avg)
          </Text>
          <Text as="span" size="mono-xs" mono className="uppercase tracking-[0.08em]" style={{ color: "#e8883a" }}>
            █ above normal — the wave
          </Text>
        </div>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-8 max-w-2xl text-center">
          Nine of twelve months above their own three-year norm — December near-triple, March
          near-triple — and the two soft months are the shutdown and unreported DoD paper, not
          demand.
        </Text>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-6 text-center uppercase tracking-[0.12em]">
          bar labels in $B · trailing months still filling
        </Text>
      </div>
    </div>
  );
}
