/**
 * SeptSprintView — the DoD year-end spending sprint: September obligations,
 * four fiscal year-ends as bars, with a line over the top carrying the
 * year-over-year % increase. Ends on the record — the cliff comes on the
 * next card. Baked sidecar snapshot, artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./dod-september-sprint.json";

type YearRow = { label: string; oblB: number };
type Snap = { scope: string; artifact: string; years: YearRow[] };

const SNAP = snapshot as unknown as Snap;

// Chart geometry (SVG viewBox units).
const W = 860;
const H = 420;
const PAD_X = 70;
const PAD_TOP = 70;
const PAD_BOTTOM = 56;

export function SeptSprintView() {
  const years = SNAP.years;
  const maxB = Math.max(...years.map((y) => y.oblB));
  const slot = (W - PAD_X * 2) / years.length;
  const barW = slot * 0.52;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => PAD_X + slot * i + slot / 2;
  const y = (b: number) => H - PAD_BOTTOM - (b / maxB) * plotH;

  const line = years.map((yr, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(yr.oblB) - 14}`).join(" ");

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-6 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The year-end sprint
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            $92.4B out the door in thirty days
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            dod obligations · september of each fiscal year ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="DoD September obligations 2022 through 2025, bars with year-over-year percent increase line"
        >
          {years.map((yr, i) => (
            <g key={yr.label}>
              <rect
                x={x(i) - barW / 2}
                y={y(yr.oblB)}
                width={barW}
                height={H - PAD_BOTTOM - y(yr.oblB)}
                fill="var(--color-accent-primary)"
                fillOpacity={i === years.length - 1 ? 0.85 : 0.35}
              />
              <text
                x={x(i)}
                y={y(yr.oblB) + 22}
                textAnchor="middle"
                fontSize={17}
                fontWeight={650}
                fontFamily="var(--font-display, sans-serif)"
                fill="var(--color-text-primary)"
              >
                ${yr.oblB.toFixed(1)}B
              </text>
              <text
                x={x(i)}
                y={H - PAD_BOTTOM + 26}
                textAnchor="middle"
                fontSize={12}
                fontFamily="var(--font-mono, monospace)"
                fill="var(--color-text-muted)"
                style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {yr.label}
              </text>
            </g>
          ))}

          {/* YoY % line, floating above the bar tops */}
          <path d={line} fill="none" stroke="var(--color-text-primary)" strokeWidth={1.5} strokeDasharray="1 0" />
          {years.map((yr, i) => {
            if (i === 0) return null;
            const pct = ((yr.oblB - years[i - 1].oblB) / years[i - 1].oblB) * 100;
            return (
              <g key={`pct-${yr.label}`}>
                <circle cx={x(i)} cy={y(yr.oblB) - 14} r={3.2} fill="var(--color-text-primary)" />
                <text
                  x={x(i)}
                  y={y(yr.oblB) - 26}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={650}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-text-primary)"
                >
                  +{pct.toFixed(0)}%
                </text>
              </g>
            );
          })}
          <circle cx={x(0)} cy={y(years[0].oblB) - 14} r={3.2} fill="var(--color-text-primary)" />
        </svg>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-6 max-w-2xl text-center">
          The biggest year-end spending sprint in the department&rsquo;s history — every September a
          record, each one bigger than the last.
        </Text>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-6 text-center uppercase tracking-[0.12em]">
          september = final month of the federal fiscal year · use-it-or-lose-it obligations
        </Text>
      </div>
    </div>
  );
}
