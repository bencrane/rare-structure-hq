/**
 * BandsView — the distribution card: who actually wins the facilities layer,
 * banded by each winner's TOTAL federal book. The point the card makes alone:
 * this is where normal-sized companies win federal money at scale — a deep
 * mid-market, not a prime oligopoly.
 *
 * Baked sidecar snapshot (FY25 S-code winners × total-book bands),
 * artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./bands-scode.json";

type Band = { band: string; label: string; firms: number; sB: number; share: number };
type Snap = { fy: number; artifact: string; bands: Band[]; totalSB: number; totalFirms: number };

const SNAP = snapshot as unknown as Snap;

// The "normal-sized business" pool the narrative points at.
const SWEET = new Set(["small", "mid"]);

export function BandsView() {
  const maxFirms = Math.max(...SNAP.bands.map((b) => b.firms));
  const maxSB = Math.max(...SNAP.bands.map((b) => b.sB));
  const sweet = SNAP.bands.filter((b) => SWEET.has(b.band));
  const sweetFirms = sweet.reduce((s, b) => s + b.firms, 0);
  const sweetB = sweet.reduce((s, b) => s + b.sB, 0);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-6 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            Who wins it
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {SNAP.totalFirms.toLocaleString()} firms split ${SNAP.totalSB}B — and the middle is real
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            fy{SNAP.fy} s-code winners · banded by total federal book ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="border border-[color:var(--color-border-subtle)]">
          <div className="grid grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] gap-4 border-[color:var(--color-border-subtle)] border-b bg-[color:var(--color-surface-sunken)] px-5 py-2">
            {["band", "firms", "s-code $", "share"].map((h, i) => (
              <Text
                key={h}
                as="div"
                size="mono-xs"
                mono
                color="subtle"
                className={`uppercase tracking-[0.12em] ${i === 3 ? "text-right" : ""}`}
              >
                {h}
              </Text>
            ))}
          </div>
          {SNAP.bands.map((b) => {
            const hot = SWEET.has(b.band);
            return (
              <div
                key={b.band}
                className={`grid grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-4 border-[color:var(--color-border-subtle)] border-b px-5 py-3.5 ${
                  hot ? "bg-[color:var(--color-accent-soft)]" : ""
                }`}
              >
                <Text as="div" size="body-sm" color="primary" className="font-semibold">
                  {b.label}
                </Text>
                <div className="flex items-center gap-3">
                  <div className="h-4 flex-1 bg-[color:var(--color-surface-base)]">
                    <div
                      className="h-full bg-[color:var(--color-text-muted)]"
                      style={{ width: `${(b.firms / maxFirms) * 100}%` }}
                    />
                  </div>
                  <Text as="span" size="mono-xs" mono color="muted" className="w-14 text-right tabular-nums">
                    {b.firms.toLocaleString()}
                  </Text>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 flex-1 bg-[color:var(--color-surface-base)]">
                    <div
                      className="h-full bg-[color:var(--color-accent-primary)]"
                      style={{ width: `${(b.sB / maxSB) * 100}%` }}
                    />
                  </div>
                  <Text as="span" size="mono-xs" mono color="primary" className="w-14 text-right font-semibold tabular-nums">
                    ${b.sB}B
                  </Text>
                </div>
                <Text as="div" size="body-sm" color={hot ? "accent" : "muted"} className="text-right font-semibold tabular-nums">
                  {b.share}%
                </Text>
              </div>
            );
          })}
        </div>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-6 max-w-2xl text-center">
          {sweetFirms.toLocaleString()} firms with $1–50M federal books carry ${sweetB.toFixed(1)}B
          of this layer — normal-sized companies winning federal money at scale. By headcount, 91%
          of winners have books under $10M.
        </Text>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-4 text-center uppercase tracking-[0.12em]">
          gray bars = firm count · accent bars = s-code dollars
        </Text>
      </div>
    </div>
  );
}
