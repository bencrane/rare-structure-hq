/**
 * SubUniverseConsole — the floating UEI console that drives the sub-UNIVERSE
 * map layer (the eligible-buyer universe for one sub).
 *
 * A compact bottom-left instrument on the map surface (the sub-out console owns
 * bottom-right): enter a 12-char SAM UEI → the buyers whose farm-out lanes
 * overlap the sub's demonstrated combos land as dots. The tunable gates below
 * (MVS floor, repeat depth, prime-backed, combo + vehicle filters) re-evaluate
 * CLIENT-SIDE only — a gate change lights/dims dots instantly, never re-fetches,
 * and never deletes a node. The status chip renders the load honestly: lit/dim
 * counts, the no-geo count, catalyst's cache_state, and the empty reason —
 * never a silent zero. A clicked dot's facts (and, when dimmed, every failing
 * gate's reason) render in the panel at the bottom of the stack.
 */

import { motion } from "framer-motion";
import { Radar, X } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtUsd } from "../format";
import {
  type EvaluatedSubUniverseNode,
  type SubUniverseGateParams,
  type SubUniverseLayer,
  type SubUniverseResponse,
  comboOptions,
  vehicleOptions,
} from "../subUniverse";
import { isValidUei } from "../subout";

/** Toggle one value in a multi-select list; empty normalizes to null (= all). */
function toggleIn(list: string[] | null, value: string): string[] | null {
  const cur = list ?? [];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return next.length === 0 ? null : next;
}

