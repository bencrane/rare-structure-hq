/**
 * CommandPalette — global navigation modal (⌘/Ctrl+P). Type to filter commands, Enter to run.
 *
 * Mounted in AppShell so it's available on every cockpit route. Commands resolve against the global
 * ActiveDeal pointer where relevant (e.g. "mandate" → the active deal's engagement mandate page), so
 * navigation works from anywhere without knowing the current URL.
 */
import { CornerDownLeft, FileSignature, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { cx } from "@rare-structure-hq/ui";

import { useActiveDeal } from "@/lib/activeDeal";

type Command = {
  id: string;
  title: string;
  /** Right-aligned hint (e.g. the resolved target, or why it's unavailable). */
  hint: string;
  /** Extra match terms beyond the title. */
  keywords: string[];
  run: () => void;
};

export function CommandPalette() {
  const navigate = useNavigate();
  const { activeDeal } = useActiveDeal();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘P / Ctrl+P toggles the palette (preventDefault to suppress the browser print dialog).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset + focus on open.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const close = () => setOpen(false);
  const runAnd = (fn: () => void) => {
    close();
    fn();
  };

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "mandate",
        title: "Mandate",
        hint: activeDeal
          ? (activeDeal.companyName ?? activeDeal.handle)
          : "No active meeting — set one in Research",
        keywords: ["engagement", "originate", "agreement", "deal"],
        run: () =>
          activeDeal ? navigate(`/app/m/${activeDeal.handle}`) : navigate("/app/research"),
      },
      {
        id: "demo",
        title: "Demo",
        hint: "Guided tour — every beat is a query",
        keywords: ["tour", "presentation", "pitch", "walkthrough", "narrative"],
        run: () => navigate("/app/demo"),
      },
    ],
    [activeDeal, navigate],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [commands, query]);

  const clamped = Math.min(index, Math.max(results.length - 1, 0));

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = results[clamped];
      if (c) runAnd(c.run);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh]">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={close}
        className="absolute inset-0 bg-[color:var(--color-surface-overlay)]"
      />
      <div className="relative w-full max-w-lg border border-[color:var(--color-border-accent)] bg-[color:var(--color-surface-sunken)] shadow-2xl">
        {/* Search input. */}
        <div className="flex items-center gap-2 border-[color:var(--color-border-subtle)] border-b px-4 py-3">
          <Search className="size-4 shrink-0 text-[color:var(--color-text-subtle)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Type a command… (e.g. mandate)"
            className="w-full bg-transparent font-mono text-[0.8125rem] text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-subtle)]"
          />
        </div>

        {/* Results. */}
        <div className="max-h-[40vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-[color:var(--color-text-subtle)] text-mono-xs uppercase tracking-[0.14em]">
              No commands
            </div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => runAnd(c.run)}
                className={cx(
                  "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                  i === clamped
                    ? "bg-[color:var(--color-accent-soft)]"
                    : "hover:bg-[color:var(--color-surface-raised)]",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <FileSignature className="size-3.5 shrink-0 text-[color:var(--color-text-accent)]" />
                  <span className="font-mono text-[0.8125rem] text-[color:var(--color-text-primary)]">
                    {c.title}
                  </span>
                </span>
                <span className="truncate font-mono text-[0.625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.12em]">
                  {c.hint}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint. */}
        <div className="flex items-center gap-2 border-[color:var(--color-border-subtle)] border-t px-4 py-2 font-mono text-[0.5625rem] text-[color:var(--color-text-subtle)] uppercase tracking-[0.14em]">
          <CornerDownLeft className="size-3" /> to run · esc to close
        </div>
      </div>
    </div>
  );
}
