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
import { QueryWorkbench } from "./QueryWorkbench";
import { ResultsTable } from "./ResultsTable";
import { CommandPalette } from "./components/CommandPalette";
import { EntityProfile } from "./components/EntityProfile";
import { SuboutConsole } from "./components/SuboutConsole";
import { SuboutProfile } from "./components/SuboutProfile";
import type { ResultView } from "./components/TerminalChrome";
import { type QueryResult, runQuery } from "./data";
import { fetchSuboutOpportunities } from "./federalApi";
import { type SuboutOpportunity, type SuboutPlot, type SuboutResponse, plotSubout } from "./subout";
import type { AggregateSpec, Command, Company, MapQuery } from "./types";
import { useDefaultResultView } from "./useDefaultResultView";

export function DemoApp({ embedded = false }: { embedded?: boolean }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState<MapQuery | null>(null);
  const [aggregate, setAggregate] = useState<AggregateSpec | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  // The operator's GLOBAL default surface for a fresh map-query — persisted (localStorage),
  // synced across tabs, set ONLY via the pre-query header toggle. Seeds to Table: live entities
  // have no coordinates yet (geo deferred), so the table is the useful rendering until dots land.
  const [defaultView, setDefaultView] = useDefaultResultView("table");
  // The ACTIVE view for the current result. Seeds from the global default and is reset to it on
  // every new query; the post-query banner toggle flips THIS only — a per-query local override
  // that never rewrites the global default.
  const [resultView, setResultView] = useState<ResultView>(defaultView);
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
  const [suboutResponse, setSuboutResponse] = useState<SuboutResponse | null>(null);
  const [suboutLoading, setSuboutLoading] = useState(false);
  const [suboutError, setSuboutError] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<SuboutOpportunity | null>(null);

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
        } else if (selectedCompany) {
          setSelectedCompany(null);
        } else if (suboutUei) {
          setSuboutUei(null);
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
    selectedCompany,
    suboutUei,
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
      if (command.kind === "map-query") {
        setAggregate(null);
        setResultView(defaultView); // each new query starts from the global default
        setQuery(command.query);
      } else {
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

  // Flip the serving dataset on the current NL query — re-fires the query-watching effect
  // (which keys on `query`) so the result re-resolves against the newly pinned table.
  const handleDataset = useCallback(
    (dataset: NonNullable<MapQuery["dataset"]>) => setQuery((q) => (q ? { ...q, dataset } : q)),
    [],
  );

  // Fetch the live result set whenever the map-query changes. Guarded against a stale
  // resolve clobbering a newer query (the classic out-of-order fetch race).
  useEffect(() => {
    if (!query) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }
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
    fetchSuboutOpportunities({ uei: suboutUei })
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
  }, [suboutUei]);

  // Project the wire rows onto the viewBox once per response (pure; memo keeps the
  // dot layer's identity stable across unrelated re-renders).
  const suboutPlot: SuboutPlot | null = useMemo(
    () =>
      suboutResponse
        ? plotSubout(suboutResponse.data.opportunities, suboutResponse.meta.target_hq)
        : null,
    [suboutResponse],
  );

  const results = result?.companies ?? [];
  // A free-typed /ask query may resolve to an AGGREGATE (breakdown/total/distribution/top-N)
  // rather than rows — the response shape drives the view. Only when NOT loading, so the
  // chart doesn't flash a stale aggregate from the previous query mid-fetch.
  const dynamicAggregate = !loading ? (result?.aggregate ?? null) : null;
  const showingAggregate = !!aggregate || !!dynamicAggregate;

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
      />

      <AnimatePresence mode="wait">
        {workbenchOpen ? null : aggregate ? (
          <AggregateView
            key="aggregate"
            spec={aggregate}
            onInvokeCommand={() => setCommandOpen(true)}
          />
        ) : dynamicAggregate ? (
          <AggregateView
            key="dyn-aggregate"
            resolved={dynamicAggregate}
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
            onDataset={handleDataset}
            onWorkbench={openWorkbench}
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
            onDataset={handleDataset}
            defaultView={defaultView}
            onDefaultView={setDefaultView}
            onWorkbench={openWorkbench}
            subout={suboutPlot}
            suboutSelectedId={selectedOpportunity?.generated_unique_award_id ?? null}
            onSelectOpportunity={(o) => setSelectedOpportunity(o)}
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
          onRun={(uei) => setSuboutUei(uei)}
          onClear={() => setSuboutUei(null)}
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