export function SubUniverseConsole({
  activeUei,
  loading,
  error,
  response,
  layer,
  params,
  onParams,
  onRun,
  onClear,
  selected,
  onClearSelected,
}: {
  /** The UEI the current layer was fetched for (null = layer dormant). */
  activeUei: string | null;
  loading: boolean;
  error: string | null;
  response: SubUniverseResponse | null;
  layer: SubUniverseLayer | null;
  params: SubUniverseGateParams | null;
  onParams: (p: SubUniverseGateParams) => void;
  onRun: (uei: string) => void;
  onClear: () => void;
  /** The clicked buyer dot (with its live evaluation) — null = nothing selected. */
  selected: EvaluatedSubUniverseNode | null;
  onClearSelected: () => void;
}) {
  const [draft, setDraft] = useState("");
  const draftValid = isValidUei(draft);

  const combos = useMemo(
    () => (response ? comboOptions(response.target, response.data) : []),
    [response],
  );
  const vehicles = useMemo(
    () => (response ? vehicleOptions(response.target, response.data) : []),
    [response],
  );

  function submit() {
    if (!draftValid) return;
    onRun(draft.trim().toUpperCase());
    setDraft("");
  }

  return (
    <motion.div
      className="absolute bottom-6 left-6 z-10 flex w-80 flex-col gap-1.5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
        <div className="flex items-center gap-2 border-[color:var(--color-border-subtle)] border-r px-3 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
          <Radar className="size-3.5" />
          Universe
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Enter sub UEI"
          maxLength={12}
          spellCheck={false}
          aria-label="Sub UEI for the eligible-buyer universe"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[color:var(--color-text-primary)] text-mono-xs uppercase tracking-wider outline-none placeholder:text-[color:var(--color-text-subtle)]"
        />
        {draft && (
          <button
            type="button"
            onClick={submit}
            disabled={!draftValid}
            className="border-[color:var(--color-border-subtle)] border-l px-3 font-mono text-mono-xs uppercase transition-colors disabled:text-[color:var(--color-text-subtle)] enabled:text-[color:var(--color-text-accent)] enabled:hover:text-[color:var(--color-text-primary)]"
          >
            Run
          </button>
        )}
      </div>

      {(activeUei || loading || error) && (
        <div className="flex flex-col gap-1 border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-mono text-mono-xs uppercase shadow-lg shadow-black/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[color:var(--color-text-accent)]">{activeUei ?? "…"}</span>
            <button
              type="button"
              aria-label="Clear sub-universe layer"
              onClick={onClear}
              className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {loading ? (
            <span className="text-[color:var(--color-text-muted)]">
              Mapping the buyer universe… first hit can take a few seconds
            </span>
          ) : error ? (
            <span className="text-[color:var(--color-state-warn)]">{error}</span>
          ) : response && layer ? (
            <>
              <span className="text-[color:var(--color-text-muted)]">
                {layer.litCount.toLocaleString("en-US")} lit ·{" "}
                {layer.dimCount.toLocaleString("en-US")} dim ·{" "}
                {response.meta.returned.toLocaleString("en-US")} buyers
                {layer.unplotted.length > 0 ? ` · ${layer.unplotted.length} no geo` : ""}
              </span>
              <span className="text-[color:var(--color-text-subtle)]">
                Cache: {response.meta.cache_state}
                {response.meta.capped
                  ? ` · capped (${response.meta.total.toLocaleString("en-US")} total)`
                  : ""}
              </span>
              {response.meta.reason && (
                <span className="text-[color:var(--color-state-warn)]">{response.meta.reason}</span>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* The gates — every change re-evaluates client-side only (no re-fetch). */}
      {!loading && !error && response && params && (
        <div className="flex flex-col gap-2 border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-mono text-mono-xs uppercase shadow-lg shadow-black/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[color:var(--color-text-muted)]">MVS floor $</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={params.mvsUsd ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v === "") {
                  onParams({ ...params, mvsUsd: null });
                } else {
                  const n = Number(v);
                  if (Number.isFinite(n) && n >= 0) onParams({ ...params, mvsUsd: n });
                }
              }}
              placeholder="off"
              aria-label="Minimum viable subcontract floor in USD (empty = off)"
              className="w-28 border border-[color:var(--color-border-subtle)] bg-transparent px-2 py-1 text-right text-[color:var(--color-text-primary)] tabular-nums outline-none placeholder:text-[color:var(--color-text-subtle)]"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[color:var(--color-text-muted)]">Repeat depth</span>
            <div className="flex items-stretch border border-[color:var(--color-border-subtle)]">
              {([null, 2, 3, 5] as const).map((k) => (
                <button
                  key={k ?? "off"}
                  type="button"
                  aria-pressed={params.repeatK === k}
                  onClick={() => onParams({ ...params, repeatK: k })}
                  className={`px-2 py-1 transition-colors ${
                    params.repeatK === k
                      ? "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-accent)]"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
                  }`}
                >
                  {k ?? "off"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[color:var(--color-text-muted)]">Prime-backed only</span>
            <button
              type="button"
              aria-pressed={params.primeBackedOnly}
              onClick={() => onParams({ ...params, primeBackedOnly: !params.primeBackedOnly })}
              className={`border border-[color:var(--color-border-subtle)] px-2 py-1 transition-colors ${
                params.primeBackedOnly
                  ? "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-accent)]"
                  : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
              }`}
            >
              {params.primeBackedOnly ? "on" : "off"}
            </button>
          </div>

          <ChipGroup
            label="Combos"
            options={combos}
            selected={params.combos}
            onToggle={(combo) => onParams({ ...params, combos: toggleIn(params.combos, combo) })}
          />
          <ChipGroup
            label="Vehicles"
            options={vehicles}
            selected={params.vehiclePiids}
            onToggle={(piid) =>
              onParams({ ...params, vehiclePiids: toggleIn(params.vehiclePiids, piid) })
            }
          />
        </div>
      )}

      {/* The clicked buyer — facts + (when dimmed) every failing gate's reason. */}
      {selected && (
        <div className="flex flex-col gap-1 border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-mono text-mono-xs uppercase shadow-lg shadow-black/40">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[color:var(--color-text-accent)]">
              {selected.name ?? selected.uei}
            </span>
            <button
              type="button"
              aria-label="Clear selected buyer"
              onClick={onClearSelected}
              className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <span className="text-[color:var(--color-text-muted)]">
            {selected.uei} · {fmtUsd(selected.matched_farmout_60mo)} matched ·{" "}
            {selected.n_matched_combos} combos
          </span>
          {selected.evaluation.status === "dim" ? (
            <>
              <span className="text-[color:var(--color-state-warn)]">Dimmed</span>
              {selected.evaluation.reasons.map((reason) => (
                <span key={reason} className="text-[color:var(--color-text-muted)]">
                  · {reason}
                </span>
              ))}
            </>
          ) : (
            <span className="text-[color:var(--color-text-accent)]">Lit</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** A labeled multi-select chip row. Empty selection = all pass (gate off). */
function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[] | null;
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  const picked = new Set(selected ?? []);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[color:var(--color-text-muted)]">
        {label}
        {picked.size === 0 ? " · all" : ` · ${picked.size} selected`}
      </span>
      <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={picked.has(opt)}
            onClick={() => onToggle(opt)}
            className={`max-w-full truncate border border-[color:var(--color-border-subtle)] px-1.5 py-0.5 transition-colors ${
              picked.has(opt)
                ? "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-accent)]"
                : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
