/**
 * TerminalChrome — the cockpit's shared chrome: the terminal header and the
 * ⌘K command pill. Both the map and the aggregate-chart surfaces wear them,
 * so the operator's screen reads as one coherent instrument.
 */

import { motion } from "framer-motion";
import { Crosshair, type LucideIcon, Map as MapIcon, Table2 as TableIcon } from "lucide-react";
import { TRACKED_ENTITIES } from "../data";

/** The result-view selector — flips a map-query result between the geographic dot map and the
 * full results table. Lives in the result banner so it travels with the summary, in both views. */
export type ResultView = "map" | "table";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ResultView;
  onChange: (v: ResultView) => void;
}) {
  return (
    <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)]">
      <ViewToggleButton
        active={view === "map"}
        onClick={() => onChange("map")}
        label="Map"
        Icon={MapIcon}
      />
      <span className="w-px self-stretch bg-[color:var(--color-border-subtle)]" />
      <ViewToggleButton
        active={view === "table"}
        onClick={() => onChange("table")}
        label="Table"
        Icon={TableIcon}
      />
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-3.5 py-2.5 font-mono text-mono-xs uppercase tracking-[0.12em] transition-colors ${
        active
          ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

/** The compact, icon-only result-view selector that lives in the terminal header,
 * pre-query. Sets the operator's GLOBAL default (persisted) for which surface a
 * fresh map-query renders — distinct from the post-query banner ViewToggle above,
 * which is a per-query local override. */
export function DefaultViewToggle({
  view,
  onChange,
}: {
  view: ResultView;
  onChange: (v: ResultView) => void;
}) {
  return (
    <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)]">
      <DefaultViewToggleButton
        active={view === "map"}
        onClick={() => onChange("map")}
        label="Map"
        Icon={MapIcon}
      />
      <span className="w-px self-stretch bg-[color:var(--color-border-subtle)]" />
      <DefaultViewToggleButton
        active={view === "table"}
        onClick={() => onChange("table")}
        label="Table"
        Icon={TableIcon}
      />
    </div>
  );
}

function DefaultViewToggleButton({
  active,
  onClick,
  label,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Set ${label} as the default view`}
      title={`Set ${label} as the default view`}
      className={`flex items-center justify-center px-2 py-1.5 transition-colors ${
        active
          ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-accent)]"
          : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      }`}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/** The fixed terminal header — wordmark, terminal name, live entity count, and
 * (pre-query only) the persisted default-view selector. */
export function TerminalHeader({
  reduced,
  showBrand = true,
  defaultView,
  onDefaultView,
}: {
  reduced: boolean;
  /** Hide the wordmark + terminal name when the map is embedded in the
   * authenticated cockpit — the sidebar already carries the brand there. */
  showBrand?: boolean;
  /** When both are provided, render the compact default-view toggle in the
   * top-right. The caller passes these ONLY pre-query (no active result), so the
   * post-query banner ViewToggle stays the sole control once a query is running. */
  defaultView?: ResultView;
  onDefaultView?: (v: ResultView) => void;
}) {
  return (
    <motion.header
      className="relative z-10 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8"
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {showBrand ? (
        <div>
          <div className="font-display font-semibold text-[color:var(--color-text-primary)] text-body-lg uppercase tracking-[0.18em]">
            Rare Structure
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
            <Crosshair className="size-3 text-[color:var(--color-text-accent)]" />
            Catalyst Origination Terminal
          </div>
        </div>
      ) : (
        <div />
      )}
      <div className="text-right">
        <div className="flex items-center justify-end gap-2 font-mono text-[color:var(--color-text-accent)] text-mono-xs uppercase">
          <span className="size-1.5 animate-pulse bg-[color:var(--color-accent-primary)]" />
          Live
        </div>
        <div className="mt-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tabular-nums">
          {(TRACKED_ENTITIES / 1_000_000).toFixed(2)}M entities tracked
        </div>
        {defaultView && onDefaultView && (
          <div className="mt-3 flex flex-col items-end gap-1.5">
            <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
              Default view
            </span>
            <DefaultViewToggle view={defaultView} onChange={onDefaultView} />
          </div>
        )}
      </div>
    </motion.header>
  );
}

/** The persistent ⌘K affordance; glows while the cockpit is idle. */
export function CommandPill({
  reduced,
  idle,
  onClick,
}: {
  reduced: boolean;
  idle: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      className="relative z-10 flex justify-center pb-8 sm:pb-10"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: reduced ? 0 : 1.4 }}
    >
      <button
        type="button"
        onClick={onClick}
        className={`group flex items-center gap-3 border bg-[color:var(--color-surface-raised)] px-4 py-2.5 transition-colors ${
          idle
            ? "border-[color:var(--color-accent-primary)]"
            : "border-[color:var(--color-border-default)] hover:border-[color:var(--color-accent-primary)]"
        }`}
      >
        <span className="flex items-center gap-1">
          <kbd className="border border-[color:var(--color-border-default)] px-1.5 py-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs leading-none">
            ⌘
          </kbd>
          <kbd className="border border-[color:var(--color-border-default)] px-1.5 py-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs leading-none">
            K
          </kbd>
        </span>
        <span
          className={`font-mono text-mono-xs uppercase transition-colors ${
            idle
              ? "text-[color:var(--color-text-primary)]"
              : "text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-text-primary)]"
          }`}
        >
          Query the market
        </span>
        {idle && !reduced && (
          <motion.span
            aria-hidden="true"
            className="size-1.5 bg-[color:var(--color-accent-primary)]"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
        )}
      </button>
    </motion.div>
  );
}
