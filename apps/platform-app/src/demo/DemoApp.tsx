/**
 * DemoApp — orchestrates the Rare Structure cockpit.
 *
 * A free-form, operator-driven instrument — not a scripted walkthrough. The
 * operator opens ⌘K at any time and runs a command:
 *
 *   map-query  → the US map lights up with the matching companies; clicking
 *                a company dot opens its profile and Capital Catalysts.
 *   aggregate  → the map is replaced by a chart of the same universe.
 *
 * The loop is repeatable: run a command, explore, ⌘K again. ⌘K toggles the
 * palette; Esc backs out one layer at a time (palette → profile → aggregate).
 *
 * `data.ts` is the single data module — fixtures today, the platform-api BFF
 * later. This component owns the whole cockpit surface; the route that
 * renders it (`src/routes/MapDemo.tsx`) authors no geometry.
 */

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AggregateView } from "./AggregateView";
import { MapView } from "./MapView";
import { PhraseAggregateView } from "./PhraseAggregateView";
import { QueryWorkbench } from "./QueryWorkbench";
import { ResultsTable } from "./ResultsTable";
import { CommandPalette } from "./components/CommandPalette";
import { EntityProfile } from "./components/EntityProfile";
import { SubUniverseConsole } from "./components/SubUniverseConsole";
import { SuboutConsole } from "./components/SuboutConsole";
import { SuboutProfile } from "./components/SuboutProfile";
import type { ResultView } from "./components/TerminalChrome";
import { type QueryResult, runQuery, scopeIsToggleable } from "./data";
import { fetchActiveAwardsQuery, fetchSubUniverse, fetchSuboutOpportunities } from "./federalApi";
import { projectLonLat } from "./projection";
import {
  type SubUniverseGateParams,
  type SubUniverseLayer,
  type SubUniverseResponse,
  buildSubUniverseLayer,
  defaultGateParams,
} from "./subUniverse";
import {
  type SuboutMode,
  type SuboutOpportunity,
  type SuboutPlot,
  type SuboutResponse,
  plotSubout,
} from "./subout";
import type { AggregateSpec, Command, Company, MapQuery } from "./types";
import { useDefaultResultView } from "./useDefaultResultView";

