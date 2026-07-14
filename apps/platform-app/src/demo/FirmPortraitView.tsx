/**
 * FirmPortraitView — a single real borrower, in the wild: fiscal-year growth
 * bars (left) against the open-award book, obligated vs signed ceiling
 * (right), with the working-capital read underneath. Data is a baked
 * sidecar snapshot (txn events by FY + open awards per firm), artifact-stamped.
 */

import { Text } from "@rare-structure-hq/ui";

import snapshot from "./firm-portraits.json";

type FyRow = { label: string; oblM: number };
type AwardRow = { label: string; oblM: number; ceilM: number | null; ends: string | null };
type Firm = { name: string; what: string; fy: FyRow[]; awards: AwardRow[]; insight: string };
type Snap = { scope: string; asOf: string; artifact: string; firms: Record<string, Firm> };

const SNAP = snapshot as unknown as Snap;

export function FirmPortraitView({ firmKey }: { firmKey: string }) {
  const firm = SNAP.firms[firmKey];
  if (!firm) return null;

  const maxFy = Math.max(...firm.fy.map((f) => f.oblM));
  const awards = firm.awards.filter((a) => (a.ceilM ?? a.oblM) > 0);
  const maxAward = Math.max(...awards.map((a) => Math.max(a.ceilM ?? 0, a.oblM)));
  const totalObl = firm.awards.reduce((s, a) => s + a.oblM, 0);
  const totalCeil = firm.awards.reduce((s, a) => s + (a.ceilM ?? a.oblM), 0);

  return (
    <div className="flex h-full flex-col items-center justify-center px-10">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            The borrower, in the wild
          </Text>
          <Text as="div" size="display-lg" color="primary" className="mt-1 font-display font-semibold">
            {firm.name}
          </Text>
          <Text as="div" size="mono-xs" mono color="muted" className="mt-1 uppercase tracking-[0.12em] tabular-nums">
            {firm.what} · public award record · as of {SNAP.asOf} ·{" "}
            {SNAP.artifact.split("_").pop()?.replace(".duckdb", "")}
          </Text>
        </div>

        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10">
          {/* FY growth bars */}
          <div>
            <Text as="div" size="mono-xs" mono color="muted" className="mb-3 uppercase tracking-[0.12em]">
              federal obligations by fiscal year
            </Text>
            <div className="flex h-56 items-end gap-6">
              {firm.fy.map((f) => (
                <div key={f.label} className="flex flex-1 flex-col items-center gap-2">
                  <Text as="div" size="body-sm" color="primary" className="font-semibold tabular-nums">
                    ${f.oblM.toFixed(1)}M
                  </Text>
                  <div
                    className="w-full bg-[color:var(--color-accent-primary)]"
                    style={{ height: `${Math.max((f.oblM / maxFy) * 180, 3)}px`, opacity: 0.75 }}
                  />
                  <Text as="div" size="mono-xs" mono color="muted" className="uppercase">
                    {f.label}
                  </Text>
                </div>
              ))}
            </div>
          </div>

          {/* Open-award book: obligated vs ceiling */}
          <div>
            <Text as="div" size="mono-xs" mono color="muted" className="mb-3 uppercase tracking-[0.12em]">
              open awards — funded (solid) vs signed ceiling (frame) · $
              {totalObl.toFixed(0)}M of ${totalCeil.toFixed(0)}M
            </Text>
            <div className="flex flex-col gap-2.5">
              {awards.map((a, i) => {
                const ceil = a.ceilM ?? a.oblM;
                const width = (Math.max(ceil, a.oblM) / maxAward) * 100;
                const fill = ceil > 0 ? Math.min((a.oblM / ceil) * 100, 100) : 100;
                return (
                  <div key={`${a.label}-${i}`}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <Text as="span" size="mono-xs" mono color="default" className="uppercase">
                        {a.label}
                        {a.ends ? ` · ends ${a.ends}` : ""}
                      </Text>
                      <Text as="span" size="mono-xs" mono color="muted" className="tabular-nums">
                        ${a.oblM.toFixed(1)}M / {a.ceilM != null ? `$${a.ceilM.toFixed(1)}M` : "—"}
                      </Text>
                    </div>
                    <div
                      className="h-4 border border-[color:var(--color-accent-primary)]"
                      style={{ width: `${Math.max(width, 4)}%`, borderColor: "var(--color-accent-primary)" }}
                    >
                      <div
                        className="h-full bg-[color:var(--color-accent-primary)]"
                        style={{ width: `${fill}%`, opacity: 0.75 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Text as="div" size="body-md" color="primary" className="mx-auto mt-10 max-w-3xl text-center">
          {firm.insight}
        </Text>
      </div>
    </div>
  );
}
