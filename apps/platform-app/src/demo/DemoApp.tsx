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
import { CommandPalette } from "./components/CommandPalette";
import { CompanyProfile } from "./components/CompanyProfile";
import { runQuery } from "./data";
import type { AggregateSpec, Command, Company, MapQuery } from "./types";

export function DemoApp() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState<MapQuery | null>(null);
  const [aggregate, setAggregate] = useState<AggregateSpec | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

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
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, selectedCompany, aggregate]);

  // Running any command closes the palette and the open profile; a map-query
  // lights up the map, an aggregate swaps the map for the chart.
  const handleRun = useCallback((command: Command) => {
    setCommandOpen(false);
    setSelectedCompany(null);
    if (command.kind === "map-query") {
      setAggregate(null);
      setQuery(command.query);
    } else {
      setAggregate(command.aggregate);
    }
  }, []);

  const results = query ? runQuery(query) : [];

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
        ) : (
          <MapView
            key="map"
            query={query}
            results={results}
            selectedId={selectedCompany?.id ?? null}
            onSelectCompany={(company) => setSelectedCompany(company)}
            onInvokeCommand={() => setCommandOpen(true)}
          />
        )}
      </AnimatePresence>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onRun={handleRun} />
      <CompanyProfile company={selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  );
}
