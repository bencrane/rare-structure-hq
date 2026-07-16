/**
 * MarketSpec — the Market tab: the live market-definition instrument.
 *
 * Filled in live on a call with a demand-side partner: geography → federal $ →
 * designations → firmographics on the left, the count of entities fitting that
 * definition on the right. The count IS the conversation; contactability has
 * no representation here by design (operator ruling 2026-07-16). The right
 * panel is a slot — distributions/segments land there iteratively.
 *
 * Supersedes the archived audience builder (src/market/, routes/app/Market.tsx
 * — the operator's personal outbound toolkit, kept on disk, unmounted).
 */
import { Crosshair } from "lucide-react";
import { useCallback, useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { CockpitPage, EmptyState, Panel } from "@/app/cockpit";
import { useAuth } from "@/lib/auth";
import {
  EMPTY_SPEC_DRAFT,
  MarketSpecForm,
  type SpecDraft,
  buildSpec,
} from "@/market-spec/MarketSpecForm";
import { type SpecCount, countMarketSpec } from "@/market-spec/api";
import { MarketSplit } from "@/market/MarketSplit";

const fmt = (n: number): string => n.toLocaleString("en-US");

export default function MarketSpec() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";

  const [draft, setDraft] = useState<SpecDraft>(EMPTY_SPEC_DRAFT);
  const [result, setResult] = useState<SpecCount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await countMarketSpec(token, buildSpec(draft)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Count failed");
    } finally {
      setBusy(false);
    }
  }, [token, draft]);

  return (
    <CockpitPage
      title="Market"
      description="Define a market live — geography, federal dollars, designations — and see how many entities fit it."
      width="wide"
    >
      <MarketSplit
        rail={<MarketSpecForm draft={draft} onDraft={setDraft} onRun={run} busy={busy} />}
      >
        {error ? (
          <Panel>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Text size="body-sm" color="default">
                Couldn’t run the spec
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
              title="No market defined yet"
              description="Answer the sections on the left and hit Run — the count of entities fitting the definition lands here."
            />
          </Panel>
        ) : (
          <Panel>
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Text size="mono-xs" mono color="subtle" className="uppercase tracking-[0.14em]">
                Entities in this market
              </Text>
              <span className="font-mono text-6xl text-[color:var(--color-text-primary)] tabular-nums">
                {fmt(result.count)}
              </span>
              {result.elapsed_ms != null ? (
                <Text size="mono-xs" mono color="subtle">
                  {Math.round(result.elapsed_ms)} ms
                </Text>
              ) : null}
            </div>
          </Panel>
        )}
      </MarketSplit>
    </CockpitPage>
  );
}
