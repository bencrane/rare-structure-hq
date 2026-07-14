/**
 * SeptOctCliffView — the cliff: September vs October DoD obligations, four
 * years side by side. Every October is a comedown; October 2025 is half a
 * normal October — the shutdown month after the record sprint. Baked sidecar
 * snapshot, artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./dod-sept-oct-cliff.json";

type YearRow = { label: string; sepB: number; octB: number; highlight?: boolean };
type Snap = { scope: string; artifact: string; years: YearRow[] };

const SNAP = snapshot as unknown as Snap;

const W = 860;
const H = 420;
const PAD_X = 60;
const PAD_TOP = 56;
const PAD_BOTTOM = 56;

export function SeptOctCliffView() {
  const years = SNAP.years;
  const maxB = Math.max(...years.map((y) => y.sepB));
  const slot = (W - PAD_X * 2) / years.length;
  const barW = slot * 0.26;
  const gap = slot * 0.06;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const cx = (i: number) => PAD_X + slot * i + slot / 2;
  const y = (b: number) => H - PAD_BOTTOM - (b / maxB) * plotH;

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-6 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            October 1st
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            Ninety-two billion in September. Thirteen in October.
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            dod obligations · september vs october, each fiscal year-end ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="DoD September versus October obligations, 2022 through 2025 — October 2025 collapses to $13.3B under the shutdown"
        >
          {years.map((yr, i) => {
            const sepX = cx(i) - gap / 2 - barW;
            const octX = cx(i) + gap / 2;
            const drop = ((yr.octB - yr.sepB) / yr.sepB) * 100;
            return (
              <g key={yr.label}>
                {/* September bar */}
                <rect
                  x={sepX}
                  y={y(yr.sepB)}
                  width={barW}
                  height={H - PAD_BOTTOM - y(yr.sepB)}
                  fill="var(--color-accent-primary)"
                  fillOpacity={0.35}
                />
                <text
                  x={sepX + barW / 2}
                  y={y(yr.sepB) - 8}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-text-muted)"
                >
                  ${yr.sepB.toFixed(0)}B
                </text>

                {/* October bar */}
                <rect
                  x={octX}
                  y={y(yr.octB)}
                  width={barW}
                  height={H - PAD_BOTTOM - y(yr.octB)}
                  fill={yr.highlight ? "var(--color-state-error, #e5484d)" : "var(--color-accent-primary)"}
                  fillOpacity={yr.highlight ? 0.9 : 0.75}
                />
                <text
                  x={octX + barW / 2}
                  y={y(yr.octB) - 8}
                  textAnchor="middle"
                  fontSize={yr.highlight ? 15 : 13}
                  fontWeight={650}
                  fontFamily="var(--font-mono, monospace)"
                  fill={yr.highlight ? "var(--color-state-error, #e5484d)" : "var(--color-text-primary)"}
                >
                  ${yr.octB.toFixed(0)}B
                </text>

                {/* Drop marker on the highlighted year */}
                {yr.highlight ? (
                  <text
                    x={octX + barW / 2}
                    y={y(yr.octB) - 28}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={700}
                    fontFamily="var(--font-mono, monospace)"
                    fill="var(--color-state-error, #e5484d)"
                  >
                    {drop.toFixed(0)}%
                  </text>
                ) : null}

                <text
                  x={cx(i)}
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
            );
          })}
        </svg>

        <div className="mx-auto mt-2 flex items-center justify-center gap-6">
          <Text as="span" size="mono-xs" mono color="muted" className="uppercase tracking-[0.08em]">
            ░ september
          </Text>
          <Text as="span" size="mono-xs" mono color="default" className="uppercase tracking-[0.08em]">
            █ october
          </Text>
        </div>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-5 max-w-2xl text-center">
          Every October is a comedown — a normal one runs $23–29B. October 2025: the government shut
          down at midnight on the 1st, and half of even that didn&rsquo;t happen.
        </Text>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-6 text-center uppercase tracking-[0.12em]">
          appropriations lapsed 2025-10-01 · shutdown ran to mid-november · then a capped cr
        </Text>
      </div>
    </div>
  );
}
