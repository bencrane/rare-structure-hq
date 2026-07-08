/**
 * ActiveDeal — the operator's single "meeting I'm on right now" pointer, global to the cockpit.
 *
 * One slot, operator-set (from the Applications tab's Active column), persisted to localStorage so it
 * survives reloads and rides across tabs. Global actions (e.g. the mandate hotkey) resolve the current
 * deal against this pointer instead of the route, so they work from anywhere in the app — not just the
 * deal's own page. Client-only state: this is a solo-operator cockpit, no backend row needed.
 */
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** The pointer payload — the handle drives navigation; companyName is carried for display. */
export type ActiveDeal = { handle: string; companyName: string | null };

type ActiveDealCtx = {
  activeDeal: ActiveDeal | null;
  /** Set (or clear, with null) the active meeting. Persists to localStorage. */
  setActiveDeal: (deal: ActiveDeal | null) => void;
};

const Ctx = createContext<ActiveDealCtx | null>(null);

const KEY = "rs.cockpit.activeDeal";

// Read + validate the persisted pointer. Tolerates a corrupt/legacy entry by returning null.
function read(): ActiveDeal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && typeof (parsed as ActiveDeal).handle === "string") {
      const p = parsed as ActiveDeal;
      return {
        handle: p.handle,
        companyName: typeof p.companyName === "string" ? p.companyName : null,
      };
    }
  } catch {
    // corrupt entry — fall through to null
  }
  return null;
}

export function ActiveDealProvider({ children }: { children: ReactNode }) {
  const [activeDeal, setState] = useState<ActiveDeal | null>(() => read());

  const setActiveDeal = useCallback((deal: ActiveDeal | null) => {
    setState(deal);
    if (typeof window === "undefined") return;
    if (deal) window.localStorage.setItem(KEY, JSON.stringify(deal));
    else window.localStorage.removeItem(KEY);
  }, []);

  // Cross-tab sync: a change in another tab (or window) mirrors here so the pointer never diverges.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY || e.key === null) setState(read());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ activeDeal, setActiveDeal }), [activeDeal, setActiveDeal]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveDeal(): ActiveDealCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveDeal must be used within ActiveDealProvider");
  return ctx;
}
