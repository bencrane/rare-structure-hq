/**
 * TerminalChrome — the cockpit's shared chrome: the terminal header and the
 * ⌘K command pill. Both the map and the aggregate-chart surfaces wear them,
 * so the operator's screen reads as one coherent instrument.
 */

import { motion } from "framer-motion";
import {
  Braces,
  Crosshair,
  type LucideIcon,
  Map as MapIcon,
  Table2 as TableIcon,
  SlidersHorizontal as WorkbenchIcon,
  X,
} from "lucide-react";
import { TRACKED_ENTITIES } from "../data";

/** The dataset the NL /ask query targets, as a non-optional selectable value. */

/** The result-view selector value — flips a map-query result between the geographic dot map
 * and the full results table. The control lives in the terminal header's top-right corner. */
export type ResultView = "map" | "table";

/** What the top-right toggle can highlight: a result view, or the query workbench pane.
 * "workbench" is a cockpit MODE, not a result view — it is never persisted as a default
 * (`parseResultView` stays pinned to map|table) and never seeds a fresh query's surface. */
export type CockpitPane = ResultView | "workbench";

/** The compact, icon-only Map/Table(/Workbench) selector for the terminal header's top-right.
 * Used both pre-query (`kind="default"` — sets the persisted global default surface) and
 * post-query (`kind="active"` — switches the current result's view); `kind` only changes the
 * a11y label. When `onWorkbench` is provided a third segment opens the deterministic query
 * workbench — a mode switch, never a persisted default. */
export function CompactViewToggle({
  view,
  onChange,
  kind,
  onWorkbench,
}: {
  view: CockpitPane;
  onChange: (v: ResultView) => void;
  kind: "default" | "active";
  onWorkbench?: () => void;
}) {
  return (
    <div className="flex items-stretch border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)]">
      <CompactViewToggleButton
        active={view === "map"}
        onClick={() => onChange("map")}
        label="Map"
        Icon={MapIcon}
        kind={kind}
      />
      <span className="w-px self-stretch bg-[color:var(--color-border-subtle)]" />
      <CompactViewToggleButton
        active={view === "table"}
        onClick={() => onChange("table")}
        label="Table"
        Icon={TableIcon}
        kind={kind}
      />
      {onWorkbench && (
        <>
          <span className="w-px self-stretch bg-[color:var(--color-border-subtle)]" />
          <CompactViewToggleButton
            active={view === "workbench"}
            onClick={() => {
              if (view !== "workbench") onWorkbench();
            }}
            label="Workbench"
            Icon={WorkbenchIcon}
            kind={kind}
            desc="Open the query workbench"
          />
        </>
      )}
    </div>
  );
}

function CompactViewToggleButton({
  active,
  onClick,
  label,
  Icon,
  kind,
  desc: descOverride,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: LucideIcon;
  kind: "default" | "active";
  /** Explicit a11y/tooltip text — the workbench segment is a mode switch, so neither
   * kind-derived phrasing ("Set … as the default view" / "Show … view") applies. */
  desc?: string;
}) {
  const desc =
    descOverride ??
    (kind === "default" ? `Set ${label} as the default view` : `Show ${label} view`);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={desc}
      title={desc}
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
  view,
  onView,
  onClear,
  onWorkbench,
  scopeRaw,
  onToggleScope,
}: {
  reduced: boolean;
  /** Hide the wordmark + terminal name when the map is embedded in the
   * authenticated cockpit — the sidebar already carries the brand there. */
  showBrand?: boolean;
  /** PRE-QUERY default-view toggle (sets the persisted global default). Caller passes
   * these only when no result is active. */
  defaultView?: ResultView;
  onDefaultView?: (v: ResultView) => void;
  /** POST-QUERY active-view toggle (switches the current result between map and table).
   * Caller passes these only while a result is active; renders in the same top-right slot
   * as the pre-query toggle, with the Clear (✕) button to its right. "workbench" marks the
   * workbench pane active (map/table then EXIT the workbench back to the picked view). */
  view?: CockpitPane;
  onView?: (v: ResultView) => void;
  /** Clears the active result set — rendered as a compact ✕ to the right of the active
   * toggle (post-query only). */
  onClear?: () => void;
  /** Opens the deterministic query workbench — renders the third toggle segment. */
  onWorkbench?: () => void;
  /** SCOPE-DISPLAY toggle: current state (true = raw compiled plan, false = plain
   * English). Rendered as a compact button left of the ✕ — only when a raw plan
   * exists to toggle to (caller passes onToggleScope only then). */
  scopeRaw?: boolean;
  onToggleScope?: () => void;
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
          <span className="size-1.5 bg-[color:var(--color-accent-primary)]" />
          Live
        </div>
        <div className="mt-1.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase tabular-nums">
          {(TRACKED_ENTITIES / 1_000_000).toFixed(2)}M entities tracked
        </div>
        {/* Pre-query: the global default-view toggle. */}
        {defaultView && onDefaultView && (
          <div className="mt-3 flex justify-end">
            <CompactViewToggle
              view={defaultView}
              onChange={onDefaultView}
              kind="default"
              onWorkbench={onWorkbench}
            />
          </div>
        )}
        {/* Post-query: the active Map/Table toggle + a ✕ clear to its right — same slot. */}
        {view && onView && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <CompactViewToggle
              view={view}
              onChange={onView}
              kind="active"
              onWorkbench={onWorkbench}
            />
            {onToggleScope && (
              <button
                type="button"
                onClick={onToggleScope}
                aria-pressed={scopeRaw}
                aria-label={
                  scopeRaw
                    ? "Showing the raw compiled plan — switch to plain English"
                    : "Showing the plain-English query — switch to the raw compiled plan"
                }
                title={scopeRaw ? "Scope: raw plan" : "Scope: plain English"}
                className={`flex items-center justify-center border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-2 py-1.5 transition-colors ${
                  scopeRaw
                    ? "text-[color:var(--color-text-accent)]"
                    : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
                }`}
              >
                <Braces className="size-3.5" />
              </button>
            )}
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear results"
                title="Clear results"
                className="flex items-center justify-center border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] px-2 py-1.5 text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-accent)]"
              >
                <X className="size-3.5" />
              </button>
            )}
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
