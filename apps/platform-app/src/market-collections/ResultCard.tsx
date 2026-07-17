/**
 * ResultCard building blocks — the Market result card's stat sections, shared
 * between the Market tab (free exploration) and the Deal intake view (the same
 * card populated by a compiled prospect intake). Definitions live server-side;
 * these components only format and disclose.
 */
import { Text } from "@rare-structure-hq/ui";

import type { CollectionsCount } from "./api";

export const fmt = (n: number): string => n.toLocaleString("en-US");
export const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

export function StatGrid({
  title,
  caption,
  stats,
}: {
  title: string;
  caption?: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
        {title}
      </Text>
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-border-subtle)] sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-2 bg-[color:var(--color-surface-base)] px-5 py-4"
          >
            <Text size="body-xs" color="subtle">
              {s.label}
            </Text>
            <span className="font-mono text-xl text-[color:var(--color-text-primary)] tabular-nums sm:text-2xl">
              {s.value}
            </span>
          </div>
        ))}
      </div>
      {caption ? (
        <Text size="body-xs" color="subtle">
          {caption}
        </Text>
      ) : null}
    </div>
  );
}

/**
 * "How this market gets paid" — display-only payment-regime breakdown.
 * Absolute values come from the server; shares are computed here. The four
 * class values sum to book_total exactly (server-side residual rule), so a
 * missing "Other" row means $0 was dropped — omitting it at 0 is safe.
 */
export function PaymentMix({
  result,
  collectionCount,
}: {
  result: CollectionsCount;
  collectionCount: number;
}) {
  const book = result.book_total;
  const title = "How this market gets paid";
  const heading = (
    <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
      {title}
    </Text>
  );
  if (book <= 0) {
    return (
      <div className="flex flex-col gap-2">
        {heading}
        <Text size="body-sm" color="muted">
          No committed value in scope.
        </Text>
      </div>
    );
  }
  const segments = [
    { label: "Fixed price", value: result.pricing_fixed_value, ct: result.pricing_fixed_ct, opacity: 1 },
    { label: "Cost-reimbursement", value: result.pricing_cost_value, ct: result.pricing_cost_ct, opacity: 0.55 },
    { label: "T&M / labor-hours", value: result.pricing_tm_lh_value, ct: result.pricing_tm_lh_ct, opacity: 0.3 },
    { label: "Other / unreported", value: result.pricing_other_value, ct: result.pricing_other_ct, opacity: 0.12 },
  ];
  const pct = (v: number): string => `${((v / book) * 100).toFixed(1)}%`;
  return (
    <div className="flex flex-col gap-2">
      {heading}
      <div className="flex h-3 w-full overflow-hidden">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              className="bg-[color:var(--color-accent-primary)]"
              style={{
                opacity: s.opacity,
                flexGrow: s.value / book,
                flexBasis: 0,
                minWidth: "3px",
              }}
            />
          ))}
      </div>
      <div className="flex flex-col gap-1">
        {segments
          .filter((s) => s.label !== "Other / unreported" || s.value !== 0)
          .map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <span
                className="h-2 w-2 shrink-0 self-center bg-[color:var(--color-accent-primary)]"
                style={{ opacity: s.opacity }}
              />
              <Text size="body-xs" color="default">
                {s.label}
              </Text>
              <span className="font-mono text-xs text-[color:var(--color-text-primary)] tabular-nums">
                {fmt$(s.value)} · {pct(s.value)}
              </span>
            </div>
          ))}
      </div>
      <Text size="body-sm" color="muted">
        Firm fixed price with no government financing recorded: {pct(result.ffp_unfinanced_value)} of
        committed value
      </Text>
      <Text size="body-xs" color="subtle">
        {collectionCount > 1 ? "Blended across " + collectionCount + " collections; per-collection mix may differ. " : ""}
        Share of committed contract value across {fmt(result.committed_award_ct)} active awards.
        Fixed price = the firm carries cost and float; cost-reimbursement = billed to the government as
        incurred; T&amp;M = billed hourly. Vehicles excluded.
      </Text>
    </div>
  );
}
