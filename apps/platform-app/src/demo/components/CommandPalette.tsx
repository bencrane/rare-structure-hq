/**
 * CommandPalette — the ⌘K command palette: the cockpit's steering wheel.
 *
 * Unlike the linear demo's one-shot thesis palette, this opens at any time.
 * The operator types; a live-filtered list of commands surfaces (the
 * Linear/Raycast pattern). Picking one runs it — a map query lights up the
 * US with companies, an aggregate swaps the map for a chart. The commands
 * read like natural language but resolve deterministically: no model in the
 * loop, fully rehearsable on a live call.
 *
 * Styled on the `@rare-structure-hq` design system. Closes on Esc / backdrop
 * (Esc is handled globally by `DemoApp`).
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, CornerDownLeft, MapPin, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { COMMANDS } from "../data";
import type { Command } from "../types";

export function CommandPalette({
  open,
  onClose,
  onRun,
}: {
  open: boolean;
  onClose: () => void;
  onRun: (command: Command) => void;
}) {
  const reduced = !!useReducedMotion();
  const [queryText, setQueryText] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state and focus the input each time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQueryText("");
    setSelected(0);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const tokens = queryText.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return COMMANDS;
    return COMMANDS.filter((c) => {
      const hay = c.label.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [queryText]);

  // The free-typed sentence becomes the top "Phrase" action — running it routes through
  // catalyst's DETERMINISTIC phrase compiler (closed grammar, zero LLM): every token binds
  // to a disclosed filter or the phrase refuses naming the token. The canned commands
  // below it are acceptance-fixture phrases of the same grammar.
  const rows = useMemo<Command[]>(() => {
    const trimmed = queryText.trim();
    if (!trimmed) return filtered;
    const phrase: Command = {
      id: "__phrase__",
      kind: "map-query",
      label: trimmed,
      query: { nl: trimmed, minAward: 0 },
    };
    return [phrase, ...filtered];
  }, [queryText, filtered]);

  // Keep the selection in range as the list narrows.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = rows[selected];
      if (cmd) onRun(cmd);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-[16vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <button
            type="button"
            aria-label="Close command palette"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[color:var(--color-surface-overlay)] backdrop-blur-sm"
          />

          {/* biome-ignore lint/a11y/useSemanticElements: native <dialog> needs imperative showModal()/close(), which conflicts with framer-motion AnimatePresence; role="dialog" + aria-modal is correct for an animated modal. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Cockpit command palette"
            className="relative w-full max-w-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-raised)] shadow-2xl shadow-black/60"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduced ? { duration: 0.12 } : { duration: 0.2 }}
          >
            {/* Search row */}
            <div className="flex items-center gap-3 border-[color:var(--color-border-subtle)] border-b px-5 py-4">
              <Search className="size-4 shrink-0 text-[color:var(--color-text-muted)]" />
              <input
                ref={inputRef}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Query the market — e.g. aerospace & defense contracts over $5M"
                className="flex-1 bg-transparent font-mono text-[color:var(--color-text-primary)] text-body-sm outline-none placeholder:text-[color:var(--color-text-subtle)]"
                aria-label="Command query"
              />
              <kbd className="border border-[color:var(--color-border-default)] px-1.5 py-0.5 font-mono text-[color:var(--color-text-muted)] text-mono-xs leading-none">
                esc
              </kbd>
            </div>

            {/* Command list */}
            <ul className="max-h-[52vh] overflow-y-auto py-1.5">
              {rows.length === 0 && (
                <li className="px-5 py-6 text-center font-mono text-[color:var(--color-text-muted)] text-mono-xs uppercase">
                  No commands match
                </li>
              )}
              {rows.map((cmd, i) => (
                <CommandRow
                  key={cmd.id}
                  command={cmd}
                  active={i === selected}
                  onHover={() => setSelected(i)}
                  onRun={() => onRun(cmd)}
                />
              ))}
            </ul>

            {/* Footer hint */}
            <div className="flex items-center gap-4 border-[color:var(--color-border-subtle)] border-t px-5 py-2.5 font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
              <span>↑↓ navigate</span>
              <span>⏎ run</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommandRow({
  command,
  active,
  onHover,
  onRun,
}: {
  command: Command;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
}) {
  // A phrase row (free-typed or canned) routes through the deterministic compiler.
  const isPhrase = command.kind === "map-query" && !!command.query.nl;
  const Icon = isPhrase ? Sparkles : command.kind === "aggregate" ? BarChart3 : MapPin;
  const kindLabel = isPhrase ? "Phrase" : command.kind === "aggregate" ? "Chart" : "Map";

  return (
    <li>
      <button
        type="button"
        onMouseMove={onHover}
        onClick={onRun}
        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${
          active
            ? "bg-[color:var(--color-accent-soft)]"
            : "bg-transparent hover:bg-[color:var(--color-surface-base)]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center border ${
            active
              ? "border-[color:var(--color-accent-primary)] text-[color:var(--color-text-accent)]"
              : "border-[color:var(--color-border-default)] text-[color:var(--color-text-muted)]"
          }`}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="flex-1 text-[color:var(--color-text-default)] text-body-sm leading-snug">
          {command.label}
        </span>
        <span className="font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase">
          {kindLabel}
        </span>
        {active && (
          <CornerDownLeft className="size-3.5 shrink-0 text-[color:var(--color-text-accent)]" />
        )}
      </button>
    </li>
  );
}
