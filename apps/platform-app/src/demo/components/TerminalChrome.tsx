/**
 * TerminalChrome — the cockpit's shared chrome: the terminal header and the
 * ⌘K command pill. Both the map and the aggregate-chart surfaces wear them,
 * so the operator's screen reads as one coherent instrument.
 */

import { motion } from "framer-motion";
import { Crosshair } from "lucide-react";
import { TRACKED_ENTITIES } from "../data";

/** The fixed terminal header — wordmark, terminal name, live entity count. */
export function TerminalHeader({
  reduced,
  showBrand = true,
}: {
  reduced: boolean;
  /** Hide the wordmark + terminal name when the map is embedded in the
   * authenticated cockpit — the sidebar already carries the brand there. */
  showBrand?: boolean;
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
