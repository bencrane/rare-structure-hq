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
import { ConstrPieView } from "@/demo/ConstrPieView";
import { FacilitiesAwardsMapView } from "@/demo/FacilitiesAwardsMapView";
import { FederalEstateMapView } from "@/demo/FederalEstateMapView";
import { FirmPortraitView } from "@/demo/FirmPortraitView";
import { HoleView } from "@/demo/HoleView";
import ironMiragePie from "@/demo/iron-mirage-pie.json";
import waveObbbaLong from "@/demo/wave-obbba-long.json";
import facilities56Pie from "@/demo/facilities-56-pie.json";
import facilitiesServicesPie from "@/demo/facilities-services-pie.json";
import scodeDodSplitPie from "@/demo/scode-dod-split-pie.json";
import sectorPiePreObbba from "@/demo/sector-pie-pre-obbba.json";
import { MapCompareView } from "@/demo/MapCompareView";
import { MiddleBandView } from "@/demo/MiddleBandView";
import { MoneyMapView } from "@/demo/MoneyMapView";
import { PactGapView } from "@/demo/PactGapView";
import { BoringYearView } from "@/demo/BoringYearView";
import { RecoveryMonthView } from "@/demo/RecoveryMonthView";
import { RecoveryStepsView } from "@/demo/RecoveryStepsView";
import { SeptOctCliffView } from "@/demo/SeptOctCliffView";
import { SeptSprintView } from "@/demo/SeptSprintView";
import { PactSupplyView } from "@/demo/PactSupplyView";
import pactWave from "@/demo/pact-wave.json";
import coilMfg from "@/demo/coil-manufacturing.json";
import coilPs from "@/demo/coil-profservices.json";
import mapMfg from "@/demo/map-manufacturing.json";
import moneyMapEverything from "@/demo/money-map-everything-else.json";
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
        ) : activeState.status === "done" && active && active.kind === "cp-thesis" ? (
          <ThesisView
            kicker="The signature"
            statement="That signature set in motion the largest federal construction wave in a generation. Before the thesis, watch what it did to the map."
          />
        ) : activeState.status === "done" && active && active.kind === "dod-catalyst" ? (
          <ThesisView
            kicker="The catalyst"
            title="February 3, 2026"
            subtitle="dod appropriations · enacted · public law"
            lines={[
              {
                amount: "$838.7B",
                label: "DoD appropriations — signed",
                detail:
                  "Enacted 2026-02-03, after the October shutdown and the longest CR in the department's history",
              },
              {
                amount: "4 mos",
                label: "Of triage before it",
                detail:
                  "Under the CR, DoD kept hardware and engineering flowing — December manufacturing ran above normal",
              },
              {
                amount: "Last",
                label: "In line: the buildings",
                detail:
                  "Facilities S-codes ran ~40% below run-rate in every clean month — the one lane still dry when the money became law",
              },
            ]}
            statement="The money is not proposed, not promised — enacted. It has been law for five months, and the facilities lane it funds was still running dry in the last month the data can see. What follows is who is holding that paper."
            footer="public record · enacted appropriation · obligation reads from the pinned snapshot"
          />
        ) : activeState.status === "done" && active && active.kind === "firm-portrait" ? (
          <FirmPortraitView
            firmKey={
              active.id === "cp-firm-simmons"
                ? "simmons"
                : active.id === "cp-firm-visionquest"
                  ? "visionquest"
                  : "gxc"
            }
          />
        ) : activeState.status === "done" && active && active.kind === "deal-econ" ? (
          <ThesisView
            kicker="Deal economics"
            title="What one borrower is worth"
            subtitle="illustrative facilities firm · $10M annual federal book"
            lines={[
              {
                amount: "$1.3M",
                label: "Fundable AR on a $10M book",
                detail:
                  "≈13% of annual federal revenue — 1.75 months of invoices in float × 90% advance rate",
              },
              {
                amount: "$150–290K",
                label: "Lender revenue per year",
                detail:
                  "Factoring / ABL economics on the funded balance, at prevailing federal-receivable pricing",
              },
              {
                amount: "~$1M",
                label: "Over one contract life",
                detail:
                  "Base-plus-options S-code cycles run ~5 years — the borrower renews with the building, not the news cycle",
              },
            ]}
            statement="The receivable is an invoice to the United States Treasury on a contract that renews every year the building stays open. One sourced borrower of this shape repays a six-figure sourcing seat several times over its life."
            footer="derived figures · 1.75-month float × 90% advance · pricing range indicative"
          />
        ) : activeState.status === "done" && active && active.kind === "boring-year" ? (
          active.id === "boring-2021" ? (
            <BoringYearView
              yearKey="2021"
              statement="Things need to be cleaned. Doors need to be guarded. Lawns need to be mowed. Twelve months, twelve almost-identical bars — no news cycle, no politics, no story. Exactly how the firms in this market like it."
            />
          ) : active.id === "boring-2022" ? (
            <BoringYearView yearKey="2022" statement="Different year. Same twelve bars." />
          ) : active.id === "boring-2023" ? (
            <BoringYearView
              yearKey="2023"
              statement="Third year, same story — the most dependable line item in the federal budget."
            />
          ) : active.id === "boring-2024" ? (
            <BoringYearView
              yearKey="2024"
              title="2024 — the best year yet"
              statement="Fourth year. Now $16.1B — the lane's biggest year on record. Still nobody watching."
            />
          ) : active.id === "boring-2025" ? (
            <BoringYearView
              yearKey="2025"
              title="2025 — nine months, two all-time records"
              statement="Through September: on pace for the best year in the lane's history — April and September the two biggest months ever recorded. And then the metronome stopped."
            />
          ) : (
            <BoringYearView
              yearKey="2025-oct"
              kicker="October 1st"
              title="The worst month in the history of the lane"
              statement="Fifty-seven consecutive months without a single bad one — then $0.7B. The government shut down at midnight on October 1st. What happened next depends on which half of this market you were in."
            />
          )
        ) : activeState.status === "done" && active && active.kind === "sept-sprint" ? (
          <SeptSprintView />
        ) : activeState.status === "done" && active && active.kind === "hole" ? (
          <HoleView />
        ) : activeState.status === "done" && active && active.kind === "iron-mirage" ? (
          <ConstrPieView
            snap={ironMiragePie as never}
            kicker="The mirage"
            title="47 firms hold 80% of the wave"
            subtitle="active heavy-civil awards · by firm band · obligated $"
            centerLabel="active book"
          />
        ) : activeState.status === "done" && active && active.kind === "iron-book" ? (
          <ThesisView
            kicker="Right now"
            title="The middle's book, as it sits today"
            subtitle="mid-market heavy-civil primes · active awards · $1–150m open books"
            lines={[
              {
                amount: "490",
                label: "Firms holding live paper",
                detail: "Regional heavy-civil primes — winning federal awards directly, not as subs",
              },
              {
                amount: "929",
                label: "Active awards, right now",
                detail: "Roads, border packages, utilities, dams, airfields — work in performance today",
              },
              {
                amount: "$16.2B",
                label: "Signed capacity — $9.1B funded",
                detail:
                  "Another $7B of ceiling already under contract, funding as the work rolls forward",
              },
            ]}
            statement="Every dollar of it is performed with machines. The award is public; the iron it requires is not yet on their balance sheets."
            footer="active book as of the pinned snapshot"
          />
        ) : activeState.status === "done" && active && active.kind === "iron-dropmic" ? (
          <ThesisView
            kicker="The names"
            title="The headlines belong to 47 companies. The market doesn't."
            subtitle="mid-market heavy-civil primes · new work since the signature"
            lines={[
              {
                amount: "$1.13B",
                label: "To grade, pave & build roads and bridges",
                detail: "Paving crews on new highways — and resurfacing the ones already there",
              },
              {
                amount: "$0.48B",
                label: "To move earth at the border",
                detail: "Heavy-civil crews — earthworks and structures behind the barrier",
              },
              {
                amount: "$0.36B",
                label: "To pour dams, cut canals, dredge waterways",
                detail: "Concrete placement, channel excavation, marine dredge crews",
              },
            ]}
            statement="Every one of those awards is performed with iron — excavators, dozers, cranes — and iron gets financed. We know their names, their awards, and their start dates."
            footer="new obligations since 2025-07-04 · mid-market cohort · figures from the pinned snapshot"
          />
        ) : activeState.status === "done" && active && active.kind === "wave-long" ? (
          <WaveView
            snap={waveObbbaLong as never}
            kicker="The jump"
            title="Three and a half years of nothing — then this"
            footer="same lane, widened to 2022 · two net-deobligation months floored at $0 · trailing months still filling"
          />
        ) : activeState.status === "done" && active && active.kind === "shutdown-thesis" ? (
          <ThesisView
            kicker="What happened"
            title="October 1, 2025"
            subtitle="appropriations lapse · public record"
            lines={[
              {
                amount: "12:00 AM",
                label: "Appropriations lapse",
                detail: "FY26 began with no budget — the federal government shut down",
              },
              {
                amount: "6 wks",
                label: "Shutdown, then a capped CR",
                detail:
                  "Reopened mid-November on a continuing resolution: prior-year rates, no new starts",
              },
              {
                amount: "1 buyer",
                label: "Took the hit hardest",
                detail:
                  "One customer's facilities lane absorbed the freeze — and it happens to be half this market",
              },
            ]}
            statement="The metronome didn't stop everywhere. It stopped for one buyer — the biggest one this market has."
            footer="public record · the split is the next card"
          />
        ) : activeState.status === "done" && active && active.kind === "estate-map" ? (
          <FederalEstateMapView />
        ) : activeState.status === "done" && active && active.kind === "dod-split" ? (
          <ConstrPieView
            snap={scodeDodSplitPie as never}
            kicker="The split"
            title="824 bases spend like 300,000 buildings"
            subtitle="facility services (psc s-codes) · fy23–fy25 · by awarding agency"
            centerLabel="fy23–25"
            pctDecimals={1}
          />
        ) : activeState.status === "done" && active && active.kind === "sept-oct-cliff" ? (
          <SeptOctCliffView />
        ) : activeState.status === "done" && active && active.kind === "recovery-steps" ? (
          <RecoveryStepsView />
        ) : activeState.status === "done" && active && active.kind === "recovery-month" ? (
          <RecoveryMonthView
            monthKey={
              active.id === "recovery-oct" ? "oct" : active.id === "recovery-nov" ? "nov" : "dec"
            }
          />
        ) : activeState.status === "done" && active && active.kind === "facilities-services-pie" ? (
          <ConstrPieView
            snap={facilitiesServicesPie as never}
            kicker="The double-click, again"
            title="$36B of facility services — what the work is"
            subtitle="naics 56 × psc s-codes · same three years"
            centerLabel="3 yrs pre-signing"
          />
        ) : activeState.status === "done" && active && active.kind === "facilities-56-pie" ? (
          <ConstrPieView
            snap={facilities56Pie as never}
            kicker="The double-click"
            title="$197B of Facilities & Support — what it buys"
            subtitle="naics 56 · psc work families · same three years"
            centerLabel="3 yrs pre-signing"
          />
        ) : activeState.status === "done" && active && active.kind === "sector-pie" ? (
          <ConstrPieView
            snap={sectorPiePreObbba as never}
            kicker="Before the bill"
            title="$2.26T of federal awards — the standing order"
            subtitle="all naics sectors · 2022-07-04 → 2025-07-03 · place in line before obbba"
            centerLabel="3 yrs pre-signing"
          />
        ) : activeState.status === "done" && active && active.kind === "constr-pie" ? (
          <ConstrPieView />
        ) : activeState.status === "done" && active && active.kind === "map-compare" ? (
          <MapCompareView />
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
        ) : activeState.status === "done" && active && active.kind === "everything-map" ? (
          <MoneyMapView
            snap={moneyMapEverything as never}
            kicker="The rest of the budget"
            title="$766B a year — jets, ships, research, medicine"
            subtitle="fy25 obligations excluding facilities s-codes · place of performance"
          />
        ) : activeState.status === "done" && active && active.kind === "facilities-awards-map" ? (
          <FacilitiesAwardsMapView />
        ) : activeState.status === "done" && active && active.kind === "scode-map" ? (
          <MoneyMapView
            snap={moneyMapScode as never}
            kicker="Business as usual"
            title="The floor is everywhere the flag flies"
            subtitle="fy25 s-code obligations · place of performance"
          />
        ) : activeState.status === "done" && active && active.kind === "middle-band" ? (
          <MiddleBandView />
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