export function DemoApp({ embedded = false }: { embedded?: boolean }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState<MapQuery | null>(null);
  const [aggregate, setAggregate] = useState<AggregateSpec | null>(null);
  // A free-typed `total …` sentence — the AGGREGATE grammar. Rendered by
  // PhraseAggregateView (which owns its own fetch); mutually exclusive with
  // the canned `aggregate` spec above.
  const [aggregatePhrase, setAggregatePhrase] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  // The operator's GLOBAL default surface for a fresh map-query — persisted (localStorage),
  // synced across tabs, set ONLY via the pre-query header toggle. Seeds to Table: live entities
  // have no coordinates yet (geo deferred), so the table is the useful rendering until dots land.
  const [defaultView, setDefaultView] = useDefaultResultView("table");
  // The ACTIVE view for the current result. Seeds from the global default and is reset to it on
  // every new query; the post-query banner toggle flips THIS only — a per-query local override
  // that never rewrites the global default.
  const [resultView, setResultView] = useState<ResultView>(defaultView);
  // Scope-display toggle: false (default) shows the plain-English query; true shows the
  // raw compiled plan (the disclosure surface). Resets to English on each new query.
  const [scopeRaw, setScopeRaw] = useState(false);
  // The deterministic query workbench — a cockpit MODE (third header-toggle segment), not a
  // result view: it replaces the map pane wholesale and never touches the persisted default.
  // The pane stays mounted while closed so composed filters and the last run survive toggling.
  const [workbenchOpen, setWorkbenchOpen] = useState(false);

  // The map-query result set is now REMOTE (the BFF's warm federal snapshot), so it is a
  // 3-state async load: loading / error / data. The chart surface (AggregateView) owns
  // its own async load against the precomputed chart endpoints.
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The sub-out opportunities layer — an independent per-UEI overlay on the map
  // surface (it coexists with a map-query result; Esc clears it last-in-first-out).
  const [suboutUei, setSuboutUei] = useState<string | null>(null);
  // Which recipe answers: "relationships" (v3 — who they know) | "combos"
  // (lookalike sub-combo POV). Toggled on the console; refetches on flip.
  const [suboutMode, setSuboutMode] = useState<SuboutMode>("relationships");
  const [suboutResponse, setSuboutResponse] = useState<SuboutResponse | null>(null);
  const [suboutLoading, setSuboutLoading] = useState(false);
  const [suboutError, setSuboutError] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<SuboutOpportunity | null>(null);

  // The sub-UNIVERSE layer — the eligible-buyer map for one sub's UEI. The fetch
  // fires once per UEI; the GATES (params) re-evaluate CLIENT-SIDE only, so a
  // parameter change lights/dims dots without touching the wire.
  const [subUniverseUei, setSubUniverseUei] = useState<string | null>(null);
  const [subUniverseResponse, setSubUniverseResponse] = useState<SubUniverseResponse | null>(null);
  const [subUniverseLoading, setSubUniverseLoading] = useState(false);
  const [subUniverseError, setSubUniverseError] = useState<string | null>(null);
  // Seeded from target.defaults when the response lands; null while dormant/loading.
  const [subUniverseParams, setSubUniverseParams] = useState<SubUniverseGateParams | null>(null);
  // The clicked buyer dot, by UEI — the evaluated node is derived from the layer
  // memo so its dim reasons track live parameter changes.
  const [subUniverseSelectedUei, setSubUniverseSelectedUei] = useState<string | null>(null);

  // ⌘K toggles the palette from anywhere; Esc backs out one layer at a time.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
      if (e.key === "Escape") {
        if (commandOpen) {
          setCommandOpen(false);
        } else if (workbenchOpen) {
          setWorkbenchOpen(false); // pane stays mounted — composed filters survive
        } else if (selectedOpportunity) {
          setSelectedOpportunity(null);
        } else if (subUniverseSelectedUei) {
          setSubUniverseSelectedUei(null);
        } else if (selectedCompany) {
          setSelectedCompany(null);
        } else if (subUniverseUei) {
          setSubUniverseUei(null);
        } else if (suboutUei) {
          setSuboutUei(null);
        } else if (aggregatePhrase) {
          setAggregatePhrase(null);
        } else if (aggregate) {
          setAggregate(null);
        } else if (query) {
          setQuery(null);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    commandOpen,
    workbenchOpen,
    selectedOpportunity,
    subUniverseSelectedUei,
    selectedCompany,
    subUniverseUei,
    suboutUei,
    aggregatePhrase,
    aggregate,
    query,
  ]);

  // Running any command closes the palette and the open profile; a map-query
  // lights up the map, an aggregate swaps the map for the chart.
  const handleRun = useCallback(
    (command: Command) => {
      setCommandOpen(false);
      setSelectedCompany(null);
      setWorkbenchOpen(false); // an ⌘K command targets the map/chart surface, not the bench
      if (command.kind === "active-awards") {
        // Q1 canonical query — resolved slots POST to the active-awards engine;
        // the rows land as an ALREADY-RESOLVED QueryResult (composed: no refetch).
        setAggregate(null);
        setAggregatePhrase(null);
        setScopeRaw(false);
        setResultView("table");
        setQuery({ nl: command.label, minAward: 0, composed: true });
        setResult(null);
        setError(null);
        setLoading(true);
        fetchActiveAwardsQuery({
          // No grain marker on event verbs (Q3); the edge 422s if grain rides along.
          ...(command.mode === "events" ? {} : { grain: command.grain }),
          mode: command.mode,
          event_verb: command.eventVerb,
          window_days: command.windowDays,
          job_phrase: command.jobPhrase,
          state: command.stateCode,
          hq_state: command.hqState,
          industry: command.industry,
          need: command.need,
          min_amt: command.minAmt,
        })
          .then((res) => {
            const companies: Company[] = res.rows.map((r) => {
              const geo =
                typeof r.longitude === "number" && typeof r.latitude === "number"
                  ? projectLonLat(r.longitude, r.latitude)
                  : null;
              return {
                id: r.uei,
                name: r.legal_business_name ?? r.uei,
                naics: "",
                city: r.physical_city ?? undefined,
                state: r.physical_state ?? undefined,
                // Event rows carry event_obl (the money the events moved); Q1/Q2 carry
                // active_total_obl. Either maps to the table's totalAwarded axis.
                totalAwarded: r.event_obl ?? r.active_total_obl ?? 0,
                activeAwarded: r.event_obl ?? r.active_total_obl ?? 0,
                contractCount: r.event_actions ?? r.active_award_ct ?? undefined,
                activeAward: true,
                catalysts: [],
                ...(geo ? { x: geo.x, y: geo.y } : {}),
              };
            });
            setResult({
              companies,
              total: res.total,
              minLifetimeBound: 0,
              fullUniverse: res.total,
              materializedAt: typeof res.artifact === "string" ? res.artifact : "",
              profileAsOfDate: null,
              interpretedTitle: command.label,
            });
            setLoading(false);
          })
          .catch((e) => {
            setError(e instanceof Error ? e.message : "query failed");
            setLoading(false);
          });
      } else if (command.kind === "map-query") {
        setAggregate(null);
        setAggregatePhrase(null);
        setResultView(defaultView); // each new query starts from the global default
        setScopeRaw(false); // and starts showing plain English, not the raw plan
        setQuery(command.query);
      } else if (command.kind === "aggregate-phrase") {
        setAggregate(null);
        setAggregatePhrase(command.phrase);
      } else {
        setAggregatePhrase(null);
        setAggregate(command.aggregate);
      }
    },
    [defaultView],
  );

  // Header-toggle handlers for the workbench mode: the third segment opens it; clicking
  // Map/Table inside the workbench exits back to the picked view (applied to the current
  // result when one is active).
  const openWorkbench = useCallback(() => setWorkbenchOpen(true), []);
  const exitWorkbenchToView = useCallback((v: ResultView) => {
    setWorkbenchOpen(false);
    setResultView(v);
  }, []);

  // "Plot on map" — the workbench hands its result set over as an ALREADY-RESOLVED
  // QueryResult; the display query is composed (the effect below never re-fetches it).
  const handlePlot = useCallback((qr: QueryResult, title: string) => {
    setWorkbenchOpen(false);
    setAggregate(null);
    setSelectedCompany(null);
    setResultView("map");
    setQuery({ nl: title, minAward: 0, composed: true });
    setResult(qr);
    setError(null);
    setLoading(false);
  }, []);

  // Fetch the live result set whenever the map-query changes. Guarded against a stale
  // resolve clobbering a newer query (the classic out-of-order fetch race).
  useEffect(() => {
    if (!query) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (query.composed) return; // plotted from the workbench — already resolved
    let cancelled = false;
    setLoading(true);
    setError(null);
    runQuery(query)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "query failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Fetch the sub-out layer whenever the target UEI changes. Same stale-resolve
  // guard as the map-query effect; clearing the UEI clears the whole layer.
  useEffect(() => {
    if (!suboutUei) {
      setSuboutResponse(null);
      setSuboutError(null);
      setSuboutLoading(false);
      setSelectedOpportunity(null);
      return;
    }
    let cancelled = false;
    setSuboutLoading(true);
    setSuboutError(null);
    setSuboutResponse(null);
    setSelectedOpportunity(null);
    fetchSuboutOpportunities({ uei: suboutUei, mode: suboutMode })
      .then((r) => {
        if (!cancelled) setSuboutResponse(r);
      })
      .catch((e) => {
        if (!cancelled) setSuboutError(e instanceof Error ? e.message : "sub-out query failed");
      })
      .finally(() => {
        if (!cancelled) setSuboutLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [suboutUei, suboutMode]);

  // Project the wire rows onto the viewBox once per response (pure; memo keeps the
  // dot layer's identity stable across unrelated re-renders).
  const suboutPlot: SuboutPlot | null = useMemo(
    () =>
      suboutResponse
        ? plotSubout(suboutResponse.data.opportunities, suboutResponse.meta.target_hq)
        : null,
    [suboutResponse],
  );

  // Fetch the sub-universe whenever the sub's UEI changes — the ONLY wire trigger
  // for this layer (gates never re-fetch). Same stale-resolve guard as above.
  // Gate params seed from target.defaults on arrival.
  useEffect(() => {
    if (!subUniverseUei) {
      setSubUniverseResponse(null);
      setSubUniverseError(null);
      setSubUniverseLoading(false);
      setSubUniverseParams(null);
      setSubUniverseSelectedUei(null);
      return;
    }
    let cancelled = false;
    setSubUniverseLoading(true);
    setSubUniverseError(null);
    setSubUniverseResponse(null);
    setSubUniverseParams(null);
    setSubUniverseSelectedUei(null);
    fetchSubUniverse({ uei: subUniverseUei })
      .then((r) => {
        if (cancelled) return;
        setSubUniverseResponse(r);
        setSubUniverseParams(defaultGateParams(r.target));
      })
      .catch((e) => {
        if (!cancelled)
          setSubUniverseError(e instanceof Error ? e.message : "sub-universe query failed");
      })
      .finally(() => {
        if (!cancelled) setSubUniverseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subUniverseUei]);

  // Plot + gate-evaluate in one pure pass. Params changes re-run THIS memo only —
  // dots light/dim client-side, nothing refetches, no node is ever removed.
  const subUniverseLayer: SubUniverseLayer | null = useMemo(
    () =>
      subUniverseResponse && subUniverseParams
        ? buildSubUniverseLayer(subUniverseResponse.data, subUniverseParams)
        : null,
    [subUniverseResponse, subUniverseParams],
  );

  // The selected buyer node, re-derived from the live layer so its evaluation
  // (dim reasons) tracks parameter changes.
  const selectedSubUniverseNode = useMemo(
    () =>
      subUniverseLayer && subUniverseSelectedUei
        ? (subUniverseLayer.plotted.find((n) => n.uei === subUniverseSelectedUei) ?? null)
        : null,
    [subUniverseLayer, subUniverseSelectedUei],
  );

  const results = result?.companies ?? [];
  // A free-typed /ask query may resolve to an AGGREGATE (breakdown/total/distribution/top-N)
  // rather than rows — the response shape drives the view. Only when NOT loading, so the
  const showingAggregate = !!aggregate || !!aggregatePhrase;

  return (
    <div
      data-cockpit-view={workbenchOpen ? "workbench" : showingAggregate ? "aggregate" : "map"}
      className="relative h-screen w-full overflow-hidden bg-[color:var(--color-surface-base)]"
    >
      {/* Always mounted (hidden when closed) so composed filters + the last run survive
          toggling back to the map. The catalog fetch is deferred until first open. */}
      <QueryWorkbench
        open={workbenchOpen}
        embedded={embedded}
        onExitToView={exitWorkbenchToView}
        onInvokeCommand={() => setCommandOpen(true)}
        onPlot={handlePlot}
      />

      <AnimatePresence mode="wait">
        {workbenchOpen ? null : aggregatePhrase ? (
          <PhraseAggregateView
            key={`aggregate-phrase:${aggregatePhrase}`}
            phrase={aggregatePhrase}
            onInvokeCommand={() => setCommandOpen(true)}
          />
        ) : aggregate ? (
          <AggregateView
            key="aggregate"
            spec={aggregate}
            onInvokeCommand={() => setCommandOpen(true)}
          />
        ) : query && resultView === "table" ? (
          <ResultsTable
            key="table"
            query={query}
            results={results}
            loading={loading}
            error={error}
            total={result?.total ?? results.length}
            notApplied={result?.notApplied ?? []}
            interpretedTitle={result?.interpretedTitle ?? null}
            selectedId={selectedCompany?.id ?? null}
            onSelectCompany={(company) => setSelectedCompany(company)}
            onInvokeCommand={() => setCommandOpen(true)}
            onDismiss={() => setQuery(null)}
            embedded={embedded}
            resultView={resultView}
            onResultView={setResultView}
            onWorkbench={openWorkbench}
            scopeRaw={scopeRaw}
            onToggleScope={
              scopeIsToggleable(query, result?.interpretedTitle ?? null)
                ? () => setScopeRaw((v) => !v)
                : undefined
            }
          />
        ) : (
          <MapView
            key="map"
            query={query}
            results={results}
            loading={loading}
            error={error}
            total={result?.total ?? results.length}
            notApplied={result?.notApplied ?? []}
            interpretedTitle={result?.interpretedTitle ?? null}
            profileAsOfDate={result?.profileAsOfDate ?? null}
            selectedId={selectedCompany?.id ?? null}
            onSelectCompany={(company) => setSelectedCompany(company)}
            onInvokeCommand={() => setCommandOpen(true)}
            onDismiss={() => setQuery(null)}
            embedded={embedded}
            resultView={resultView}
            onResultView={setResultView}
            defaultView={defaultView}
            onDefaultView={setDefaultView}
            onWorkbench={openWorkbench}
            scopeRaw={scopeRaw}
            onToggleScope={
              scopeIsToggleable(query, result?.interpretedTitle ?? null)
                ? () => setScopeRaw((v) => !v)
                : undefined
            }
            subout={suboutPlot}
            suboutSelectedId={selectedOpportunity?.generated_unique_award_id ?? null}
            onSelectOpportunity={(o) => setSelectedOpportunity(o)}
            subUniverse={subUniverseLayer}
            subUniverseSelectedUei={subUniverseSelectedUei}
            onSelectSubUniverseNode={(n) => setSubUniverseSelectedUei(n.uei)}
          />
        )}
      </AnimatePresence>

      {/* The sub-out console rides the MAP surface only — the workbench/aggregate
          panes own their whole viewport. */}
      {!workbenchOpen && !showingAggregate && (!query || resultView === "map") && (
        <SuboutConsole
          activeUei={suboutUei}
          loading={suboutLoading}
          error={suboutError}
          response={suboutResponse}
          plot={suboutPlot}
          mode={suboutMode}
          onMode={setSuboutMode}
          onRun={(uei) => setSuboutUei(uei)}
          onClear={() => setSuboutUei(null)}
        />
      )}

      {/* The sub-universe console — bottom-left (SuboutConsole owns bottom-right),
          same map-surface-only gating. */}
      {!workbenchOpen && !showingAggregate && (!query || resultView === "map") && (
        <SubUniverseConsole
          activeUei={subUniverseUei}
          loading={subUniverseLoading}
          error={subUniverseError}
          response={subUniverseResponse}
          layer={subUniverseLayer}
          params={subUniverseParams}
          onParams={setSubUniverseParams}
          onRun={(uei) => setSubUniverseUei(uei)}
          onClear={() => setSubUniverseUei(null)}
          selected={selectedSubUniverseNode}
          onClearSelected={() => setSubUniverseSelectedUei(null)}
        />
      )}

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onRun={handleRun} />
      <EntityProfile company={selectedCompany} onClose={() => setSelectedCompany(null)} />
      <SuboutProfile
        opportunity={selectedOpportunity}
        targetUei={suboutUei}
        onClose={() => setSelectedOpportunity(null)}
      />
    </div>
  );
}
