/**
 * MarketSpec — the Market tab: the durable market collections, live.
 *
 * The operator picks one or more of the 22 pair-defined market collections
 * (the opinionated POV — gtm.market_collections, hq/MARKET_COLLECTIONS_PROGRAM.md
 * v2) and tunes at the margins: geography (based in = HQ; working in = where
 * the firm's CURRENT ACTIVE in-scope awards are performed) and the FY23–25
 * won band. The member count + won stats render on the right — the same
 * definitions as the internal viewer's Bucket Explorer, so every number here
 * reconciles with the definitional work.
 *
 * Supersedes the spec-section instrument (geo/$/designations/firmographics —
 * market-spec/*, edge market_spec_v1; still deployed, no longer this tab) and
 * the archived audience builder (src/market/, kept on disk, unmounted).
 */
import { Crosshair } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import { CollectionsSplit } from "@/market-collections/CollectionsSplit";
import {
  type CollectionsDraft,
  EMPTY_COLLECTIONS_DRAFT,
  MarketCollectionsForm,
  buildCollectionsRequest,
} from "@/market-collections/MarketCollectionsForm";
import {
  type Collection,
  type CollectionsCount,
  countCollections,
  listCollections,
} from "@/market-collections/api";

const fmt = (n: number): string => n.toLocaleString("en-US");
const fmt$ = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};


function describeSpec(result: CollectionsCount): string {
  const spec = result.spec as {
    based_in?: string[] | null;
    working_in?: string[] | null;
    min_won?: number | null;
    max_won?: number | null;
  };
  const parts: string[] = [];
  if (spec.min_won || spec.max_won) {
    const lo = spec.min_won ? fmt$(spec.min_won) : "$0";
    parts.push(spec.max_won ? `won ${lo} – under ${fmt$(spec.max_won)}` : `won at least ${lo}`);
  } else {
    parts.push("any amount won");
  }
  if (spec.based_in?.length) parts.push(`based in ${spec.based_in.join(", ")}`);
  if (spec.working_in?.length) parts.push(`working in ${spec.working_in.join(", ")}`);
  return `Federal contract dollars won FY2023–FY2025 in this market · ${parts.join(" · ")}.`;
}


function StatGrid({
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
function PaymentMix({ result, collectionCount }: { result: CollectionsCount; collectionCount: number }) {
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
        Fixed price = the firm carries cost and
        float; cost-reimbursement = billed to the government as incurred; T&amp;M = billed hourly.
        Vehicles excluded.
      </Text>
    </div>
  );
}

export default function MarketSpec() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [draft, setDraft] = useState<CollectionsDraft>(EMPTY_COLLECTIONS_DRAFT);
  const [result, setResult] = useState<CollectionsCount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    listCollections(token)
      .then(setCollections)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load collections"));
  }, [token]);

  const run = useCallback(async () => {
    if (!token || draft.collections.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await countCollections(token, buildCollectionsRequest(draft)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Count failed");
    } finally {
      setBusy(false);
    }
  }, [token, draft]);

  const selectedTitles =
    collections && result
      ? (result.spec.collections as string[])
          .map((slug) => collections.find((c) => c.slug === slug)?.title ?? slug)
          .join(" + ")
      : "";

  return (
    <CockpitPage
      title="Market"
      description="Pick one or more defined market collections, tune geography and the won band, and see how many firms fit."
      width="wide"
    >
      <CollectionsSplit
        rail={
          <MarketCollectionsForm
            collections={collections}
            draft={draft}
            onDraft={setDraft}
            onRun={run}
            busy={busy}
          />
        }
      >
        {error ? (
          <Panel>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Text size="body-sm" color="default">
                Couldn’t run the market
              </Text>
              <Text size="mono-xs" mono color="subtle" className="max-w-md break-words">
                {error}
              </Text>
            </div>
          </Panel>
        ) : result === null ? (
          <Panel padded={false}>
            <EmptyState
              icon={Crosshair}
              title="No market selected yet"
              description="Pick collections on the left, tune at the margins, and hit Run — the count of firms fitting the definition lands here."
            />
          </Panel>
        ) : (
          <Panel>
            <div className="flex flex-col gap-8 px-6 py-8">
              <div className="flex flex-col gap-1">
                <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
                  Market
                </Text>
                <Text size="body-lg" color="primary">
                  {selectedTitles || "This market"}
                </Text>
              </div>

              <StatGrid
                title="The market"
                stats={[
                  { label: "Firms", value: fmt(result.count) },
                  { label: "Total won · FY23–25", value: fmt$(result.won_total) },
                  { label: "Median won per firm", value: fmt$(result.won_median) },
                  { label: "Average won per firm", value: fmt$(result.won_avg) },
                ]}
              />

              <StatGrid
                title="Committed work — active contracts today"
                caption="Standalone awards + task orders at contract value. Runway = value not yet billed."
                stats={[
                  { label: "Book · total", value: fmt$(result.book_total) },
                  { label: "Book per firm · med / avg", value: `${fmt$(result.book_median)} / ${fmt$(result.book_avg)}` },
                  {
                    label: `Award size · med / avg (${fmt(result.committed_award_ct)} awards)`,
                    value: `${fmt$(result.award_median)} / ${fmt$(result.award_avg)}`,
                  },
                  { label: "Active awards per firm · med", value: fmt(result.awards_median) },
                  { label: "Runway · total", value: fmt$(result.runway_total) },
                  { label: "Runway per firm · med / avg", value: `${fmt$(result.runway_median)} / ${fmt$(result.runway_avg)}` },
                ]}
              />

              <PaymentMix
                result={result}
                collectionCount={(result.spec.collections as string[]).length}
              />

              <StatGrid
                title="Vehicle capacity — separate, not blended"
                caption="IDIQ/BPA seats: the right to receive orders, not committed work. Headroom = ceiling the government may still order against."
                stats={[
                  {
                    label: "Seats held",
                    value: `${fmt(result.vehicle_seats)} · ${fmt(result.vehicle_holders)} firms`,
                  },
                  { label: "Ceiling · total", value: fmt$(result.vehicle_ceiling_total) },
                  { label: "Headroom · total (unfilled)", value: fmt$(result.vehicle_headroom_total) },
                ]}
              />

              <div className="flex flex-col gap-1.5">
                <Text size="body-sm" color="muted">
                  {describeSpec(result)}
                </Text>
                <Text size="body-xs" color="subtle">
                  Every firm counted holds at least one active contract in this market today.
                  {result.elapsed_ms != null ? ` · ${Math.round(result.elapsed_ms)} ms` : ""}
                  {result.artifact
                    ? ` · ${String(result.artifact).replace("query-sidecar/", "").replace(".duckdb", "")}`
                    : ""}
                </Text>
              </div>
            </div>
          </Panel>
        )}
      </CollectionsSplit>
    </CockpitPage>
  );
}
