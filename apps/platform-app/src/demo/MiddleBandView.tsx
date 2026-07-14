/**
 * MiddleBandView — the market's middle class: three bands of facility-services
 * firms (tail / middle / institutional top), paired horizontal bars per band —
 * firm count vs dollars. The middle band is the only one that lights up on
 * both axes; it renders in full accent, the others muted. Baked sidecar
 * snapshot, artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./facilities-middle-band.json";

type Band = {
  key: string;
  label: string;
  range: string;
  firms: number;
  oblB: number;
  note: string;
  highlight?: boolean;
};
type Snap = {
  scope: string;
  window: string;
  artifact: string;
  totalFirms: number;
  totalB: number;
  bands: Band[];
};

const SNAP = snapshot as unknown as Snap;

export function MiddleBandView() {
  const maxFirms = Math.max(...SNAP.bands.map((b) => b.firms));
  const maxB = Math.max(...SNAP.bands.map((b) => b.oblB));

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The market&rsquo;s middle class
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            1,379 firms where companies and dollars intersect
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            facility services · {SNAP.totalFirms.toLocaleString()} winning firms · ${SNAP.totalB}B ·{" "}
            {SNAP.window} · {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="flex flex-col gap-8">
          {SNAP.bands.map((b) => {
            const strong = b.highlight === true;
            const barOpacity = strong ? 0.85 : 0.22;
            return (
              <div
                key={b.key}
                className={
                  strong
                    ? "border border-[color:var(--color-accent-primary)] px-5 py-4"
                    : "border border-[color:var(--color-border-subtle)] px-5 py-4"
                }
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <Text as="div" size="body-md" color={strong ? "accent" : "primary"} className="font-semibold">
                    {b.label}
                  </Text>
                  <Text as="div" size="mono-xs" mono color="muted" className="uppercase tracking-[0.08em] tabular-nums">
                    {b.range}
                  </Text>
                </div>

                <div className="grid grid-cols-[64px_1fr_110px] items-center gap-3">
                  <Text as="div" size="mono-xs" mono color="muted" className="uppercase">
                    firms
                  </Text>
                  <div className="h-4">
                    <div
                      className="h-full bg-[color:var(--color-accent-primary)]"
                      style={{ width: `${Math.max((b.firms / maxFirms) * 100, 1)}%`, opacity: barOpacity }}
                    />
                  </div>
                  <Text as="div" size="body-sm" color={strong ? "accent" : "primary"} className="text-right font-semibold tabular-nums">
                    {b.firms.toLocaleString()}
                  </Text>

                  <Text as="div" size="mono-xs" mono color="muted" className="uppercase">
                    dollars
                  </Text>
                  <div className="h-4">
                    <div
                      className="h-full bg-[color:var(--color-accent-primary)]"
                      style={{ width: `${Math.max((b.oblB / maxB) * 100, 1)}%`, opacity: barOpacity }}
                    />
                  </div>
                  <Text as="div" size="body-sm" color={strong ? "accent" : "primary"} className="text-right font-semibold tabular-nums">
                    ${b.oblB.toFixed(b.oblB < 1 ? 2 : 1)}B
                  </Text>
                </div>

                <Text as="div" size="body-sm" color="muted" className="mt-2.5">
                  {b.note}
                </Text>
              </div>
            );
          })}
        </div>

        <Text as="div" size="mono-xs" mono color="subtle" className="mt-8 text-center uppercase tracking-[0.12em]">
          bar length ∝ value within its axis · bands by total federal book over the window
        </Text>
      </div>
    </div>
  );
}
