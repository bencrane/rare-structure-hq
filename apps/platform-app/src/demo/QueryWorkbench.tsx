/**
 * QueryWorkbench — the operator's testing surface for the DETERMINISTIC federal map
 * query engine.
 *
 * Replaces the map pane (third segment of the header toggle). Clay-style filter rows —
 * "Where <field> <op> <value>" — composed explicitly against the catalyst field catalog:
 * the field dropdown is populated ONLY from `/api/v1/federal/query-fields`, the op
 * dropdown is constrained to that field's published ops, and the value editor adapts to
 * the (type, op, enum) triple. No LLM, no sentence routing — every logical condition is
 * tested explicitly, and an unsupported axis surfaces as catalyst's 422 detail VERBATIM
 * instead of failing silently.
 *
 * Dataset tabs are CATALOG-DRIVEN: the Gen-3 `entities` dataset leads, and datasets the
 * payload flags `legacy: true` (the retiring Gen-2 five) are hidden outright — with a
 * graceful degrade when the payload is stale (see `visibleWorkbenchDatasets`). Fields the
 * payload marks with `codes` (naics | psc | agency) — with a name-heuristic fallback for
 * stale payloads — get a registry typeahead (`CodeValueEditor`) instead of free text.
 *
 * The component stays MOUNTED (hidden) when closed so composed rows and the last result
 * survive toggling back to the map — it is a bench, not a dialog. The catalog fetch is
 * deferred until first open.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { CommandPill, TerminalHeader } from "./components/TerminalChrome";
import type { ResultView } from "./components/TerminalChrome";
import { type QueryResult, workbenchResultToQueryResult } from "./data";
import { fetchPhrase } from "./federalApi";
import {
  type WorkbenchQueryMeta,
  fetchQueryCodes,
  fetchQueryFields,
  runWorkbenchQuery,
} from "./federalApi";
import type { CodeSuggestion, WorkbenchFeature } from "./federalApi";
import { type PhraseMeta, type PhrasePlanStep, bindingLabel, planStepToComposer } from "./phrase";
import type { AggregateBar } from "./types";
import {
  type CodeRegistry,
  type ComposedFilter,
  WORKBENCH_DATASETS,
  WORKBENCH_LIMIT,
  type WorkbenchCatalog,
  type WorkbenchDataset,
  type WorkbenchFieldDef,
  type WorkbenchOp,
  type WorkbenchRow,
  codeRegistryForField,
  composeFilters,
  createRow,
  valueEditorKind,
  visibleWorkbenchDatasets,
} from "./workbench";

/** One executed run — the meta AND the exact body that produced it, pinned together so
 * the readout can never drift from what actually ran. */
type WorkbenchResult = {
  dataset: WorkbenchDataset;
  features: WorkbenchFeature[];
  meta: WorkbenchQueryMeta;
  executed: { filters: ComposedFilter[]; limit: number };
};

