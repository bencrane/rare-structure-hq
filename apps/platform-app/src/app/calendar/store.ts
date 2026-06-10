/**
 * Calendar overlay store — the live, mutable layer on top of the seeded backdrop.
 *
 * Two things the operator can change on a call:
 *   1. CREATE / book real meetings (absolute-dated `UserEvent`s).
 *   2. MOVE or CLEAR backdrop blocks (a `SeedPatch` keyed by the seeded event's
 *      stable id) — so a slot can be "found" while the prospect watches.
 *
 * State is a tiny external store (module-level + `useSyncExternalStore`) and is
 * persisted to localStorage so a rehearsal survives a reload. This is the seam:
 * swap `load`/`persist` for a BFF read/write later and nothing in the UI changes.
 */
import { useSyncExternalStore } from "react";

import {
  type CalEvent,
  type EventCategory,
  type SeedPatch,
  type UserEvent,
  diffDays,
  parseDateKey,
  weekEvents,
} from "./data";

const KEY = "rs.calendar.overlay.v1";

export interface Overlay {
  userEvents: UserEvent[];
  patches: Record<string, SeedPatch>;
}

const EMPTY: Overlay = { userEvents: [], patches: {} };

function load(): Overlay {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Overlay>;
    return { userEvents: parsed.userEvents ?? [], patches: parsed.patches ?? {} };
  } catch {
    return EMPTY;
  }
}

let state: Overlay = load();
const listeners = new Set<() => void>();

function commit(next: Overlay): void {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage full / unavailable — keep the in-memory state, drop persistence.
    }
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshot(): Overlay {
  return state;
}

let seq = 0;
function uid(): string {
  seq += 1;
  return `u-${Date.now().toString(36)}-${seq}`;
}

// ── Mutators ──
export interface NewEventInput {
  date: string;
  start: number;
  end: number;
  title: string;
  category: EventCategory;
  attendeeName?: string;
  attendeeEmail?: string;
  location?: string;
  notes?: string;
  booked?: boolean;
}

export function createUserEvent(input: NewEventInput): UserEvent {
  const ev: UserEvent = { id: uid(), ...input };
  commit({ ...state, userEvents: [...state.userEvents, ev] });
  return ev;
}

export function updateUserEvent(id: string, patch: Partial<UserEvent>): void {
  commit({
    ...state,
    userEvents: state.userEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  });
}

export function deleteUserEvent(id: string): void {
  commit({ ...state, userEvents: state.userEvents.filter((e) => e.id !== id) });
}

export function patchSeed(id: string, patch: SeedPatch): void {
  commit({ ...state, patches: { ...state.patches, [id]: patch } });
}

export function deleteSeed(id: string): void {
  patchSeed(id, { deleted: true });
}

export function resetOverlay(): void {
  commit(EMPTY);
}

// ── Read ──
export function useOverlay(): Overlay {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/**
 * Merge the seeded backdrop (with patches applied) and the operator's absolute-
 * dated events into one source-tagged list for the rendered week.
 */
export function mergeWeek(weekStart: Date, overlay: Overlay): CalEvent[] {
  const out: CalEvent[] = [];

  for (const e of weekEvents(weekStart)) {
    const p = overlay.patches[e.id];
    if (p && "deleted" in p) continue;
    out.push(
      p
        ? { ...e, day: p.day, start: p.start, end: p.end, source: "seed" }
        : { ...e, source: "seed" },
    );
  }

  for (const u of overlay.userEvents) {
    const day = diffDays(weekStart, parseDateKey(u.date));
    if (day < 0 || day > 6) continue;
    out.push({
      id: u.id,
      day,
      start: u.start,
      end: u.end,
      title: u.title,
      category: u.category,
      attendeeName: u.attendeeName,
      attendeeEmail: u.attendeeEmail,
      location: u.location,
      notes: u.notes,
      booked: u.booked,
      source: "user",
    });
  }

  return out;
}
