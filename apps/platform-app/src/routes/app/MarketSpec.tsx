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
import { MarketSplit } from "@/market/MarketSplit";
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
      <MarketSplit
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
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
                {selectedTitles || "Firms in this market"}
              </Text>
              <span className="font-mono text-6xl text-[color:var(--color-text-primary)] tabular-nums">
                {fmt(result.count)}
              </span>
              <Text size="mono-xs" mono color="subtle">
                firms · FY23–25 won in scope: {fmt$(result.won_total)} total · median{" "}
                {fmt$(result.won_median)} · avg {fmt$(result.won_avg)}
              </Text>
              {result.elapsed_ms != null ? (
                <Text size="mono-xs" mono color="subtle">
                  {Math.round(result.elapsed_ms)} ms
                  {result.artifact
                    ? ` · ${String(result.artifact).replace("query-sidecar/", "")}`
                    : ""}
                </Text>
              ) : null}
            </div>
          </Panel>
        )}
      </MarketSplit>
    </CockpitPage>
  );
}
