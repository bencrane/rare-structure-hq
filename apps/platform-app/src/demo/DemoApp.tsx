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
import { useCallback, useEffect, useState } from "react";
import { AggregateView } from "./AggregateView";
import { MapView } from "./MapView";
import { ResultsTable } from "./ResultsTable";
import { CommandPalette } from "./components/CommandPalette";
import { CompanyProfile } from "./components/CompanyProfile";
import type { ResultView } from "./components/TerminalChrome";
import { type QueryResult, runQuery } from "./data";
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

  // The map-query result set is now REMOTE (the BFF's warm federal snapshot), so it is a
  // 3-state async load: loading / error / data. The chart surface (AggregateView) owns
  // its own async load against the precomputed chart endpoints.
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        } else if (selectedCompany) {
          setSelectedCompany(null);
        } else if (aggregate) {
          setAggregate(null);
        } else if (query) {
          setQuery(null);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, selectedCompany, aggregate, query]);

  // Running any command closes the palette and the open profile; a map-query
  // lights up the map, an aggregate swaps the map for the chart.
  const handleRun = useCallback(
    (command: Command) => {
      setCommandOpen(false);
      setSelectedCompany(null);
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

  const results = result?.companies ?? [];

  return (
    <div
      data-cockpit-view={aggregate ? "aggregate" : "map"}
      className="relative h-screen w-full overflow-hidden bg-[color:var(--color-surface-base)]"
    >
      <AnimatePresence mode="wait">
        {aggregate ? (
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
            selectedId={selectedCompany?.id ?? null}
            onSelectCompany={(company) => setSelectedCompany(company)}
            onInvokeCommand={() => setCommandOpen(true)}
            onDismiss={() => setQuery(null)}
            embedded={embedded}
            resultView={resultView}
            onResultView={setResultView}
          />
        ) : (
          <MapView
            key="map"
            query={query}
            results={results}
            loading={loading}
            error={error}
            total={result?.total ?? results.length}
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
          />
        )}
      </AnimatePresence>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onRun={handleRun} />
      <CompanyProfile company={selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  );
}
