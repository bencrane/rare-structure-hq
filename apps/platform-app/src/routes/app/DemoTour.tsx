/**
 * DemoTour — the operator's guided-tour presentation surface (⌘P → "Demo").
 *
 * The left rail is the SCRIPT: an ordered list of beats the operator clicks
 * through while narrating (live call or Loom). The right pane is the STAGE:
 * each beat renders its result — an aggregate chart today; map cuts and tables
 * as the script grows.
 *
 * THE CONTRACT: every beat is backed by a phrase — a deterministic, disclosed
 * query recipe (catalyst phrase-agg grammar; closed vocabulary, zero LLM) fired
 * verbatim on click. Nothing on the stage is hardcoded; the rail shows each
 * beat's phrase and, once run, its provenance (artifact stamp + timing). The
 * narrative is the operator's; the numbers are the engine's.
 *
 * Iteration 1: ONE beat. The script array is the growth seam.
 */

import { ArrowLeft, Play } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Text } from "@rare-structure-hq/ui";

import { AggregateView } from "@/demo/AggregateView";
import { BandsView } from "@/demo/BandsView";
import { CombosView } from "@/demo/CombosView";
import flowNational from "@/demo/flow-national-obbba.json";
import { FreezeView } from "@/demo/FreezeView";
import moneyMapScode from "@/demo/money-map-scode.json";
import { MoneyMapView } from "@/demo/MoneyMapView";
import { PactGapView } from "@/demo/PactGapView";
import { PactSupplyView } from "@/demo/PactSupplyView";
import pactWave from "@/demo/pact-wave.json";
import coilMfg from "@/demo/coil-manufacturing.json";
import coilPs from "@/demo/coil-profservices.json";
import mapMfg from "@/demo/map-manufacturing.json";
import mapPs from "@/demo/map-profservices.json";
import { type Beat, getNarrative } from "@/demo/narratives";
import { PrimesView } from "@/demo/PrimesView";
import { TerritoryView } from "@/demo/TerritoryView";
import { ThesisView } from "@/demo/ThesisView";
import { WaveView } from "@/demo/WaveView";
import {
  type AggregatePhraseResponse,
  fetchAggregatePhrase,
  toResolvedAggregate,
} from "@/demo/aggregatePhrase";


type BeatState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; response?: AggregatePhraseResponse }
  | { status: "error"; message: string };

