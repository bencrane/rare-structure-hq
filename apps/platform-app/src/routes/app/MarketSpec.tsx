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
import { PaymentMix, StatGrid, fmt, fmt$ } from "@/market-collections/ResultCard";
import {
  type Collection,
  type CollectionsCount,
  countCollections,
  listCollections,
} from "@/market-collections/api";

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
