/**
 * WaveView — the legislative timeline overlaid on the obligation curve: DHS ×
 * horizontal-construction monthly obligations (the border lane), with the
 * H.R.1 milestones pinned on the same axis. The card's single point: the law
 * passed, and the money started moving — on schedule, still climbing.
 *
 * Data is a baked sidecar snapshot (gtm_txn_events_slim, agency 070, the
 * horizontal-construction NAICS set), artifact-stamped. Events are public
 * record.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./wave-obbba.json";

type Wave = {
  artifact: string;
  lane: string;
  events: { date: string; label: string }[];
  months: { m: string; oblM: number; actions: number }[];
};

const DEFAULT_SNAP = snapshot as unknown as Wave;
export type WaveSnap = Wave;

const W = 960;
const H = 380;
const PAD = { l: 56, r: 16, t: 68, b: 40 };

const fmtB = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${Math.round(m)}M`);

export function WaveView({
  snap = DEFAULT_SNAP,
  kicker = "The wave",
  title = "Signed July 4 — obligating ever since",
  footer = "last bar partial (snapshot mid-month) · obligations = signed commitments, cash follows as work performs",
}: {
  snap?: Wave;
  kicker?: string;
  title?: string;
  footer?: string;
}) {
  const SNAP = snap;
  const months = SNAP.months;
  const maxV = Math.max(...months.map((d) => d.oblM));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const band = innerW / months.length;
  const x = (i: number) => PAD.l + i * band;
  const y = (v: number) => PAD.t + innerH * (1 - v / maxV);

  // Pin an event to its month's x position (events fall inside the month grid).
  const eventX = (date: string) => {
    const key = date.slice(0, 7);
    const i = months.findIndex((d) => d.m === key);
    if (i < 0) return null;
    const frac = (Number(date.slice(8, 10)) - 1) / 30;
    return x(i) + band * frac;
  };

  const lastIdx = months.length - 1;

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-4 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            {kicker}
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {title}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            monthly obligations · {SNAP.lane} ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly border-lane obligations with legislative milestones">
          {/* gridlines */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(maxV * f)}
                y2={y(maxV * f)}
                stroke="var(--color-border-subtle)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 8}
                y={y(maxV * f) + 3}
                textAnchor="end"
                fontSize={10}
                fontFamily="var(--font-mono, monospace)"
                fill="var(--color-text-subtle)"
              >
                {fmtB(maxV * f)}
              </text>
            </g>
          ))}

          {/* bars */}
          {months.map((d, i) => (
            <g key={d.m}>
              <rect
                x={x(i) + band * 0.14}
                width={band * 0.72}
                y={y(d.oblM)}
                height={PAD.t + innerH - y(d.oblM)}
                fill="var(--color-accent-primary)"
                opacity={i === lastIdx ? 0.55 : 0.9}
              />
              {i % Math.ceil(months.length / 18) === 0 && (
                <text
                  x={x(i) + band / 2}
                  y={H - PAD.b + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-text-subtle)"
                >
                  {d.m.slice(2).replace("-", "·")}
                </text>
              )}
              {d.oblM > maxV * 0.3 && months.length <= 24 && (
                <text
                  x={x(i) + band / 2}
                  y={y(d.oblM) - 5}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-text-muted)"
                >
                  {fmtB(d.oblM)}
                </text>
              )}
            </g>
          ))}

          {/* legislative event pins */}
          {SNAP.events.map((e, k) => {
            const ex = eventX(e.date);
            if (ex == null) return null;
            const ty = 14 + (k % 2) * 13;
            return (
              <g key={e.date}>
                <line
                  x1={ex}
                  x2={ex}
                  y1={ty + 4}
                  y2={PAD.t + innerH}
                  stroke="var(--color-text-primary)"
                  strokeWidth={1}
                  strokeDasharray="3 2.5"
                  opacity={0.55}
                />
                <text
                  x={ex + 4}
                  y={ty}
                  fontSize={9.5}
                  fontFamily="var(--font-mono, monospace)"
                  fill="var(--color-text-primary)"
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {e.date.slice(5).replace("-", "/")} {e.label}
                </text>
              </g>
            );
          })}
        </svg>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-3 text-center uppercase tracking-[0.12em]">
          {footer}
        </Text>
      </div>
    </div>
  );
}