export default function DemoTour() {
  const { narrativeId } = useParams();
  const navigate = useNavigate();
  const narrative = getNarrative(narrativeId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, BeatState>>({});

  const SCRIPT = narrative?.beats ?? [];

  const setBeatState = (id: string, s: BeatState) =>
    setStates((prev) => ({ ...prev, [id]: s }));

  async function runBeat(beat: Beat) {
    setActiveId(beat.id);
    const current = states[beat.id];
    if (current?.status === "done" || current?.status === "loading") return;
    if (beat.kind && beat.kind !== "aggregate") {
      // Static stage — baked layers/snapshot; nothing to fire.
      setBeatState(beat.id, { status: "done" });
      return;
    }
    setBeatState(beat.id, { status: "loading" });
    try {
      const response = await fetchAggregatePhrase(beat.phrase);
      setBeatState(beat.id, { status: "done", response });
    } catch (e) {
      setBeatState(beat.id, {
        status: "error",
        message: e instanceof Error ? e.message : "query failed",
      });
    }
  }

  const active = SCRIPT.find((b) => b.id === activeId) ?? null;
  const activeState: BeatState = (active && states[active.id]) || { status: "idle" };

  if (!narrative) {
    return (
      <div className="flex h-screen items-center justify-center bg-[color:var(--color-surface-base)]">
        <button type="button" onClick={() => navigate("/app/demo")} className="text-left">
          <Text as="div" size="mono-xs" mono color="subtle" className="uppercase tracking-[0.18em]">
            unknown narrative — back to the gallery
          </Text>
        </button>
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-cols-[20rem_minmax(0,1fr)] bg-[color:var(--color-surface-base)]">
      {/* ── The script rail ──────────────────────────────────────────────── */}
      <aside className="flex h-full flex-col overflow-y-auto border-[color:var(--color-border-subtle)] border-r bg-[color:var(--color-surface-sunken)]">
        <div className="border-[color:var(--color-border-subtle)] border-b px-5 py-4">
          <button
            type="button"
            onClick={() => navigate("/app/demo")}
            className="mb-2 flex items-center gap-1.5 text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text-primary)]"
          >
            <ArrowLeft className="size-3" />
            <Text as="span" size="mono-xs" mono color="subtle" className="uppercase tracking-[0.12em]">
              narratives
            </Text>
          </button>
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            {narrative.title}
          </Text>
          <Text as="div" size="mono-xs" mono color="subtle" className="mt-1 uppercase tracking-[0.12em]">
            {narrative.audience} · every beat is a query
          </Text>
        </div>

        <div className="flex-1 py-3">
          {SCRIPT.map((beat, i) => {
            const st: BeatState = states[beat.id] ?? { status: "idle" };
            const isActive = beat.id === activeId;
            return (
              <div key={beat.id} className="px-3 py-1">
                {(i === 0 || SCRIPT[i - 1].act !== beat.act) && (
                  <Text
                    as="div"
                    size="mono-xs"
                    mono
                    color="subtle"
                    className="px-2 pt-2 pb-1 uppercase tracking-[0.14em]"
                  >
                    {beat.act}
                  </Text>
                )}
                <button
                  type="button"
                  onClick={() => void runBeat(beat)}
                  className={`w-full border px-3 py-3 text-left transition-colors ${
                    isActive
                      ? "border-[color:var(--color-border-accent)] bg-[color:var(--color-accent-soft)]"
                      : "border-[color:var(--color-border-subtle)] hover:bg-[color:var(--color-surface-raised)]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center border border-[color:var(--color-border-subtle)] font-mono text-[0.5625rem] text-[color:var(--color-text-muted)]">
                      {i + 1}
                    </span>
                    <Text as="span" size="body-sm" color="primary" className="font-semibold">
                      {beat.title}
                    </Text>
                    <Play className="ml-auto size-3 shrink-0 text-[color:var(--color-text-subtle)]" />
                  </span>
                  {/* The recipe, disclosed — the phrase fired verbatim on click. */}
                  <Text
                    as="div"
                    size="mono-xs"
                    mono
                    color={isActive ? "accent" : "muted"}
                    className="mt-2 break-words"
                  >
                    ▸ {beat.phrase}
                  </Text>
                  {/* Provenance line once the beat has run. */}
                  {st.status === "done" && st.response && (
                    <Text as="div" size="mono-xs" mono color="subtle" className="mt-1.5 tabular-nums">
                      {st.response.meta.compilerVersion} ·{" "}
                      {st.response.meta.artifact.split("_").pop()?.replace(".duckdb", "")} ·{" "}
                      {Math.round(st.response.meta.elapsedMs)}ms
                    </Text>
                  )}
                  {st.status === "loading" && (
                    <Text as="div" size="mono-xs" mono color="subtle" className="mt-1.5">
                      compiling…
                    </Text>
                  )}
                  {st.status === "error" && (
                    <Text as="div" size="mono-xs" mono color="subtle" className="mt-1.5 break-words">
                      ✕ {st.message}
                    </Text>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-[color:var(--color-border-subtle)] border-t px-5 py-3">
          <Text as="div" size="mono-xs" mono color="subtle" className="uppercase tracking-[0.12em]">
            ⌘P · demo
          </Text>
        </div>
      </aside>

      {/* ── The stage ────────────────────────────────────────────────────── */}
      <main className="relative h-full min-w-0 overflow-hidden">
        {activeState.status === "done" && active && active.kind === "thesis" ? (
          <ThesisView />
        ) : activeState.status === "done" && active && active.kind === "facilities-thesis" ? (
          <ThesisView
            kicker="The thesis"
            title="The floor gets cleaned every year"
            subtitle="psc s-codes · recurring facility operations · fy25"
            lines={[
              {
                amount: "$19.9B",
                label: "Obligated in FY25 alone",
                detail:
                  "Custodial, grounds, waste, guards, mess, utility ops — the standing contracts that run every federal building",
              },
              {
                amount: "7,240",
                label: "Distinct winning firms",
                detail:
                  "The most fragmented population in the facility economy — thousands of genuinely normal-sized companies",
              },
              {
                amount: "5-yr",
                label: "Annuity-shaped revenue",
                detail:
                  "Base-plus-options cycles: hold the contract, hold predictable monthly billing for years",
              },
            ]}
            statement="This market doesn't wait on any bill — 300,000 federal facilities need cleaning, guarding, and operating every year regardless of politics. It is huge, structural, and quietly mispriced — and an unlock is waiting inside it."
            footer="structural — no catalyst required · figures from the pinned snapshot"
          />
        ) : activeState.status === "done" && active && active.kind === "scode-map" ? (
          <MoneyMapView
            snap={moneyMapScode as never}
            kicker="Business as usual"
            title="The floor is everywhere the flag flies"
            subtitle="fy25 s-code obligations · place of performance"
          />
        ) : activeState.status === "done" && active && active.kind === "bands" ? (
          <BandsView />
        ) : activeState.status === "done" && active && active.kind === "freeze" ? (
          <FreezeView />
        ) : activeState.status === "done" && active && active.kind === "mfg-thesis" ? (
          <ThesisView
            kicker="The thesis"
            title="The industrial base has one customer"
            subtitle="naics 31–33 · federal manufacturing · fy25"
            lines={[
              {
                amount: "$107B",
                label: "DoD is the buyer",
                detail:
                  "Of federal manufacturing, DoD (agency 097) is the overwhelming majority — aircraft, ships, vehicles, electronics",
              },
              {
                amount: "−13%",
                label: "Run-rate since mid-FY25",
                detail:
                  "Obligations contracting — but this is timing, not demand: the FY26 shutdown + CR jammed the annual channel",
              },
              {
                amount: "$838.7B",
                label: "Already appropriated",
                detail:
                  "Full-year DoD funding enacted Feb 3, 2026 — the money exists; the pipe is what's blocked",
              },
            ]}
            statement="Federal manufacturing didn't lose demand — its one buyer's funding channel jammed. The money is enacted and coiled behind the apportionment/contracting pipe. When it releases, the primes holding these contracts need working capital to mobilize against it."
            footer="naics 31–33 · agency 097 = dod · figures from the pinned snapshot"
          />
        ) : activeState.status === "done" && active && active.kind === "mfg-map" ? (
          <MoneyMapView
            snap={mapMfg as never}
            kicker="Where it's built"
            title="The industrial base, by place of performance"
            subtitle="fy25 manufacturing obligations · pop state"
          />
        ) : activeState.status === "done" && active && active.kind === "mfg-coil" ? (
          <FreezeView
            snap={coilMfg as never}
            kicker="The procurement coil"
            title="DoD frozen — appropriated, not obligating"
            statement="DoD manufacturing obligations ran −18% into the shutdown/CR and stay suppressed after the full-year $838.7B was enacted. Airframes and hulls don't vanish — the procurement is funded and queued behind the contracting pipe. The release is a working-capital event for whoever holds the backlog."
          />
        ) : activeState.status === "done" && active && active.kind === "ps-thesis" ? (
          <ThesisView
            kicker="The thesis"
            title="Federal services is payroll on 45-day terms"
            subtitle="naics 54 · professional / technical / staffing · fy25"
            lines={[
              {
                amount: "−39%",
                label: "DoD services run-rate",
                detail:
                  "The DoD half of prof-services collapsed through the shutdown/CR — R&D, A&E, technical staffing",
              },
              {
                amount: "−4%",
                label: "Civilian services",
                detail:
                  "Essentially flat — the demand didn't leave; one buyer's funding channel jammed",
              },
              {
                amount: "45–60d",
                label: "Payroll float, always",
                detail:
                  "Labor firms pay crews weekly, invoice monthly in arrears — a standing AR gap that scales with the contract",
              },
            ]}
            statement="This is a labor book, not a product book: ~100% payroll, billed in arrears, with no collateral but the receivable. When the DoD channel jams, the strain flows straight to working capital — and the receivable is against an enacted budget, not a failing customer."
            footer="naics 54 · agency 097 = dod · figures from the pinned snapshot"
          />
        ) : activeState.status === "done" && active && active.kind === "ps-map" ? (
          <MoneyMapView
            snap={mapPs as never}
            kicker="Where the labor books"
            title="Professional services, by place of performance"
            subtitle="fy25 prof-services obligations · pop state"
          />
        ) : activeState.status === "done" && active && active.kind === "ps-coil" ? (
          <FreezeView
            snap={coilPs as never}
            kicker="The labor coil"
            title="DoD services frozen, civilian flat"
            statement="DoD prof-services ran −39% run-rate while civilian held within −4%. The contraction is one buyer's freeze, not lost demand — the labor firms carry a permanent payroll float against receivables that are backed by an enacted budget. That's the AR/working-capital lane, at its lowest-risk."
          />
        ) : activeState.status === "done" && active && active.kind === "pact-gap" ? (
          <PactGapView />
        ) : activeState.status === "done" && active && active.kind === "pact-supply" ? (
          <PactSupplyView />
        ) : activeState.status === "done" && active && active.kind === "pact-wave" ? (
          <WaveView
            snap={pactWave as never}
            kicker="The second catalyst"
            title="PACT: a 2022 statute, still compounding"
            footer="fy23 $3.1B → fy24 $5.1B → fy25 $8.2B → fy26 $7.6B in 9 months · exam capacity, not claims, is the bottleneck · pop on this lane is vendor-hq fiction — the work is national"
          />
        ) : activeState.status === "done" && active && active.kind === "wave" ? (
          <WaveView />
        ) : activeState.status === "done" && active && active.kind === "money-map" ? (
          <MoneyMapView />
        ) : activeState.status === "done" && active && active.kind === "flow" ? (
          <CombosView
            snap={flowNational as never}
            kicker="Where it lands"
            title="New money by dirt-iron combo since signing"
            subtitle="obligated since 2025-07-04 · national"
            valueHeader="new $"
          />
        ) : activeState.status === "done" && active && active.kind === "territory" ? (
          <TerritoryView zip={active.zip ?? ""} />
        ) : activeState.status === "done" && active && active.kind === "combos" ? (
          <CombosView />
        ) : activeState.status === "done" && active && active.kind === "primes" ? (
          <PrimesView />
        ) : activeState.status === "done" && active && activeState.response ? (
          <AggregateView
            resolved={toResolvedAggregate(activeState.response)}
            onInvokeCommand={() => {}}
            commandPill={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Text
                as="div"
                size="mono-xs"
                mono
                color="subtle"
                className="uppercase tracking-[0.18em]"
              >
                {activeState.status === "loading"
                  ? "Compiling phrase → executing on the pinned snapshot…"
                  : activeState.status === "error"
                    ? "Query refused — see the rail"
                    : "Select a beat to begin"}
              </Text>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
