/**
 * SuboutConsole — the floating UEI console that drives the sub-out map layer.
 *
 * A compact top-right instrument on the map surface: enter a 12-char SAM UEI →
 * the sub-out opportunities light up as work-site dots (target HQ pinned).
 * The chip below the input renders the load state honestly: plotted vs
 * unplotted counts, catalyst's cache_state, the empty-market reason, and any
 * wire notes — never a silent zero.
 */

import { motion } from "framer-motion";
import { Crosshair, X } from "lucide-react";
import { useState } from "react";
import { type SuboutPlot, type SuboutResponse, isValidUei } from "../subout";

export function SuboutConsole({
  activeUei,
  loading,
  error,
  response,
  plot,
  onRun,
  onClear,
}: {
  /** The UEI the current layer was fetched for (null = layer dormant). */
  activeUei: string | null;
  loading: boolean;
  error: string | null;
  response: SuboutResponse | null;
  plot: SuboutPlot | null;
  onRun: (uei: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState("");
  const draftValid = isValidUei(draft);

  function submit() {
    if (!draftValid) return;
    onRun(draft.trim().toUpperCase());
    setDraft("");
  }

  return (
    <motion.div
      className="absolute top-16 right-6 z-10 flex w-72 flex-col gap-1.5"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-lg shadow-black/40">
        <div className="flex items-center gap-2 border-[color:var(--color-border-subtle)] border-r px-3 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
          <Crosshair className="size-3.5" />
          Sub-out
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Enter UEI"
          maxLength={12}
          spellCheck={false}
          aria-label="Target UEI for sub-out opportunities"
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
              aria-label="Clear sub-out layer"
              onClick={onClear}
              className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {loading ? (
            <span className="text-[color:var(--color-text-muted)]">
              Scoring open awards… first hit can take a few seconds
            </span>
          ) : error ? (
            <span className="text-[color:var(--color-state-warn)]">{error}</span>
          ) : response ? (
            <>
              <span className="text-[color:var(--color-text-muted)]">
                {response.meta.total.toLocaleString("en-US")} opportunities ·{" "}
                {plot?.plotted.length ?? 0} on map
                {plot && plot.unplotted.length > 0 ? ` · ${plot.unplotted.length} no geo` : ""}
              </span>
              {response.meta.reason && (
                <span className="text-[color:var(--color-state-warn)]">{response.meta.reason}</span>
              )}
              {plot && !plot.hq && !response.meta.reason && (
                <span className="text-[color:var(--color-text-subtle)]">HQ not geocoded</span>
              )}
            </>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
