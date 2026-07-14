/**
 * BoringYearView — one calendar year of the facilities-services lane, twelve
 * vertical monthly bars. The point IS the boredom: every month between $0.8B
 * and $1.9B, no drama, buildings get cleaned. Reused per year; the 2025 card
 * stops just before the cliff. Baked sidecar snapshot, artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./scode-boring-years.json";

type MonthRow = { label: string; oblB: number | null; highlight?: boolean };
type Year = { label: string; totalB: number; months: MonthRow[] };
type Snap = { scope: string; artifact: string; years: Record<string, Year> };

const SNAP = snapshot as unknown as Snap;

const BAR_AREA_H = 230;
// Shared y-scale across all year cards so 2023/2024/2025 are comparable at a glance.
const SCALE_MAX_B = 2.5;

export function BoringYearView({
  yearKey,
  kicker = "The most boring market in America",
  title,
  statement,
}: {
  yearKey: string;
  kicker?: string;
  title?: string;
  statement?: string;
}) {
  const year = SNAP.years[yearKey];
  if (!year) return null;

  const h = (b: number) => Math.max((b / SCALE_MAX_B) * BAR_AREA_H, 2);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            {kicker}
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {title ?? `${year.label} — a billion a month, every month`}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            facility services (psc s-codes) · all agencies · ${year.totalB}B in {year.label} ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="flex items-end justify-center gap-3">
          {year.months.map((m, i) => {
            const prev = i > 0 ? year.months[i - 1].oblB : null;
            const dropPct =
              m.highlight && m.oblB != null && prev != null ? ((m.oblB - prev) / prev) * 100 : null;
            return (
              <div key={m.label} className="flex flex-1 flex-col items-center">
                {dropPct != null ? (
                  <Text
                    as="div"
                    size="mono-xs"
                    mono
                    className="mb-1 font-semibold tabular-nums"
                    style={{ color: "var(--color-state-error, #e5484d)" }}
                  >
                    ↓{Math.abs(dropPct).toFixed(0)}%
                  </Text>
                ) : null}
                <Text
                  as="div"
                  size="mono-xs"
                  mono
                  color={m.highlight ? undefined : "muted"}
                  className="mb-1 tabular-nums"
                  style={m.highlight ? { color: "var(--color-state-error, #e5484d)" } : undefined}
                >
                  {m.oblB != null ? m.oblB.toFixed(1) : "\u00a0"}
                </Text>
                {m.oblB != null ? (
                  <div
                    className="w-full"
                    style={{
                      height: `${h(m.oblB)}px`,
                      background: m.highlight
                        ? "var(--color-state-error, #e5484d)"
                        : "var(--color-accent-primary)",
                      opacity: m.highlight ? 0.9 : 0.6,
                    }}
                  />
                ) : (
                  <div className="w-full" style={{ height: "2px" }} />
                )}
                <Text as="div" size="mono-xs" mono color="muted" className="mt-1.5 uppercase">
                  {m.label}
                </Text>
              </div>
            );
          })}
        </div>

        {statement ? (
          <Text as="div" size="body-md" color="primary" className="mx-auto mt-10 max-w-2xl text-center">
            {statement}
          </Text>
        ) : null}

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-8 text-center uppercase tracking-[0.12em]">
          bar labels in $B · same y-scale across the year cards
        </Text>
      </div>
    </div>
  );
}
