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

import { Play } from "lucide-react";
import { useState } from "react";

import { Text } from "@rare-structure-hq/ui";

import { AggregateView } from "@/demo/AggregateView";
import {
  type AggregatePhraseResponse,
  fetchAggregatePhrase,
  toResolvedAggregate,
} from "@/demo/aggregatePhrase";

type Beat = {
  id: string;
  /** Act kicker shown above the beat (the narrative arc marker). */
  act: string;
  /** The rail label — what the operator sees while narrating. */
  title: string;
  /** The recipe — fired verbatim against the deterministic compiler. */
  phrase: string;
};

// The script. Ordered; each entry is one click of the presentation.
const SCRIPT: Beat[] = [
  {
    id: "industries-fy23-25",
    act: "Act 1 · The market",
    title: "Total awarded by industry",
    phrase: "total awarded by industry fy23 to fy25",
  },
];

type BeatState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; response: AggregatePhraseResponse }
  | { status: "error"; message: string };

export default function DemoTour() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, BeatState>>({});

  const setBeatState = (id: string, s: BeatState) =>
    setStates((prev) => ({ ...prev, [id]: s }));

  async function runBeat(beat: Beat) {
    setActiveId(beat.id);
    const current = states[beat.id];
    if (current?.status === "done" || current?.status === "loading") return;
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

  return (
    <div className="grid h-screen grid-cols-[20rem_minmax(0,1fr)] bg-[color:var(--color-surface-base)]">
      {/* ── The script rail ──────────────────────────────────────────────── */}
      <aside className="flex h-full flex-col overflow-y-auto border-[color:var(--color-border-subtle)] border-r bg-[color:var(--color-surface-sunken)]">
        <div className="border-[color:var(--color-border-subtle)] border-b px-5 py-4">
          <Text as="div" size="mono-xs" mono color="accent" className="uppercase tracking-[0.18em]">
            Guided tour
          </Text>
          <Text as="div" size="mono-xs" mono color="subtle" className="mt-1 uppercase tracking-[0.12em]">
            Every beat is a query
          </Text>
        </div>

        <div className="flex-1 py-3">
          {SCRIPT.map((beat, i) => {
            const st: BeatState = states[beat.id] ?? { status: "idle" };
            const isActive = beat.id === activeId;
            return (
              <div key={beat.id} className="px-3 py-1">
                <Text
                  as="div"
                  size="mono-xs"
                  mono
                  color="subtle"
                  className="px-2 pt-2 pb-1 uppercase tracking-[0.14em]"
                >
                  {beat.act}
                </Text>
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
                  {st.status === "done" && (
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
        {activeState.status === "done" && active ? (
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
