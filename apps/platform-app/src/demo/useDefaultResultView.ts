/**
 * useDefaultResultView — the operator's GLOBAL default result view, persisted.
 *
 * This is the single source of truth for which surface a fresh map-query renders:
 * the geographic map vs the full results table. It is written ONLY by the
 * pre-query toggle in the terminal header. The post-query banner toggle is a
 * per-query LOCAL override and never writes here — so "peek at the map for this
 * one query" can't silently rebind the global default.
 *
 * Persisted to localStorage and synced across tabs via the `storage` event, so
 * the default is genuinely global to the browser, not per-tab or per-session.
 */

import { useCallback, useEffect, useState } from "react";
import type { ResultView } from "./components/TerminalChrome";

/** localStorage key for the persisted default. Pinned — changing it silently
 * resets every operator's saved preference back to the seed. */
export const DEFAULT_VIEW_STORAGE_KEY = "rs.cockpit.defaultResultView";

/** Narrow an arbitrary stored string to a ResultView, or null if absent/garbage. */
export function parseResultView(raw: string | null): ResultView | null {
  return raw === "map" || raw === "table" ? raw : null;
}

function readStored(): ResultView | null {
  if (typeof window === "undefined") return null;
  try {
    return parseResultView(window.localStorage.getItem(DEFAULT_VIEW_STORAGE_KEY));
  } catch {
    return null; // storage blocked (private mode / disabled) — fall back to the seed
  }
}

export function useDefaultResultView(
  fallback: ResultView,
): readonly [ResultView, (next: ResultView) => void] {
  const [view, setView] = useState<ResultView>(() => readStored() ?? fallback);

  const setDefaultView = useCallback((next: ResultView) => {
    setView(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DEFAULT_VIEW_STORAGE_KEY, next);
    } catch {
      /* storage blocked — keep the in-memory value; it just won't survive reload */
    }
  }, []);

  // Reflect a change made in another tab so the default stays global to the browser.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== DEFAULT_VIEW_STORAGE_KEY) return;
      const next = parseResultView(e.newValue);
      if (next) setView(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [view, setDefaultView] as const;
}
