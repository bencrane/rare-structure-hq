/**
 * ResultsTable — the full-surface table rendering of a map-query result.
 *
 * The toggle counterpart to `MapView`: same `QueryResult.companies`, rendered as its own page
 * within the cockpit (like `AggregateView`) rather than a panel floating over the map. Sortable
 * by company / location / federal $; a row opens the company's profile drawer. Same-name legal
 * entities are already collapsed upstream (`data.runAsk`), so each row is a distinct company.
 */

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { CommandPill, type ResultView, TerminalHeader } from "./components/TerminalChrome";
import { industryLabel, resultScopeCell } from "./data";
import { promoteDossier } from "./dossierCache";
import { fmtUsd } from "./format";
import type { Company, MapQuery } from "./types";

// A generous render bound — the cockpit's densest verticals stay smooth without virtualization.
// Sorted by federal $ desc by default, so the cap keeps the heaviest companies; the footer is
// honest about any tail beyond it.
const TABLE_MAX = 1000;

type SortKey = "award" | "name" | "location";

export function ResultsTable({
  query,
  results,
  loading = false,
  error = null,
  total,
  notApplied = [],
  interpretedTitle = null,
  selectedId,
  onSelectCompany,
  onInvokeCommand,
  onDismiss,
  embedded = false,
  resultView,
  onResultView,
}: {
  query: MapQuery | null;
  results: Company[];
  loading?: boolean;
  error?: string | null;
  total?: number;
  /** NL-query constraints the compiler could not express — rendered as "not applied". */
  notApplied?: string[];
  /** The `/ask` compiler's interpretation of an NL query — the banner's "Scope" value. */
  interpretedTitle?: string | null;
  selectedId: string | null;
  onSelectCompany: (company: Company) => void;
  onInvokeCommand: () => void;
  onDismiss?: () => void;
  embedded?: boolean;
  resultView: ResultView;
  onResultView: (v: ResultView) => void;
}) {
  const reduced = !!useReducedMotion();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "award",
    dir: "desc",
  });

  const awards = results.reduce((sum, c) => sum + c.totalAwarded, 0);
  const scope = resultScopeCell(query, interpretedTitle);

  const sorted = useMemo(() => {
    const list = [...results];
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === "award") return (a.totalAwarded - b.totalAwarded) * dir;
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      return (a.state ?? "").localeCompare(b.state ?? "") * dir || a.name.localeCompare(b.name);
    });
    return list;
  }, [results, sort]);

  const shown = sorted.slice(0, TABLE_MAX);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "location" ? "asc" : "desc" },
    );
  }

  return (
    <motion.div
      className="relative flex h-screen w-full flex-col overflow-hidden"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="rs-scanlines pointer-events-none absolute inset-0 opacity-50" />

      <TerminalHeader
        reduced={reduced}
        showBrand={!embedded}
        view={resultView}
        onView={onResultView}
        onClear={onDismiss}
      />

      <div className="relative flex min-h-0 flex-1 flex-col items-center px-6 pt-2 pb-4">
        {/* Summary banner — the Map/Table toggle + Clear live in the terminal header (top-right). */}
        <div className="flex w-full max-w-[1180px] items-center gap-2 pb-3">
          <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
            <BannerCell label={scope.label} value={scope.value} accent />
            <BannerCell
              label="Companies"
              value={
                loading ? "…" : error ? "—" : (total ?? results.length).toLocaleString("en-US")
              }
            />
            <BannerCell
              label="Federal awards"
              value={loading ? "…" : error ? "—" : fmtUsd(awards)}
            />
          </div>
          {/* The honesty signal: a query constraint the compiler could not run. */}
          {!loading && !error && notApplied.length > 0 && (
            <div className="border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase shadow-lg shadow-black/40">
              Not applied: {notApplied.join(" · ")}
            </div>
          )}
        </div>

        {/* The table surface. */}
        <div className="flex min-h-0 w-full max-w-[1180px] flex-1 flex-col border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
          {error ? (
            <div className="flex flex-1 items-center justify-center p-10 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
              Live federal feed unavailable
            </div>
          ) : loading ? (
            <div className="flex flex-1 items-center justify-center p-10 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
              Querying the market…
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-10 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
              No companies match
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[color:var(--color-surface-raised)]">
                  <tr className="border-[color:var(--color-border-subtle)] border-b">
                    <th className="w-12 px-4 py-2.5 text-right font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                      #
                    </th>
                    <SortHeader label="Company" active={sort} sortKey="name" onSort={toggleSort} />
                    <SortHeader
                      label="Location"
                      active={sort}
                      sortKey="location"
                      onSort={toggleSort}
                    />
                    <th className="px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                      Industry
                    </th>
                    <SortHeader
                      label="Federal $"
                      active={sort}
                      sortKey="award"
                      onSort={toggleSort}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c, i) => (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      onMouseEnter={() => promoteDossier(c.id)}
                      onClick={() => onSelectCompany(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectCompany(c);
                        }
                      }}
                      className={`cursor-pointer border-[color:var(--color-border-subtle)] border-b transition-colors ${
                        c.id === selectedId
                          ? "bg-[color:var(--color-accent-soft)]"
                          : "hover:bg-[color:var(--color-surface-base)]"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-right font-mono text-[color:var(--color-text-subtle)] text-mono-xs tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5 text-[color:var(--color-text-primary)] text-body-sm">
                        {c.name}
                        {c.relatedEntities && c.relatedEntities > 1 ? (
                          <span className="ml-2 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
                            · {c.relatedEntities} entities
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                        {c.city ? `${c.city}, ` : ""}
                        {c.state ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[color:var(--color-text-muted)] text-body-sm">
                        {c.naicsLabel ?? industryLabel(c.industry)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-display font-semibold text-[color:var(--color-text-accent)] text-body-sm tabular-nums">
                        {fmtUsd(c.totalAwarded)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sorted.length > TABLE_MAX && (
                <div className="border-[color:var(--color-border-subtle)] border-t px-4 py-2.5 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
                  Showing top {TABLE_MAX.toLocaleString("en-US")} of{" "}
                  {sorted.length.toLocaleString("en-US")} — refine the query to narrow
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CommandPill reduced={reduced} idle={!query} onClick={onInvokeCommand} />
    </motion.div>
  );
}

function SortHeader({
  label,
  active,
  sortKey,
  onSort,
  align = "left",
}: {
  label: string;
  active: { key: SortKey; dir: "asc" | "desc" };
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const on = active.key === sortKey;
  return (
    <th className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`font-mono text-mono-xs uppercase transition-colors ${
          on
            ? "text-[color:var(--color-text-accent)]"
            : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
        }`}
      >
        {label}
        {on ? <span className="ml-1">{active.dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

function BannerCell({
  label,
  value,
  accent = false,
}: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-[color:var(--color-border-subtle)] border-r px-5 py-2.5 last:border-r-0">
      <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 font-display font-semibold text-body-sm uppercase tracking-tight tabular-nums ${
          accent
            ? "text-[color:var(--color-text-accent)]"
            : "text-[color:var(--color-text-primary)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