export function QueryWorkbench({
  open,
  embedded = false,
  onExitToView,
  onInvokeCommand,
  onPlot,
}: {
  /** The pane stays mounted when closed (state survives); `open` only gates display
   * and defers the catalog fetch until the first open. */
  open: boolean;
  embedded?: boolean;
  /** Header Map/Table click — exits the workbench back to the picked result view. */
  onExitToView: (v: ResultView) => void;
  onInvokeCommand: () => void;
  /** "Plot on map" — hand the current result set to the map surface as dots
   * (the primary-query mechanism drives the map; no separate decoder query). */
  onPlot?: (qr: QueryResult, title: string) => void;
}) {
  // ── Field catalog (fetched once, on first open) ────────────────────────────
  const [catalog, setCatalog] = useState<WorkbenchCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Fetch once on first open; a failure parks in catalogError (the Retry button clears
  // it, which re-arms this effect). `catalogLoading` is deliberately NOT a dep — the
  // effect sets it itself, and re-running on that write would cancel the in-flight fetch.
  useEffect(() => {
    if (!open || catalog || catalogError) return;
    let cancelled = false;
    setCatalogLoading(true);
    fetchQueryFields()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((e) => {
        if (!cancelled) setCatalogError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, catalog, catalogError]);

  // ── Composition state ──────────────────────────────────────────────────────
  const [dataset, setDataset] = useState<WorkbenchDataset>(WORKBENCH_DATASETS[0].key);
  const [rows, setRows] = useState<WorkbenchRow[]>(() => [createRow()]);

  // Tabs are CATALOG-DRIVEN: legacy datasets are hidden outright; a stale payload
  // (no entities / no legacy flags) degrades to whatever exists — never a blank strip.
  const visibleTabs = useMemo(() => visibleWorkbenchDatasets(catalog), [catalog]);

  // If the active dataset isn't among the visible tabs once the catalog lands (e.g.
  // "entities" seeded against a stale catalyst), snap to the first visible one.
  useEffect(() => {
    if (!catalog) return;
    const visible = visibleWorkbenchDatasets(catalog);
    setDataset((cur) => (visible.some((d) => d.key === cur) ? cur : visible[0].key));
  }, [catalog]);

  // ── Run state ──────────────────────────────────────────────────────────────
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkbenchResult | null>(null);
  const [showExecutedJson, setShowExecutedJson] = useState(false);

  const datasetCatalog = catalog?.datasets[dataset] ?? null;
  const fields = datasetCatalog?.fields ?? [];
  const fieldMap = useMemo(() => {
    const m: Record<string, WorkbenchFieldDef> = {};
    for (const f of fields) m[f.name] = f;
    return m;
  }, [fields]);

  const { filters, incompleteIds } = useMemo(
    () => composeFilters(rows, fieldMap),
    [rows, fieldMap],
  );
  const incomplete = new Set(incompleteIds);

  function switchDataset(next: WorkbenchDataset) {
    if (next === dataset) return;
    // Fields differ per dataset — a composed row is meaningless across the switch.
    setDataset(next);
    setRows([createRow()]);
    setResult(null);
    setRunError(null);
  }

  function patchRow(id: string, patch: Partial<WorkbenchRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // The phrase compiler POPULATES the composer from its plan's terminal step —
  // the phrase layer visibly compiles INTO the deterministic layer.
  function populateFromPlan(step: PhrasePlanStep) {
    const next = planStepToComposer(step);
    setDataset(next.dataset);
    setRows(next.rows);
    setResult(null);
    setRunError(null);
  }

  function setRowField(id: string, fieldName: string) {
    // New field → reset op to its first supported op and clear all value state.
    const def = fieldMap[fieldName];
    patchRow(id, {
      field: fieldName,
      op: def?.ops[0] ?? "",
      value: "",
      value2: "",
      values: [],
    });
  }

  function setRowOp(id: string, op: WorkbenchOp) {
    // Op changes can change the editor shape (scalar↔list↔between) — clear values.
    patchRow(id, { op, value: "", value2: "", values: [] });
  }

  async function run() {
    const executed = { filters, limit: WORKBENCH_LIMIT };
    setRunning(true);
    setRunError(null);
    try {
      const res = await runWorkbenchQuery(dataset, executed);
      setResult({ dataset, features: res.data.features, meta: res.meta, executed });
    } catch (e) {
      // 422 detail (verbatim) or network/5xx — rendered in the error strip, never swallowed.
      setRunError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  const runBlocked = incompleteIds.length > 0;

  // Hand the current rows to the map as dots. The scope line is the executed
  // filter set, verbatim — the banner stays a disclosure, never a paraphrase.
  function plotOnMap() {
    if (!result || !onPlot) return;
    const title = `${result.dataset} · ${result.executed.filters
      .map(
        (f) =>
          `${f.field} ${f.op} ${Array.isArray(f.value) ? `[${f.value.length}]` : String(f.value)}`,
      )
      .join(" · ")}`;
    onPlot(workbenchResultToQueryResult(result.dataset, result.features, title), title);
  }

  // Columns = union of property keys across returned features, first-seen order.
  const columns = useMemo(() => {
    if (!result) return [];
    const cols: string[] = [];
    for (const f of result.features) {
      for (const k of Object.keys(f.properties ?? {})) {
        if (!cols.includes(k)) cols.push(k);
      }
    }
    return cols;
  }, [result]);

  return (
    <div className={open ? undefined : "hidden"}>
      <div className="relative flex h-screen w-full flex-col overflow-hidden">
        <div className="rs-scanlines pointer-events-none absolute inset-0 opacity-50" />

        <TerminalHeader
          reduced
          showBrand={!embedded}
          view="workbench"
          onView={onExitToView}
          onWorkbench={() => {}}
        />

        <div className="relative flex min-h-0 flex-1 flex-col items-center px-6 pt-2 pb-4">
          {/* ── Builder card: dataset tabs + filter rows + run ──────────────── */}
          <div className="w-full max-w-[1180px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
            <div className="flex items-center justify-between border-[color:var(--color-border-subtle)] border-b px-4 py-2.5">
              <div className="font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                Query workbench · deterministic
                {datasetCatalog && (
                  <span className="ml-2 text-[color:var(--color-text-subtle)]">
                    decoder {datasetCatalog.decoderVersion}
                  </span>
                )}
              </div>
              {/* Dataset tabs — catalog-driven (legacy datasets hidden). No AUTO.
                  Rendered only once the catalog lands so retiring tabs never flash. */}
              {catalog && (
                <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-base)]">
                  {visibleTabs.map((d, i) => (
                    <span key={d.key} className="flex items-stretch">
                      {i > 0 && (
                        <span className="w-px self-stretch bg-[color:var(--color-border-subtle)]" />
                      )}
                      <button
                        type="button"
                        onClick={() => switchDataset(d.key)}
                        aria-pressed={dataset === d.key}
                        title={`Query the ${d.label} dataset`}
                        className={`px-2.5 py-1.5 font-mono text-mono-xs uppercase transition-colors ${
                          dataset === d.key
                            ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                            : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
                        }`}
                      >
                        {d.label}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <PhraseBar onPopulate={populateFromPlan} />

            {/* Catalog states — loading / failed (verbatim) / loaded rows. */}
            {catalogLoading ? (
              <div className="px-4 py-6 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                Loading field catalog…
              </div>
            ) : catalogError ? (
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="min-w-0 flex-1 border border-[color:var(--color-state-error)] bg-[color:var(--color-state-errorSoft)] px-3 py-2 font-mono text-[color:var(--color-state-error)] text-mono-xs">
                  FIELD CATALOG UNAVAILABLE — {catalogError}
                </div>
                <button
                  type="button"
                  onClick={() => setCatalogError(null)}
                  className="border border-[color:var(--color-border-strong)] px-3 py-2 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase transition-colors hover:text-[color:var(--color-text-accent)]"
                >
                  Retry
                </button>
              </div>
            ) : !datasetCatalog ? (
              catalog && (
                <div className="px-4 py-6 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                  No fields published for this dataset
                </div>
              )
            ) : (
              <div className="px-4 py-3">
                {rows.map((row, i) => (
                  <FilterRow
                    key={row.id}
                    row={row}
                    first={i === 0}
                    fields={fields}
                    fieldMap={fieldMap}
                    incomplete={incomplete.has(row.id)}
                    onField={(f) => setRowField(row.id, f)}
                    onOp={(op) => setRowOp(row.id, op)}
                    onPatch={(patch) => patchRow(row.id, patch)}
                    onRemove={() =>
                      setRows((rs) => {
                        const next = rs.filter((r) => r.id !== row.id);
                        return next.length > 0 ? next : [createRow()];
                      })
                    }
                  />
                ))}
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setRows((rs) => [...rs, createRow()])}
                    className="border border-[color:var(--color-border-strong)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase transition-colors hover:text-[color:var(--color-text-accent)]"
                  >
                    + Add filter
                  </button>
                  <div className="flex items-center gap-3">
                    {runBlocked && (
                      <span className="font-mono text-[color:var(--color-state-warn)] text-mono-xs uppercase">
                        {incompleteIds.length} row{incompleteIds.length === 1 ? "" : "s"} need a
                        value
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={run}
                      disabled={running || runBlocked}
                      className={`border px-4 py-1.5 font-mono text-mono-xs uppercase transition-colors ${
                        running || runBlocked
                          ? "cursor-not-allowed border-[color:var(--color-border-default)] text-[color:var(--color-text-subtle)]"
                          : "border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)] hover:bg-[color:var(--color-accent-primary)] hover:text-[color:var(--color-text-onAccent)]"
                      }`}
                    >
                      {running ? "Running…" : "Run query"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Error strip — 422 detail / network failure, VERBATIM. ───────── */}
          {runError && (
            <div className="mt-3 w-full max-w-[1180px] border border-[color:var(--color-state-error)] bg-[color:var(--color-state-errorSoft)] px-4 py-2.5 font-mono text-[color:var(--color-state-error)] text-mono-xs shadow-lg shadow-black/40">
              {runError}
            </div>
          )}

          {/* ── Meta bar + executed-filter JSON ─────────────────────────────── */}
          {result && (
            <div className="mt-3 flex w-full max-w-[1180px] flex-wrap items-stretch gap-2">
              <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
                <MetaCell label="Dataset" value={result.meta.dataset} accent />
                <MetaCell label="Total" value={result.meta.total.toLocaleString("en-US")} />
                <MetaCell label="Returned" value={result.meta.returned.toLocaleString("en-US")} />
                <MetaCell label="Plottable" value={result.meta.plottable.toLocaleString("en-US")} />
                <MetaCell label="Capped" value={result.meta.capped ? "Yes" : "No"} />
                <MetaCell label="Decoder" value={result.meta.decoderVersion} />
              </div>
              <button
                type="button"
                onClick={() => setShowExecutedJson((s) => !s)}
                aria-expanded={showExecutedJson}
                className="border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase shadow-lg shadow-black/40 transition-colors hover:text-[color:var(--color-text-accent)]"
              >
                Filter JSON {showExecutedJson ? "▴" : "▾"}
              </button>
              {onPlot && result.features.length > 0 && (
                <button
                  type="button"
                  onClick={plotOnMap}
                  className="border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase shadow-lg shadow-black/40 transition-colors hover:bg-[color:var(--color-accent-soft)]"
                >
                  Plot on map ({result.meta.plottable})
                </button>
              )}
            </div>
          )}
          {result && showExecutedJson && (
            <pre className="mt-2 max-h-48 w-full max-w-[1180px] overflow-auto border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-base)] px-4 py-3 font-mono text-[color:var(--color-text-default)] text-mono-xs leading-relaxed shadow-lg shadow-black/40">
              {JSON.stringify(result.executed, null, 2)}
            </pre>
          )}

          {/* ── Results surface ─────────────────────────────────────────────── */}
          <div className="mt-3 flex min-h-0 w-full max-w-[1180px] flex-1 flex-col border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
            {running ? (
              <div className="flex flex-1 items-center justify-center p-10 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                Running query…
              </div>
            ) : !result ? (
              <div className="flex flex-1 items-center justify-center p-10 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                {runError ? "Query failed — see the error above" : "Compose filters and run"}
              </div>
            ) : result.features.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-10 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                No rows match
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-[color:var(--color-surface-raised)]">
                    <tr className="border-[color:var(--color-border-subtle)] border-b">
                      <th className="w-12 px-4 py-2.5 text-right font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                        #
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="whitespace-nowrap px-4 py-2.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.features.map((f, i) => (
                      <tr
                        // Feature rows carry no stable id on the wire — positional keys are
                        // safe here because the list is replaced wholesale per run.
                        key={`row-${i}-${String(f.properties?.uei ?? f.properties?.award_id ?? "")}`}
                        className="border-[color:var(--color-border-subtle)] border-b transition-colors hover:bg-[color:var(--color-surface-base)]"
                      >
                        <td className="px-4 py-2.5 text-right font-mono text-[color:var(--color-text-subtle)] text-mono-xs tabular-nums">
                          {i + 1}
                        </td>
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="whitespace-nowrap px-4 py-2.5 font-mono text-[color:var(--color-text-default)] text-mono-xs tabular-nums"
                          >
                            {fmtCell(f.properties?.[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <CommandPill reduced idle={false} onClick={onInvokeCommand} />
      </div>
    </div>
  );
}

// ── One Clay-style filter row: WHERE|AND [field ▾] [op ▾] [value] [✕] ────────

function FilterRow({
  row,
  first,
  fields,
  fieldMap,
  incomplete,
  onField,
  onOp,
  onPatch,
  onRemove,
}: {
  row: WorkbenchRow;
  first: boolean;
  fields: WorkbenchFieldDef[];
  fieldMap: Record<string, WorkbenchFieldDef>;
  incomplete: boolean;
  onField: (field: string) => void;
  onOp: (op: WorkbenchOp) => void;
  onPatch: (patch: Partial<WorkbenchRow>) => void;
  onRemove: () => void;
}) {
  const def = row.field ? fieldMap[row.field] : undefined;
  const op: WorkbenchOp | "" = def
    ? row.op !== "" && def.ops.includes(row.op)
      ? row.op
      : (def.ops[0] ?? "")
    : "";

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-14 shrink-0 pt-1.5 text-right font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
        {first ? "Where" : "And"}
      </span>

      {/* Field — populated ONLY from the catalog. */}
      <select
        value={row.field}
        onChange={(e) => onField(e.target.value)}
        aria-label="Filter field"
        className="w-64 shrink-0 border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-base)] px-2 py-1.5 font-mono text-[color:var(--color-text-primary)] text-mono-xs"
      >
        <option value="">— field —</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
            {f.gated ? " (gated)" : ""}
          </option>
        ))}
      </select>

      {/* Op — constrained to the field's published ops. */}
      <select
        value={op}
        onChange={(e) => onOp(e.target.value as WorkbenchOp)}
        disabled={!def}
        aria-label="Filter operator"
        className="w-24 shrink-0 border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-base)] px-2 py-1.5 font-mono text-[color:var(--color-text-primary)] text-mono-xs disabled:text-[color:var(--color-text-subtle)]"
      >
        {def ? (
          def.ops.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))
        ) : (
          <option value="">—</option>
        )}
      </select>

      {/* Value — the editor adapts to (type, op, enum). */}
      <div className="min-w-0 flex-1">
        {def && op !== "" ? (
          <ValueEditor row={row} def={def} op={op} onPatch={onPatch} />
        ) : (
          <div className="border border-[color:var(--color-border-default)] px-2 py-1.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs">
            pick a field
          </div>
        )}
        {incomplete && (
          <div className="mt-1 font-mono text-[color:var(--color-state-warn)] text-mono-xs uppercase">
            Value required
          </div>
        )}
      </div>

      {/* Type tag — the operator sees the wire type they are testing against. */}
      <span className="w-16 shrink-0 pt-1.5 text-right font-mono text-[color:var(--color-text-subtle)] text-mono-xs">
        {def?.type ?? ""}
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        title="Remove filter"
        className="shrink-0 border border-[color:var(--color-border-strong)] px-2 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs transition-colors hover:text-[color:var(--color-state-error)]"
      >
        ✕
      </button>
    </div>
  );
}

function ValueEditor({
  row,
  def,
  op,
  onPatch,
}: {
  row: WorkbenchRow;
  def: WorkbenchFieldDef;
  op: WorkbenchOp;
  onPatch: (patch: Partial<WorkbenchRow>) => void;
}) {
  const kind = valueEditorKind(def, op);
  const inputCls =
    "w-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-base)] px-2 py-1.5 font-mono text-[color:var(--color-text-primary)] text-mono-xs placeholder:text-[color:var(--color-text-subtle)]";

  if (kind === "between") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={row.value}
          onChange={(e) => onPatch({ value: e.target.value })}
          placeholder="min"
          aria-label="Between lower bound"
          className={inputCls}
        />
        <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs">–</span>
        <input
          type="number"
          value={row.value2}
          onChange={(e) => onPatch({ value2: e.target.value })}
          placeholder="max"
          aria-label="Between upper bound"
          className={inputCls}
        />
      </div>
    );
  }

  if (kind === "code-multi" || kind === "code-single") {
    return (
      <CodeValueEditor
        row={row}
        codeType={codeRegistryForField(def) ?? "naics"}
        single={kind === "code-single"}
        onPatch={onPatch}
      />
    );
  }

  if (kind === "enum-multi") {
    return (
      <div className="flex max-h-24 flex-wrap content-start gap-1 overflow-y-auto border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-base)] p-1.5">
        {(def.enum ?? []).map((v) => {
          const active = row.values.includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onPatch({
                  values: active ? row.values.filter((x) => x !== v) : [...row.values, v],
                })
              }
              className={`border px-1.5 py-0.5 font-mono text-mono-xs transition-colors ${
                active
                  ? "border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
                  : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>
    );
  }

  if (kind === "enum-single") {
    return (
      <select
        value={row.value}
        onChange={(e) => onPatch({ value: e.target.value })}
        aria-label="Filter value"
        className={inputCls}
      >
        <option value="">— value —</option>
        {(def.enum ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "bool") {
    return (
      <select
        value={row.value}
        onChange={(e) => onPatch({ value: e.target.value })}
        aria-label="Filter value"
        className={inputCls}
      >
        <option value="">— value —</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (kind === "number") {
    return (
      <input
        type="number"
        value={row.value}
        onChange={(e) => onPatch({ value: e.target.value })}
        placeholder={def.type === "days_ago" ? "days (e.g. 90)" : "number"}
        aria-label="Filter value"
        className={inputCls}
      />
    );
  }

  // text | text-list — open-valued string / list.
  return (
    <input
      type="text"
      value={row.value}
      onChange={(e) => onPatch({ value: e.target.value })}
      placeholder={kind === "text-list" ? "comma-separated values" : "value"}
      aria-label="Filter value"
      className={inputCls}
    />
  );
}

// ── Code typeahead — search-as-you-type against the naics/psc/agency registries ──

/**
 * The code-field value editor: chips + a debounced (~200ms) search input against
 * `/api/v1/federal/query-codes`. Selecting a suggestion adds a chip; typing an exact
 * code and pressing Enter adds it WITHOUT selecting (plain text entry stays possible —
 * and an un-entered exact code still composes at run time, see `composeFilters`).
 * `single` (scalar op) replaces the chip instead of accumulating.
 */
function CodeValueEditor({
  row,
  codeType,
  single,
  onPatch,
}: {
  row: WorkbenchRow;
  codeType: CodeRegistry;
  single: boolean;
  onPatch: (patch: Partial<WorkbenchRow>) => void;
}) {
  const [suggestions, setSuggestions] = useState<CodeSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Monotonic sequence — a late resolve from a superseded query never lands.
  const seqRef = useRef(0);

  const q = row.value.trim();

  useEffect(() => {
    const seq = ++seqRef.current;
    if (q === "") {
      // Empty q is a 422 upstream — never fetched; the dropdown just closes.
      setSuggestions(null);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetchQueryCodes(codeType, q)
        .then((list) => {
          if (seqRef.current !== seq) return;
          setSuggestions(list);
          setSearchError(null);
        })
        .catch((e) => {
          if (seqRef.current !== seq) return;
          setSuggestions([]);
          setSearchError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (seqRef.current === seq) setSearching(false);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [q, codeType]);

  function addCode(code: string) {
    const trimmed = code.trim();
    if (trimmed === "") return;
    const values = single
      ? [trimmed]
      : row.values.includes(trimmed)
        ? row.values
        : [...row.values, trimmed];
    onPatch({ values, value: "" }); // clearing the input also closes the dropdown
  }

  const dropdownOpen = q !== "" && (searching || suggestions !== null);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1 border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-base)] p-1.5">
        {row.values.map((code) => (
          <span
            key={code}
            className="flex items-center gap-1 border border-[color:var(--color-accent-primary)] bg-[color:var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[color:var(--color-text-accent)] text-mono-xs"
          >
            {code}
            <button
              type="button"
              onClick={() => onPatch({ values: row.values.filter((v) => v !== code) })}
              aria-label={`Remove code ${code}`}
              title={`Remove code ${code}`}
              className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-state-error)]"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          value={row.value}
          onChange={(e) => onPatch({ value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCode(row.value); // exact typed code — no selection required
            } else if (e.key === "Escape" && dropdownOpen) {
              // Close the dropdown only; don't let the cockpit's global Esc
              // layering close the whole workbench mid-edit.
              e.stopPropagation();
              onPatch({ value: "" });
            }
          }}
          placeholder={`search ${codeType} codes or type an exact code`}
          aria-label="Filter value"
          className="min-w-40 flex-1 bg-transparent font-mono text-[color:var(--color-text-primary)] text-mono-xs outline-none placeholder:text-[color:var(--color-text-subtle)]"
        />
      </div>
      {dropdownOpen && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
          {searching ? (
            <div className="px-2 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
              Searching…
            </div>
          ) : searchError ? (
            <div className="px-2 py-1.5 font-mono text-[color:var(--color-state-error)] text-mono-xs">
              {searchError}
            </div>
          ) : suggestions && suggestions.length === 0 ? (
            <div className="px-2 py-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
              No codes match
            </div>
          ) : (
            (suggestions ?? []).map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => addCode(s.code)}
                className="block w-full px-2 py-1.5 text-left font-mono text-mono-xs transition-colors hover:bg-[color:var(--color-surface-base)]"
              >
                <span className="text-[color:var(--color-text-accent)]">{s.code}</span>
                <span className="text-[color:var(--color-text-muted)]"> — {s.description}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Readout cells + cell formatting ──────────────────────────────────────────

function MetaCell({
  label,
  value,
  accent = false,
}: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-[color:var(--color-border-subtle)] border-r px-4 py-1.5 last:border-r-0">
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

/** Honest, lossless-ish cell rendering: numbers localized, everything else verbatim. */
function fmtCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-US") : String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.map((x) => fmtCell(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ── Phrase bar — the deterministic compiler front door (phrase.v1) ───────────
// Type a vocabulary phrase → catalyst compiles it (zero LLM) → the bindings and
// plan render verbatim and the composer rows POPULATE from the terminal step.
// A refusal surfaces the 422 detail naming the token — the teaching surface.
function PhraseBar({ onPopulate }: { onPopulate: (step: PhrasePlanStep) => void }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PhraseMeta | null>(null);
  const [aggBars, setAggBars] = useState<AggregateBar[] | null>(null);

  async function run() {
    const phrase = draft.trim();
    if (!phrase || busy) return;
    setBusy(true);
    setError(null);
    setMeta(null);
    setAggBars(null);
    try {
      const res = await fetchPhrase(phrase);
      setMeta(res.meta);
      if (res.meta.mode === "aggregate") {
        // 'total …' phrases return BARS, not a filter plan — there is nothing
        // to populate the composer with; render the result inline instead.
        setAggBars(res.data.bars ?? []);
      } else {
        const terminal = res.meta.plan[res.meta.plan.length - 1];
        if (terminal) onPopulate(terminal);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "phrase failed");
    } finally {
      setBusy(false);
    }
  }

  const bindings = (meta?.bindings ?? []).map(bindingLabel).filter(Boolean);

  return (
    <div className="border-[color:var(--color-border-subtle)] border-b px-4 py-3">
      <div className="flex items-stretch gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder='phrase — e.g. "construction companies that received a code A mod in the last 90 days"'
          spellCheck={false}
          aria-label="Deterministic phrase"
          className="min-w-0 flex-1 border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-sunken)] px-3 py-2 font-mono text-[color:var(--color-text-primary)] text-mono-xs outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-text-accent)]"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !draft.trim()}
          className="border border-[color:var(--color-border-strong)] px-4 font-mono text-mono-xs uppercase transition-colors disabled:text-[color:var(--color-text-subtle)] enabled:text-[color:var(--color-text-accent)] enabled:hover:text-[color:var(--color-text-primary)]"
        >
          {busy ? "Compiling…" : "Compile"}
        </button>
      </div>

      {error && (
        <div className="mt-2 border border-[color:var(--color-state-error)] bg-[color:var(--color-state-errorSoft)] px-3 py-2 font-mono text-[color:var(--color-state-error)] text-mono-xs">
          {error}
        </div>
      )}

      {meta && (
        <div className="mt-2 flex flex-col gap-1 font-mono text-mono-xs">
          <div className="text-[color:var(--color-text-muted)] uppercase">
            {meta.mode === "aggregate"
              ? `${meta.compilerVersion} · aggregate · ${meta.totalGroups ?? 0} groups · ${meta.title ?? ""}`
              : `${meta.compilerVersion} · grain ${meta.grain} · ${meta.plan.length}-step plan · ${
                  typeof meta.total === "number" ? `${meta.total.toLocaleString("en-US")} matches` : ""
                }${meta.step1 ? ` · step 1: ${meta.step1.distinct_recipients} recipients` : ""} · composer populated from the plan`}
          </div>
          <div className="text-[color:var(--color-text-subtle)]">{bindings.join("  ·  ")}</div>
          {aggBars && (
            <div className="mt-1 flex flex-col gap-0.5 text-[color:var(--color-text-primary)]">
              {aggBars.slice(0, 8).map((b) => (
                <div key={b.key} className="flex justify-between gap-4">
                  <span>{b.label}</span>
                  <span className="text-[color:var(--color-text-muted)]">
                    ${b.total.toLocaleString("en-US", { maximumFractionDigits: 0 })} · {b.count.toLocaleString("en-US")}
                  </span>
                </div>
              ))}
              {aggBars.length > 8 && (
                <div className="text-[color:var(--color-text-subtle)]">
                  +{aggBars.length - 8} more groups
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
