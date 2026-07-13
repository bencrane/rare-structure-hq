/**
 * FreezeView — the tee-up card: monthly S-code obligations split DoD vs
 * civilian. Civilian ticks along (the annuity); the DoD half decays through
 * the shutdown/CR and flatlines to ZERO in the latest quarter. The work
 * didn't disappear — 300K facilities still need cleaning and guarding — its
 * funding channel jammed. Jams clear. That's the avalanche this card tees.
 *
 * Baked sidecar snapshot (gtm_txn_events_slim · PSC S% · agency 097 vs rest),
 * artifact-stamped. Event pins are public record.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./freeze-scode.json";

type Snap = {
  artifact: string;
  lane: string;
  events: { date: string; label: string }[];
  months: { m: string; dodM: number; civM: number }[];
};

const DEFAULT_SNAP = snapshot as unknown as Snap;
export type CoilSnap = Snap;

const W = 960;
const H = 380;
const PAD = { l: 56, r: 16, t: 64, b: 56 };

const fmtB = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${Math.round(m)}M`);

export function FreezeView({
  snap = DEFAULT_SNAP,
  kicker = "The coiled spring",
  title = "Half this market is frozen — not gone",
  statement = "DoD ran −36% through the shutdown/CR fall, then −85% and −98% YoY in Feb–Mar — AFTER the full-year $838.7B was enacted. The facilities still exist and still get dirty: the work is deferred, funded, and queued — the release surfaces as reporting catches up.",
}: {
  snap?: Snap;
  kicker?: string;
  title?: string;
  statement?: string;
}) {
  const SNAP = snap;
  const months = SNAP.months;
  const maxV = Math.max(...months.map((d) => Math.max(d.dodM, d.civM)));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const band = innerW / months.length;
  const x = (i: number) => PAD.l + i * band;
  const y = (v: number) => PAD.t + innerH * (1 - v / maxV);

  const eventX = (date: string) => {
    const i = months.findIndex((d) => d.m === date.slice(0, 7));
    if (i < 0) return null;
    return x(i) + band * ((Number(date.slice(8, 10)) - 1) / 30);
  };

  // Trailing DoD-zero months: inside DoD's ~90-day FPDS reporting delay —
  // structurally dark in any snapshot, not evidence of absence.
  let lagFrom = months.length;
  for (let i = months.length - 1; i >= 0 && months[i].dodM <= 0; i--) lagFrom = i;

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
            {SNAP.lane} · {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly S-code obligations, DoD versus civilian">
          {[0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(maxV * f)} y2={y(maxV * f)} stroke="var(--color-border-subtle)" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(maxV * f) + 3} textAnchor="end" fontSize={10} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-subtle)">
                {fmtB(maxV * f)}
              </text>
            </g>
          ))}

          {/* reporting-lag shading */}
          {lagFrom < months.length && (
            <rect
              x={x(lagFrom)}
              width={innerW - (x(lagFrom) - PAD.l)}
              y={PAD.t}
              height={innerH}
              fill="var(--color-accent-soft)"
              opacity={0.35}
            />
          )}

          {/* paired bars: civilian gray, DoD accent */}
          {months.map((d, i) => (
            <g key={d.m}>
              <rect x={x(i) + band * 0.12} width={band * 0.34} y={y(d.civM)} height={PAD.t + innerH - y(d.civM)} fill="var(--color-text-subtle)" opacity={0.8} />
              <rect x={x(i) + band * 0.52} width={band * 0.34} y={y(d.dodM)} height={PAD.t + innerH - y(d.dodM)} fill="var(--color-accent-primary)" />
              <text x={x(i) + band / 2} y={H - PAD.b + 16} textAnchor="middle" fontSize={8.5} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-subtle)">
                {d.m.slice(2).replace("-", "·")}
              </text>
            </g>
          ))}

          {/* event pins */}
          {SNAP.events.map((e, k) => {
            const ex = eventX(e.date);
            if (ex == null) return null;
            const ty = 14 + (k % 2) * 13;
            return (
              <g key={e.date}>
                <line x1={ex} x2={ex} y1={ty + 4} y2={PAD.t + innerH} stroke="var(--color-text-primary)" strokeWidth={1} strokeDasharray="3 2.5" opacity={0.5} />
                <text x={ex + 4} y={ty} fontSize={9.5} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-primary)" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {e.date.slice(5).replace("-", "/")} {e.label}
                </text>
              </g>
            );
          })}

          {/* reporting-lag callout */}
          {lagFrom < months.length && (
            <text x={x(lagFrom) + 6} y={PAD.t + 16} fontSize={10} fontWeight={600} fontFamily="var(--font-mono, monospace)" fill="var(--color-text-muted)" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              DoD ~90-day reporting lag
            </text>
          )}

          {/* legend */}
          <g fontFamily="var(--font-mono, monospace)" fontSize={9.5}>
            <rect x={W - 210} y={PAD.t - 26} width={9} height={9} fill="var(--color-text-subtle)" opacity={0.8} />
            <text x={W - 197} y={PAD.t - 18} fill="var(--color-text-muted)">CIVILIAN</text>
            <rect x={W - 120} y={PAD.t - 26} width={9} height={9} fill="var(--color-accent-primary)" />
            <text x={W - 107} y={PAD.t - 18} fill="var(--color-text-muted)">DOD</text>
          </g>
        </svg>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-4 max-w-2xl text-center">
          {statement}
        </Text>
      </div>
    </div>
  );
}
